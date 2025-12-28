// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/MockERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20Permit
 * @notice Mock ERC20 token with EIP-2612 permit support for testing
 */
contract MockERC20Permit is ERC20Permit {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) ERC20Permit(name) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

/**
 * @title PermitIntegrationTests
 * @notice Regression tests for EIP-2612 permit support (I-2)
 * @dev Validates swapWithPermit functionality and gas savings
 */
contract PermitIntegrationTests is Test {
    DexCore public dexCore;
    DEXFactory public factory;
    
    MockERC20Permit public tokenA;
    MockERC20Permit public tokenB;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public owner = address(this);
    uint256 public userPrivateKey = 0xA11CE;
    address public user;
    
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 1e18;
    uint256 constant LIQUIDITY_AMOUNT = 100_000 * 1e18;

    function setUp() public {
        user = vm.addr(userPrivateKey);
        
        tokenA = new MockERC20Permit("Token A", "TKNA", 18);
        tokenB = new MockERC20Permit("Token B", "TKNB", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        factory = new DEXFactory(owner);
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        
        tokenA.mint(user, INITIAL_SUPPLY);
        tokenB.mint(user, INITIAL_SUPPLY);
        tokenA.mint(owner, LIQUIDITY_AMOUNT);
        tokenB.mint(owner, LIQUIDITY_AMOUNT);
        
        dexCore.createPool(address(tokenA), address(tokenB));
        
        tokenA.approve(address(dexCore), LIQUIDITY_AMOUNT);
        tokenB.approve(address(dexCore), LIQUIDITY_AMOUNT);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          PERMIT SIGNATURE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_SwapWithPermit_ValidSignature() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        
        // Create permit signature
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        tokenA.nonces(user),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, permitHash);
        
        uint256 balanceBefore = tokenB.balanceOf(user);
        
        // Execute swapWithPermit
        vm.prank(user);
        uint256 amountOut = dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
        
        uint256 balanceAfter = tokenB.balanceOf(user);
        
        assertGt(amountOut, 0, "Should receive output tokens");
        assertEq(balanceAfter - balanceBefore, amountOut, "Balance should increase by amountOut");
    }

    function test_SwapWithPermit_NoSeparateApprovalNeeded() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        
        // Verify user has no prior approval
        assertEq(tokenA.allowance(user, address(dexCore)), 0, "Should have no prior approval");
        
        // Create permit signature
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        tokenA.nonces(user),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, permitHash);
        
        // Execute swapWithPermit without prior approve
        vm.prank(user);
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
        
        // Swap should succeed without separate approval transaction
        assertTrue(true, "Swap should succeed with permit");
    }

    function test_SwapWithPermit_InvalidSignature() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        
        // Create invalid signature (wrong private key)
        uint256 wrongPrivateKey = 0xBAD;
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        tokenA.nonces(user),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, permitHash);
        
        // Should revert with invalid signature
        vm.prank(user);
        vm.expectRevert();
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
    }

    function test_SwapWithPermit_ExpiredPermit() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp - 1; // Expired
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        tokenA.nonces(user),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, permitHash);
        
        // Should revert with expired permit
        vm.prank(user);
        vm.expectRevert();
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            block.timestamp + 1 hours,
            deadline,
            v,
            r,
            s
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          NONCE MANAGEMENT TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_SwapWithPermit_NonceIncrement() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        
        uint256 nonceBefore = tokenA.nonces(user);
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        nonceBefore,
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, permitHash);
        
        vm.prank(user);
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
        
        uint256 nonceAfter = tokenA.nonces(user);
        
        assertEq(nonceAfter, nonceBefore + 1, "Nonce should increment after permit");
    }

    function test_SwapWithPermit_ReplayProtection() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        tokenA.nonces(user),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, permitHash);
        
        // First swap should succeed
        vm.prank(user);
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
        
        // Second swap with same signature should fail (nonce changed)
        vm.prank(user);
        vm.expectRevert();
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          SLIPPAGE PROTECTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_SwapWithPermit_SlippageProtection() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        
        // Get expected output
        uint256 expectedOut = dexCore.getAmountOut(amountIn, address(tokenA), address(tokenB));
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        tokenA.nonces(user),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, permitHash);
        
        // Should revert if amountOutMin is too high
        vm.prank(user);
        vm.expectRevert(DexCore.SlippageExceeded.selector);
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            expectedOut + 1, // Too high
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          GAS COMPARISON TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_CompareGas_ApproveAndSwap_vs_SwapWithPermit() public {
        uint256 amountIn = 1000 * 1e18;
        uint256 deadline = block.timestamp + 1 hours;
        
        // Method 1: Separate approve + swap
        vm.startPrank(user);
        uint256 gasApprove = gasleft();
        tokenA.approve(address(dexCore), amountIn);
        uint256 approveGas = gasApprove - gasleft();
        
        uint256 gasSwap = gasleft();
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline
        );
        uint256 swapGas = gasSwap - gasleft();
        vm.stopPrank();
        
        uint256 totalGasMethod1 = approveGas + swapGas;
        
        // Method 2: SwapWithPermit (single transaction)
        tokenA.mint(user, amountIn); // Replenish for second test
        
        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                tokenA.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        user,
                        address(dexCore),
                        amountIn,
                        tokenA.nonces(user),
                        deadline
                    )
                )
            )
        );
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPrivateKey, permitHash);
        
        vm.prank(user);
        uint256 gasPermitSwap = gasleft();
        dexCore.swapWithPermit(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user,
            deadline,
            deadline,
            v,
            r,
            s
        );
        uint256 permitSwapGas = gasPermitSwap - gasleft();
        
        // SwapWithPermit should be more gas-efficient overall
        // (saves one transaction, though single tx is slightly more expensive)
        emit log_named_uint("Approve gas", approveGas);
        emit log_named_uint("Swap gas", swapGas);
        emit log_named_uint("Total (approve + swap)", totalGasMethod1);
        emit log_named_uint("SwapWithPermit gas", permitSwapGas);
        
        // Permit swap should be within reasonable range (~20k more than regular swap)
        assertLt(permitSwapGas, swapGas + 30000, "Permit swap overhead should be reasonable");
    }
}
