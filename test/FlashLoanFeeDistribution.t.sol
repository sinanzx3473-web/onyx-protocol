// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/FlashSwap.sol";
import "../src/DexCore.sol";
import "../src/MockERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";

/**
 * @title FlashLoanFeeDistributionTest
 * @notice Test suite verifying flash loan fees are distributed to LPs
 */
contract FlashLoanFeeDistributionTest is Test {
    FlashSwap public flashSwap;
    DexCore public dexCore;
    MockERC20 public token0;
    MockERC20 public token1;
    
    MinimalForwarder public forwarder;
    address public owner;
    address public lpProvider1;
    address public lpProvider2;
    address public factory;
    address public weth;
    
    MockFlashBorrower public borrower;
    
    event FlashLoanFeeAdded(
        address indexed token0,
        address indexed token1,
        address indexed feeToken,
        uint256 feeAmount
    );
    
    function setUp() public {
        owner = address(this);
        lpProvider1 = address(0x1);
        lpProvider2 = address(0x2);
        
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
        dexCore.createPool(address(token0), address(token1));
        
        // Register pool in FlashSwap for fee distribution
        flashSwap.registerPool(address(token0), address(token1));
        
        // Add initial liquidity
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
        
        // Deploy borrower
        borrower = new MockFlashBorrower(true);
        
        // Mint tokens to borrower for repayment
        token0.mint(address(borrower), 1000 ether);
        token1.mint(address(borrower), 1000 ether);
        
        // Approve borrower to transfer tokens (for repayment)
        vm.prank(address(borrower));
        token0.approve(address(flashSwap), type(uint256).max);
        vm.prank(address(borrower));
        token1.approve(address(flashSwap), type(uint256).max);
        
        // Approve borrower
        flashSwap.approveBorrower(address(borrower));
    }
    
    function testFlashLoanFeesAddedToPoolReserves() public {
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        (uint256 reserve0Before,,) = dexCore.getReserves(address(token0), address(token1));
        
        vm.expectEmit(true, true, true, true);
        emit FlashLoanFeeAdded(address(token0), address(token1), address(token0), fee);
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(borrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        (uint256 reserve0After,,) = dexCore.getReserves(address(token0), address(token1));
        
        assertEq(reserve0After, reserve0Before + fee, "Pool reserves should increase by fee amount");
    }
    
    function testLPValueIncreasesWithFlashLoanFees() public {
        // Record initial reserves
        (uint256 reserve0Initial, uint256 reserve1Initial,) = dexCore.getReserves(address(token0), address(token1));
        
        // Execute flash loan
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(borrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        // Record reserves after fee
        (uint256 reserve0After, uint256 reserve1After,) = dexCore.getReserves(address(token0), address(token1));
        
        // Calculate LP value before and after
        uint256 valueBefore = reserve0Initial + reserve1Initial;
        uint256 valueAfter = reserve0After + reserve1After;
        
        assertEq(valueAfter, valueBefore + fee, "Total pool value should increase by fee");
        
        // Verify reserves increased by fee amount
        assertEq(reserve0After, reserve0Initial + fee, "Reserve0 should increase by fee");
        assertEq(reserve1After, reserve1Initial, "Reserve1 should remain unchanged");
    }
    
    function testMultipleFlashLoansAccumulateFees() public {
        uint256 loanAmount = 50 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        (uint256 reserve0Initial,,) = dexCore.getReserves(address(token0), address(token1));
        
        // Execute 5 flash loans
        for (uint256 i = 0; i < 5; i++) {
            flashSwap.flashLoan(
                IERC3156FlashBorrower(address(borrower)),
                address(token0),
                loanAmount,
                ""
            );
        }
        
        (uint256 reserve0Final,,) = dexCore.getReserves(address(token0), address(token1));
        
        assertEq(reserve0Final, reserve0Initial + (fee * 5), "Reserves should increase by total fees");
    }
    
    function testNoFeesStuckInFlashSwapContract() public {
        uint256 loanAmount = 100 ether;
        
        uint256 flashSwapBalanceBefore = token0.balanceOf(address(flashSwap));
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(borrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        uint256 flashSwapBalanceAfter = token0.balanceOf(address(flashSwap));
        
        assertEq(flashSwapBalanceAfter, flashSwapBalanceBefore, "No fees should remain in FlashSwap contract");
    }
    
    function testFeeDistributionBenefitsAllLPs() public {
        // Add second LP provider
        token0.mint(lpProvider1, 1000 ether);
        token1.mint(lpProvider1, 1000 ether);
        
        vm.startPrank(lpProvider1);
        token0.approve(address(dexCore), 1000 ether);
        token1.approve(address(dexCore), 1000 ether);
        
        dexCore.addLiquidity(
            address(token0),
            address(token1),
            500 ether,
            500 ether,
            499 ether,
            499 ether,
            lpProvider1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Execute flash loan
        uint256 loanAmount = 100 ether;
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(borrower)),
            address(token0),
            loanAmount,
            ""
        );
        
        // Both LPs should benefit from increased pool value
        address lpToken = dexCore.lpTokens(address(token0), address(token1));
        uint256 lpBalance1 = IERC20(lpToken).balanceOf(address(this));
        uint256 lpBalance2 = IERC20(lpToken).balanceOf(lpProvider1);
        
        assertTrue(lpBalance1 > 0, "LP1 should have LP tokens");
        assertTrue(lpBalance2 > 0, "LP2 should have LP tokens");
        
        // Pool value increased, so both LP positions are worth more
        (uint256 reserve0,,) = dexCore.getReserves(address(token0), address(token1));
        assertTrue(reserve0 > 1500 ether, "Pool reserves should include fees");
    }
    
    function testFeeDistributionWithToken1() public {
        // Test fee distribution when borrowing token1
        token1.mint(address(borrower), 1000 ether);
        
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token1), loanAmount);
        
        (,uint256 reserve1Before,) = dexCore.getReserves(address(token0), address(token1));
        
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(borrower)),
            address(token1),
            loanAmount,
            ""
        );
        
        (,uint256 reserve1After,) = dexCore.getReserves(address(token0), address(token1));
        
        assertEq(reserve1After, reserve1Before + fee, "Token1 reserves should increase by fee");
    }
    
    function testFeeCalculationCorrect() public {
        uint256 loanAmount = 100 ether;
        uint256 fee = flashSwap.flashFee(address(token0), loanAmount);
        
        // 0.09% fee = 9 basis points
        uint256 expectedFee = (loanAmount * 9) / 10000;
        
        assertEq(fee, expectedFee, "Fee should be 0.09% of loan amount");
        assertEq(fee, 0.09 ether, "Fee should be 0.09 ETH for 100 ETH loan");
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
        address /* initiator */,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external override returns (bytes32) {
        if (shouldSucceed) {
            // Approve lender to pull repayment
            IERC20(token).approve(msg.sender, amount + fee);
            return keccak256("ERC3156FlashBorrower.onFlashLoan");
        } else {
            return bytes32(0);
        }
    }
}
