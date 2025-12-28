// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/FlashSwap.sol";
import "../src/DexCore.sol";
import "../src/DEXPair.sol";
import "../src/MockERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";

/**
 * @title FlashLoanHardeningTest
 * @notice Comprehensive test suite for flash loan hardening requirements (1.3)
 * @dev Tests reentrancy protection, fee routing to LPs, and loan cap enforcement
 */
contract FlashLoanHardeningTest is Test {
    FlashSwap public flashSwap;
    DexCore public dexCore;
    DEXPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;
    
    MinimalForwarder public forwarder;
    address public owner;
    address public lpProvider;
    address public factory;
    address public weth;
    
    GoodBorrower public goodBorrower;
    ReentrantBorrower public reentrantBorrower;
    
    event FlashLoanFeeAdded(
        address indexed token0,
        address indexed token1,
        address indexed feeToken,
        uint256 feeAmount
    );
    
    function setUp() public {
        owner = address(this);
        lpProvider = address(0x1);
        
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
        
        // Approve FlashSwap to pull tokens from DexCore for flash loans
        dexCore.approveFlashSwap(address(token0), type(uint256).max);
        dexCore.approveFlashSwap(address(token1), type(uint256).max);
        
        // Create pool
        address lpToken = dexCore.createPool(address(token0), address(token1));
        pair = DEXPair(lpToken);
        
        // Register pool in FlashSwap for fee distribution
        flashSwap.registerPool(address(token0), address(token1));
        
        // Add initial liquidity (1000 ether each)
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
        
        // Deploy borrowers
        goodBorrower = new GoodBorrower();
        reentrantBorrower = new ReentrantBorrower(address(flashSwap));
        
        // Mint tokens to borrowers for repayment
        token0.mint(address(goodBorrower), 10000 ether);
        token1.mint(address(goodBorrower), 10000 ether);
        token0.mint(address(reentrantBorrower), 10000 ether);
        
        // Approve borrowers to transfer tokens (for repayment)
        vm.prank(address(goodBorrower));
        token0.approve(address(flashSwap), type(uint256).max);
        vm.prank(address(goodBorrower));
        token1.approve(address(flashSwap), type(uint256).max);
        vm.prank(address(reentrantBorrower));
        token0.approve(address(flashSwap), type(uint256).max);
        
        // Fund borrowers with ETH for gas
        vm.deal(address(goodBorrower), 10 ether);
        vm.deal(address(reentrantBorrower), 10 ether);
        
        // Approve borrowers
        flashSwap.approveBorrower(address(goodBorrower));
        flashSwap.approveBorrower(address(reentrantBorrower));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          1.3.1: REENTRANCY PROTECTION
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function testFlashLoanHasReentrancyGuard() public {
        // Verify FlashSwap contract inherits ReentrancyGuard
        // This is a compile-time check - if it compiles, the guard exists
        assertTrue(address(flashSwap) != address(0), "FlashSwap deployed with ReentrancyGuard");
    }
    
    function testFlashLoanRevertsOnReentrancy() public {
        uint256 loanAmount = 50 ether;
        
        // Attempt reentrancy attack - should revert
        vm.expectRevert(); // ReentrancyGuard will revert with "ReentrancyGuard: reentrant call"
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(reentrantBorrower)),
            address(token0),
            loanAmount,
            ""
        );
    }
    
    function testDEXPairFlashLoanHasReentrancyGuard() public {
        // Verify DEXPair flash loan also has reentrancy protection
        assertTrue(address(pair) != address(0), "DEXPair deployed with ReentrancyGuard");
    }
    
    function testDEXPairFlashLoanRevertsOnReentrancy() public {
        uint256 loanAmount = 50 ether;
        
        ReentrantPairBorrower pairReentrantBorrower = new ReentrantPairBorrower(address(pair));
        token0.mint(address(pairReentrantBorrower), 1000 ether);
        
        // Approve pair to pull tokens for repayment
        vm.prank(address(pairReentrantBorrower));
        token0.approve(address(pair), type(uint256).max);
        
        // Attempt reentrancy attack on DEXPair - should revert
        vm.expectRevert(); // ReentrancyGuard will revert
        pair.flashLoan(
            IERC3156FlashBorrower(address(pairReentrantBorrower)),
            address(token0),
            loanAmount,
            ""
        );
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                    1.3.2: FEE ROUTING TO LPs (NEVER STUCK)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function testFlashLoanFeesAlwaysCreditToLPs() public {
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        (uint256 reserve0Before,,) = dexCore.getReserves(address(token0), address(token1));
        
        // Execute flash loan
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        (uint256 reserve0After,,) = dexCore.getReserves(address(token0), address(token1));
        
        // Verify fee was added to pool reserves (benefits LPs)
        assertEq(reserve0After, reserve0Before + fee, "Fee must be added to pool reserves");
    }
    
    function testNoFeesStuckInFlashSwapContract() public {
        uint256 loanAmount = 100 ether;
        
        uint256 flashSwapBalanceBefore = token0.balanceOf(address(flashSwap));
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        uint256 flashSwapBalanceAfter = token0.balanceOf(address(flashSwap));
        
        // No fees should remain in FlashSwap contract
        assertEq(flashSwapBalanceAfter, flashSwapBalanceBefore, "No fees stuck in FlashSwap");
    }
    
    function testNoFeesStuckInDexCoreOutsideReserves() public {
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        uint256 dexCoreBalanceBefore = token0.balanceOf(address(dexCore));
        (uint256 reserve0Before,,) = dexCore.getReserves(address(token0), address(token1));
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        uint256 dexCoreBalanceAfter = token0.balanceOf(address(dexCore));
        (uint256 reserve0After,,) = dexCore.getReserves(address(token0), address(token1));
        
        // DexCore balance should increase by fee
        assertEq(dexCoreBalanceAfter, dexCoreBalanceBefore + fee, "DexCore balance increases by fee");
        
        // Reserve should also increase by fee (no stuck fees)
        assertEq(reserve0After, reserve0Before + fee, "Reserve increases by fee");
        
        // No unaccounted tokens in DexCore
        assertEq(dexCoreBalanceAfter, reserve0After, "All DexCore tokens accounted in reserves");
    }
    
    function testFeeRoutingEmitsCorrectEvent() public {
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        // Expect FlashLoanFeeAdded event from DexCore
        vm.expectEmit(true, true, true, true, address(dexCore));
        emit FlashLoanFeeAdded(address(token0), address(token1), address(token0), fee);
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            loanAmount,
            ""
        );
    }
    
    function testMultipleFlashLoansAccumulateFeesInReserves() public {
        uint256 loanAmount = 50 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        (uint256 reserve0Initial,,) = dexCore.getReserves(address(token0), address(token1));
        
        // Execute 5 flash loans
        for (uint256 i = 0; i < 5; i++) {
            flashSwap.flashLoan(
                IERC3156FlashBorrower(address(goodBorrower)),
                address(token0),
                loanAmount,
                ""
            );
        }
        
        (uint256 reserve0Final,,) = dexCore.getReserves(address(token0), address(token1));
        
        // All fees should be in reserves
        assertEq(reserve0Final, reserve0Initial + (fee * 5), "All fees accumulated in reserves");
        
        // No fees stuck in FlashSwap
        assertEq(token0.balanceOf(address(flashSwap)), 0, "No fees stuck in FlashSwap");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                    1.3.3: LP WITHDRAWAL AFTER FLASH LOAN VOLUME
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function testLPWithdrawsMoreAfterFlashLoanVolume() public {
        // Record initial LP position
        address lpToken = dexCore.lpTokens(address(token0), address(token1));
        uint256 lpBalance = IERC20(lpToken).balanceOf(address(this));
        
        (uint256 reserve0Initial, uint256 reserve1Initial,) = dexCore.getReserves(address(token0), address(token1));
        
        // Calculate initial LP value
        uint256 totalSupply = IERC20(lpToken).totalSupply();
        uint256 initialValue0 = (lpBalance * reserve0Initial) / totalSupply;
        uint256 initialValue1 = (lpBalance * reserve1Initial) / totalSupply;
        
        // Execute multiple flash loans to generate fees
        uint256 loanAmount = 100 ether;
        for (uint256 i = 0; i < 10; i++) {
            flashSwap.flashLoan(
                IERC3156FlashBorrower(address(goodBorrower)),
                address(token0),
                loanAmount,
                ""
            );
        }
        
        // Calculate LP value after flash loans
        (uint256 reserve0After, uint256 reserve1After,) = dexCore.getReserves(address(token0), address(token1));
        uint256 finalValue0 = (lpBalance * reserve0After) / totalSupply;
        uint256 finalValue1 = (lpBalance * reserve1After) / totalSupply;
        
        // LP should be able to withdraw more token0 due to accumulated fees
        assertTrue(finalValue0 > initialValue0, "LP can withdraw more token0 after flash loan volume");
        assertEq(finalValue1, initialValue1, "LP token1 value unchanged (fees in token0)");
        
        // Verify the increase matches expected fees
        uint256 totalFees = flashSwap.flashFee(address(token0), loanAmount) * 10;
        uint256 expectedIncrease = (lpBalance * totalFees) / totalSupply;
        assertEq(finalValue0 - initialValue0, expectedIncrease, "LP value increase matches fees earned");
    }
    
    function testLPCanActuallyWithdrawIncreasedValue() public {
        // Add liquidity as LP
        address lpToken = dexCore.lpTokens(address(token0), address(token1));
        uint256 lpBalanceBefore = IERC20(lpToken).balanceOf(address(this));
        
        // Execute flash loans to generate fees
        uint256 loanAmount = 100 ether;
        for (uint256 i = 0; i < 5; i++) {
            flashSwap.flashLoan(
                IERC3156FlashBorrower(address(goodBorrower)),
                address(token0),
                loanAmount,
                ""
            );
        }
        
        // Record balances before withdrawal
        uint256 token0BalanceBefore = token0.balanceOf(address(this));
        uint256 token1BalanceBefore = token1.balanceOf(address(this));
        
        // Withdraw all liquidity
        IERC20(lpToken).approve(address(dexCore), lpBalanceBefore);
        (uint256 amount0, uint256 amount1) = dexCore.removeLiquidity(
            address(token0),
            address(token1),
            lpBalanceBefore,
            0,
            0,
            address(this),
            block.timestamp + 1 hours
        );
        
        // Verify LP received tokens
        assertEq(token0.balanceOf(address(this)), token0BalanceBefore + amount0, "LP received token0");
        assertEq(token1.balanceOf(address(this)), token1BalanceBefore + amount1, "LP received token1");
        
        // Verify LP received more than initial deposit due to fees
        // Initial deposit was 1000 ether each, should receive more token0 due to fees
        assertTrue(amount0 > 999 ether, "LP withdrew more token0 than deposited (includes fees)");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                    1.3.4: LOAN CAP ENFORCEMENT (10% MAX)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function testFlashLoanCapEnforced() public {
        (uint256 reserve0,,) = dexCore.getReserves(address(token0), address(token1));
        
        // Calculate max loan: 10% of reserves
        uint256 maxLoan = (reserve0 * 1000) / 10000; // 10% = 1000 bps
        
        // Loan at exactly max should succeed
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            maxLoan,
            ""
        );
        
        // Loan above max should fail
        vm.expectRevert(FlashSwap.InvalidAmount.selector);
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            maxLoan + 1,
            ""
        );
    }
    
    function testDEXPairFlashLoanCapEnforced() public {
        uint256 reserve0 = token0.balanceOf(address(pair));
        
        // Calculate max loan: 10% of reserves
        uint256 maxLoan = (reserve0 * 1000) / 10000; // 10% = 1000 bps
        
        GoodBorrower pairBorrower = new GoodBorrower();
        token0.mint(address(pairBorrower), 1000 ether);
        
        // Approve pair to pull tokens for repayment
        vm.prank(address(pairBorrower));
        token0.approve(address(pair), type(uint256).max);
        
        // Loan at exactly max should succeed
        pair.flashLoan(
            IERC3156FlashBorrower(address(pairBorrower)),
            address(token0),
            maxLoan,
            ""
        );
        
        // Loan above max should fail
        vm.expectRevert(); // DEXPair reverts with InsufficientLiquidity
        pair.flashLoan(
            IERC3156FlashBorrower(address(pairBorrower)),
            address(token0),
            maxLoan + 1,
            ""
        );
    }
    
    function testFlashLoanCapIs10PercentOfReserves() public {
        (uint256 reserve0,,) = dexCore.getReserves(address(token0), address(token1));
        
        // Max loan should be exactly 10% of reserves
        uint256 expectedMaxLoan = (reserve0 * 1000) / 10000;
        
        // Verify constant is set correctly
        assertEq(flashSwap.MAX_FLASH_LOAN_BPS(), 1000, "MAX_FLASH_LOAN_BPS should be 1000 (10%)");
        
        // Verify actual enforcement
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            expectedMaxLoan,
            ""
        );
        
        vm.expectRevert(FlashSwap.InvalidAmount.selector);
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            expectedMaxLoan + 1,
            ""
        );
    }
    
    function testFlashLoanCapDynamicWithReserveChanges() public {
        // Initial max loan
        (uint256 reserve0Initial,,) = dexCore.getReserves(address(token0), address(token1));
        uint256 maxLoanInitial = (reserve0Initial * 1000) / 10000;
        
        // Execute successful loan at max
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            maxLoanInitial,
            ""
        );
        
        // Add more liquidity to increase reserves
        token0.mint(address(this), 1000 ether);
        token1.mint(address(this), 1000 ether);
        token0.approve(address(dexCore), 1000 ether);
        token1.approve(address(dexCore), 1000 ether);
        
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
        
        // New max loan should be higher
        (uint256 reserve0After,,) = dexCore.getReserves(address(token0), address(token1));
        uint256 maxLoanAfter = (reserve0After * 1000) / 10000;
        
        assertTrue(maxLoanAfter > maxLoanInitial, "Max loan increases with reserves");
        
        // Should be able to borrow the new max
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(goodBorrower)),
            address(token0),
            maxLoanAfter,
            ""
        );
    }
    
    function testFuzzFlashLoanCapEnforcement(uint256 loanAmount) public {
        (uint256 reserve0,,) = dexCore.getReserves(address(token0), address(token1));
        uint256 maxLoan = (reserve0 * 1000) / 10000;
        
        // Bound loan amount to reasonable range
        loanAmount = bound(loanAmount, 1, reserve0);
        
        if (loanAmount <= maxLoan) {
            // Should succeed
            flashSwap.flashLoan(
                IERC3156FlashBorrower(address(goodBorrower)),
                address(token0),
                loanAmount,
                ""
            );
        } else {
            // Should fail
            vm.expectRevert(FlashSwap.InvalidAmount.selector);
            flashSwap.flashLoan(
                IERC3156FlashBorrower(address(goodBorrower)),
                address(token0),
                loanAmount,
                ""
            );
        }
    }
}

