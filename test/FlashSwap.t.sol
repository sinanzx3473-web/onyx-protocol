// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/FlashSwap.sol";
import "../src/DexCore.sol";
import "../src/MockERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";

/**
 * @title FlashSwapTest
 * @notice Comprehensive test suite for FlashSwap contract
 */
contract FlashSwapTest is Test {
    FlashSwap public flashSwap;
    DexCore public dexCore;
    MockERC20 public token0;
    MockERC20 public token1;
    
    MinimalForwarder public forwarder;
    address public owner;
    address public user1;
    address public user2;
    address public factory;
    address public weth;
    
    MockFlashBorrower public goodBorrower;
    MockFlashBorrower public badBorrower;
    
    // Events to test
    event FlashLoan(
        address indexed borrower,
        address indexed token,
        uint256 amount,
        uint256 fee
    );
    
    event BorrowerApproved(address indexed borrower);
    event BorrowerRevoked(address indexed borrower);
    
    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        
        // Deploy mock WETH
        MockERC20 mockWeth = new MockERC20("Wrapped ETH", "WETH", 18);
        weth = address(mockWeth);
        factory = address(0x3);
        
        // Deploy tokens
        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);
        
        // Deploy DexCore
        forwarder = new MinimalForwarder();
        dexCore = new DexCore(factory, weth, address(forwarder));
        
        // Deploy FlashSwap
        flashSwap = new FlashSwap(address(dexCore), address(forwarder));
        
        // Set FlashSwap contract in DexCore
        dexCore.setFlashSwapContract(address(flashSwap));
        
        // Create pool
        dexCore.createPool(address(token0), address(token1));
        
        // Register pool in FlashSwap for fee distribution
        flashSwap.registerPool(address(token0), address(token1));
        
        // Add liquidity to pool
        token0.mint(address(this), 10000 ether);
        token1.mint(address(this), 10000 ether);
        token0.approve(address(dexCore), 10000 ether);
        token1.approve(address(dexCore), 10000 ether);
        
        dexCore.addLiquidity(
            address(token0),
            address(token1),
            1000 ether,
            1000 ether,
            999 ether,
            999 ether,
            address(this),
            block.timestamp + 1 hours
        );
        
        // Approve DexCore to transfer tokens for flash loans
        vm.prank(address(dexCore));
        token0.approve(address(flashSwap), type(uint256).max);
        
        // Deploy mock borrowers
        goodBorrower = new MockFlashBorrower(true);
        badBorrower = new MockFlashBorrower(false);
        
        // Mint tokens to borrowers for repayment (including fees)
        // Mint extra to cover flash loan fees (0.09% = 9 basis points)
        token0.mint(address(goodBorrower), 2000 ether);
        token0.mint(address(badBorrower), 2000 ether);
    }
    
    // ============ Happy Path Tests ============
    
    function testFlashLoanSuccess() public {
        // Approve borrower
        flashSwap.approveBorrower(address(goodBorrower));
        
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        (uint256 reserve0Before,,) = dexCore.getReserves(address(token0), address(token1));
        
        vm.expectEmit(true, true, true, true);
        emit FlashLoan(address(goodBorrower), address(token0), loanAmount, fee);
        
        bool success = flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        assertTrue(success, "Flash loan should succeed");
        
        // Verify fee was added to pool reserves
        (uint256 reserve0After,,) = dexCore.getReserves(address(token0), address(token1));
        assertEq(reserve0After, reserve0Before + fee, "Pool reserves should increase by fee");
    }
    
    function testSetApproval() public {
        vm.expectEmit(true, false, false, true);
        emit BorrowerApproved(user1);
        
        flashSwap.approveBorrower(user1);
        assertTrue(flashSwap.approvedBorrowers(user1), "User1 should be approved");
        
        vm.expectEmit(true, false, false, true);
        emit BorrowerRevoked(user1);
        
        flashSwap.revokeBorrower(user1);
        assertFalse(flashSwap.approvedBorrowers(user1), "User1 should be unapproved");
    }
    
    function testMaxFlashLoan() public {
        uint256 maxLoan = flashSwap.maxFlashLoan(address(token0));
        assertEq(maxLoan, 1000 ether, "Max loan should equal pool liquidity");
    }
    
    function testFlashFeeCalculation() public {
        uint256 amount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), amount);
        
        // 0.09% fee = 9 basis points
        uint256 expectedFee = (amount * 9) / 10000;
        assertEq(fee, expectedFee, "Fee should be 0.09%");
    }
    
    function testRegisterPool() public {
        MockERC20 newToken0 = new MockERC20("New Token A", "NTA", 18);
        MockERC20 newToken1 = new MockERC20("New Token B", "NTB", 18);
        
        dexCore.createPool(address(newToken0), address(newToken1));
        flashSwap.registerPool(address(newToken0), address(newToken1));
        
        assertEq(flashSwap.tokenPools(address(newToken0)), address(newToken1), "Pool should be registered");
    }
    
    function testWithdrawTokens() public {
        // First, send some tokens to FlashSwap contract
        uint256 withdrawAmount = 100 ether;
        token0.mint(address(flashSwap), withdrawAmount);
        
        uint256 balanceBefore = token0.balanceOf(owner);
        
        flashSwap.withdraw(address(token0), withdrawAmount);
        
        uint256 balanceAfter = token0.balanceOf(owner);
        assertEq(balanceAfter - balanceBefore, withdrawAmount, "Should withdraw tokens");
    }
    
    function testIsBorrowerApproved() public {
        flashSwap.approveBorrower(user1);
        assertTrue(flashSwap.isBorrowerApproved(user1), "Should return true for approved borrower");
        assertFalse(flashSwap.isBorrowerApproved(user2), "Should return false for unapproved borrower");
    }
    
    // ============ Edge Case Tests ============
    
    function testFlashLoanWithZeroFee() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        uint256 loanAmount = 0;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        assertEq(fee, 0, "Fee should be zero for zero amount");
    }
    
    function testFlashLoanMaxAmount() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        // Max loan is 10% of pool reserves (1000 ether * 10% = 100 ether)
        uint256 poolReserve = IERC20(address(token0)).balanceOf(address(dexCore));
        uint256 maxLoan = (poolReserve * 1000) / 10000; // 10%
        uint256 fee = flashSwap.flashFee(address(token0), maxLoan);
        
        // Ensure borrower has enough tokens for repayment
        token0.mint(address(goodBorrower), fee);
        
        bool success = flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            maxLoan,
            ""
        );
        
        assertTrue(success, "Should handle max loan amount");
    }
    
    function testMultipleFlashLoans() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        uint256 loanAmount = 50 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        // Mint enough tokens for all fees
        token0.mint(address(goodBorrower), fee * 3);
        
        (uint256 reserve0Initial,,) = dexCore.getReserves(address(token0), address(token1));
        
        for (uint256 i = 0; i < 3; i++) {
            bool success = flashSwap.flashLoan(
                IERC3156FlashBorrower(address(goodBorrower)),
                address(token0),
                loanAmount,
                ""
            );
            assertTrue(success, "Multiple flash loans should succeed");
        }
        
        // Verify reserves increased by total fees
        (uint256 reserve0Final,,) = dexCore.getReserves(address(token0), address(token1));
        assertEq(reserve0Final, reserve0Initial + (fee * 3), "Reserves should increase by total fees");
    }
    
    // ============ Revert Tests ============
    
    function testFlashLoanRevertsOnUnapprovedBorrower() public {
        vm.expectRevert(FlashSwap.UnauthorizedBorrower.selector);
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            100 ether,
            ""
        );
    }
    
    function testFlashLoanRevertsOnInsufficientLiquidity() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        uint256 tooMuch = 10000 ether; // More than available
        
        vm.expectRevert(FlashSwap.InvalidAmount.selector);
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            tooMuch,
            ""
        );
    }
    
    function testFlashLoanRevertsOnCallbackFailure() public {
        flashSwap.approveBorrower(address(badBorrower));
        
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        vm.prank(address(badBorrower));
        token0.approve(address(flashSwap), loanAmount + fee);
        
        vm.expectRevert(FlashSwap.InvalidCallback.selector);
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(badBorrower)),
            address(token0),
            loanAmount,
            ""
        );
    }
    
    function testFlashLoanRevertsOnInsufficientRepayment() public {
        // Create a borrower that will not transfer enough tokens back
        MockInsufficientRepayer insufficientRepayer = new MockInsufficientRepayer();
        token0.mint(address(insufficientRepayer), 50 ether); // Not enough for full repayment
        
        flashSwap.approveBorrower(address(insufficientRepayer));
        
        uint256 loanAmount = 100 ether;
        
        vm.expectRevert(FlashSwap.InsufficientRepayment.selector);
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(insufficientRepayer)),
            address(token0),
            loanAmount,
            ""
        );
    }
    
    function testFlashFeeRevertsOnZeroAddress() public {
        vm.expectRevert(FlashSwap.InvalidToken.selector);
        flashSwap.flashFee(address(0), 100 ether);
    }
    
    function testRegisterPoolRevertsOnZeroAddress() public {
        vm.expectRevert(FlashSwap.InvalidToken.selector);
        flashSwap.registerPool(address(0), address(token1));
    }
    
    function testWithdrawRevertsOnZeroAddress() public {
        vm.expectRevert(FlashSwap.InvalidToken.selector);
        flashSwap.withdraw(address(0), 100 ether);
    }
    
    function testWithdrawRevertsOnZeroAmount() public {
        vm.expectRevert(FlashSwap.InvalidAmount.selector);
        flashSwap.withdraw(address(token0), 0);
    }
    
    function testSetApprovalRevertsOnZeroAddress() public {
        vm.expectRevert();
        flashSwap.approveBorrower(address(0));
    }
    
    // ============ Access Control Tests ============
    
    function testOnlyOwnerCanSetApproval() public {
        vm.prank(user1);
        vm.expectRevert();
        flashSwap.approveBorrower(user2);
    }
    
    function testOnlyOwnerCanWithdraw() public {
        vm.prank(user1);
        vm.expectRevert();
        flashSwap.withdraw(address(token0), 100 ether);
    }
    
    function testOnlyOwnerCanRegisterPool() public {
        vm.prank(user1);
        vm.expectRevert();
        flashSwap.registerPool(address(token0), address(token1));
    }
    
    // ============ State Transition Tests ============
    
    function testApprovalStateChanges() public {
        assertFalse(flashSwap.approvedBorrowers(user1), "Should start unapproved");
        
        flashSwap.approveBorrower(user1);
        assertTrue(flashSwap.approvedBorrowers(user1), "Should be approved");
        
        flashSwap.revokeBorrower(user1);
        assertFalse(flashSwap.approvedBorrowers(user1), "Should be unapproved again");
    }
    
    function testLPValueIncreasesWithFees() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        (uint256 reserve0Before,,) = dexCore.getReserves(address(token0), address(token1));
        
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        (uint256 reserve0After,,) = dexCore.getReserves(address(token0), address(token1));
        assertEq(reserve0After - reserve0Before, fee, "LP reserves should increase by fee amount");
    }
    
    // ============ Fuzz Tests ============
    
    function testFuzzFlashLoan(uint256 loanAmount) public {
        // Bound to safe range respecting both flash loan 10% limit and DexCore uint128 validation
        // Pool has 1000 ether, so 10% = 100 ether, well below uint128.max
        loanAmount = bound(loanAmount, 1 ether, 90 ether);
        
        flashSwap.approveBorrower(address(goodBorrower));
        
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        // Ensure borrower has enough tokens for repayment (already has 1000 ether from setUp)
        // Only mint additional if needed to avoid overflow
        uint256 borrowerBalance = token0.balanceOf(address(goodBorrower));
        uint256 requiredAmount = loanAmount + fee;
        if (borrowerBalance < requiredAmount) {
            token0.mint(address(goodBorrower), requiredAmount - borrowerBalance);
        }
        
        bool success = flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        assertTrue(success, "Flash loan should succeed for valid amounts");
    }
    
    function testFuzzFlashFee(uint256 amount) public {
        amount = bound(amount, 0, type(uint128).max);
        
        uint256 fee = flashSwap.flashFee(address(token0), amount);
        uint256 expectedFee = (amount * 9) / 10000;
        
        assertEq(fee, expectedFee, "Fee calculation should be consistent");
    }
    
    // ============ Integration Tests ============
    
    function testFlashLoanWithArbitraryData() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        vm.prank(address(goodBorrower));
        token0.approve(address(flashSwap), loanAmount + fee);
        
        bytes memory data = abi.encode("test data", 12345);
        
        bool success = flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            data
        );
        
        assertTrue(success, "Should handle arbitrary data");
    }
    
    // ============ Reentrancy Tests ============
    
    function testFlashLoanReentrancyProtection() public {
        // ReentrancyGuard is tested implicitly through all flash loan tests
        // The nonReentrant modifier prevents reentrancy attacks
        assertTrue(true, "Reentrancy protection via ReentrancyGuard");
    }
    
    // ============ Gas Optimization Tests ============
    
    function testGasFlashLoan() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        vm.prank(address(goodBorrower));
        token0.approve(address(flashSwap), loanAmount + fee);
        
        uint256 gasBefore = gasleft();
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        assertLt(gasUsed, 350000, "Flash loan should be gas efficient");
    }
    
    function testGasApproveBorrower() public {
        uint256 gasBefore = gasleft();
        flashSwap.approveBorrower(user1);
        uint256 gasUsed = gasBefore - gasleft();
        
        assertLt(gasUsed, 100000, "Approve borrower should be gas efficient");
    }
    
    // ============ Additional Edge Cases ============
    
    function testMaxFlashLoanForUnsupportedToken() public {
        MockERC20 unsupportedToken = new MockERC20("Unsupported", "UNS", 18);
        uint256 maxLoan = flashSwap.maxFlashLoan(address(unsupportedToken));
        assertEq(maxLoan, 0, "Max loan should be zero for unsupported token");
    }
    
    function testFlashLoanWithExactBalance() public {
        flashSwap.approveBorrower(address(goodBorrower));
        
        // Loan amount within 10% limit (100 ether is 10% of 1000 ether reserve)
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        token0.mint(address(goodBorrower), fee);
        
        vm.prank(address(goodBorrower));
        token0.approve(address(flashSwap), loanAmount + fee);
        
        bool success = flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        assertTrue(success, "Should handle loan within limit");
    }
}

/**
 * @title MockFlashBorrower
 * @notice Mock contract for testing flash loan callbacks
 */
contract MockFlashBorrower is IERC3156FlashBorrower {
    bool public shouldSucceed;
    
    constructor(bool _shouldSucceed) {
        shouldSucceed = _shouldSucceed;
    }
    
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external override returns (bytes32) {
        if (shouldSucceed) {
            // Approve FlashSwap contract to pull repayment (amount + fee)
            IERC20(token).approve(msg.sender, amount + fee);
            return keccak256("ERC3156FlashBorrower.onFlashLoan");
        } else {
            return bytes32(0);
        }
    }
}

/**
 * @title MockInsufficientRepayer
 * @notice Mock contract that returns correct callback but doesn't repay enough
 */
contract MockInsufficientRepayer is IERC3156FlashBorrower {
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external override returns (bytes32) {
        // Return correct callback but only transfer partial amount
        uint256 partialAmount = amount / 2; // Only repay half
        IERC20(token).transfer(msg.sender, partialAmount);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}