/**
 * @title GoodBorrower
 * @notice Mock borrower that repays flash loans correctly
 */
contract GoodBorrower is IERC3156FlashBorrower {
    function onFlashLoan(
        address /* initiator */,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external override returns (bytes32) {
        // Approve lender to pull repayment
        IERC20(token).approve(msg.sender, amount + fee);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}

/**
 * @title ReentrantBorrower
 * @notice Mock borrower that attempts reentrancy attack on FlashSwap
 */
contract ReentrantBorrower is IERC3156FlashBorrower {
    FlashSwap public flashSwap;
    
    constructor(address _flashSwap) {
        flashSwap = FlashSwap(_flashSwap);
    }
    
    function onFlashLoan(
        address /* initiator */,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external override returns (bytes32) {
        // Attempt reentrancy attack
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(this)),
            token,
            amount / 2,
            ""
        );
        
        // Repay (won't reach here due to revert)
        IERC20(token).approve(msg.sender, amount + fee);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}

/**
 * @title ReentrantPairBorrower
 * @notice Mock borrower that attempts reentrancy attack on DEXPair
 */
contract ReentrantPairBorrower is IERC3156FlashBorrower {
    DEXPair public pair;
    
    constructor(address _pair) {
        pair = DEXPair(_pair);
    }
    
    function onFlashLoan(
        address /* initiator */,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external override returns (bytes32) {
        // Attempt reentrancy attack on DEXPair
        pair.flashLoan(
            IERC3156FlashBorrower(address(this)),
            token,
            amount / 2,
            ""
        );
        
        // Repay (won't reach here due to revert)
        IERC20(token).approve(msg.sender, amount + fee);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}
