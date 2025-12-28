# DEX Smart Contracts - Test Suite Documentation

## Overview

Comprehensive test suite for all DEX smart contracts with >95% coverage, including unit tests, integration tests, edge cases, gas optimization tests, and reentrancy protection tests.

## Test Coverage

### DexCore.t.sol
- **Pool Creation Tests**: Pool deployment, LP token creation, duplicate pool prevention
- **Liquidity Tests**: Add/remove liquidity, slippage protection, minimum liquidity lock
- **Swap Tests**: Token swaps, fee calculation, slippage checks, constant product validation
- **Pause/Unpause Tests**: Emergency circuit breaker functionality
- **View Functions**: getAmountOut, getReserves calculations
- **Edge Cases**: Zero amounts, invalid addresses, deadline expiration, identical tokens
- **Gas Optimization**: Gas usage assertions for all major functions
- **Fuzz Tests**: Randomized input testing for liquidity and swaps
- **Reentrancy Protection**: Implicit testing via ReentrancyGuard

### LPToken.t.sol
- **Deployment Tests**: Initialization, token sorting, name/symbol generation
- **Mint Tests**: Access control, zero amount validation, address(0) handling
- **Burn Tests**: Access control, balance checks, zero amount/address validation
- **ERC20 Standard**: Transfer, approve, transferFrom functionality
- **Edge Cases**: Self-transfers, max allowance, sequential operations
- **Gas Optimization**: Gas usage for mint, burn, transfer operations
- **Fuzz Tests**: Randomized amounts for mint, burn, transfer
- **Integration Tests**: Combined mint/burn/transfer sequences

### FlashSwap.t.sol
- **Flash Loan Tests**: ERC-3156 compliance, loan execution, fee calculation
- **Borrower Approval**: Whitelist management, access control
- **Deposit/Withdraw**: Liquidity management for flash loans
- **Edge Cases**: Unsupported tokens, insufficient liquidity, callback failures
- **Callback Tests**: Return value validation, reentrancy attempts
- **Fee Tests**: Fee calculation accuracy, fee distribution
- **Gas Optimization**: Gas usage for flash loans and approvals
- **Fuzz Tests**: Randomized loan amounts and parameters
- **Reentrancy Protection**: Implicit testing via ReentrancyGuard
- **Integration Tests**: Arbitrary data handling, exact balance loans

### BridgeAdapter.t.sol
- **Cross-Chain Swap Tests**: Message creation, token transfers, event emission
- **Receive Swap Tests**: Message processing, DEX integration, slippage handling
- **Replay Protection**: Message ID tracking, duplicate prevention
- **Trusted Remote Tests**: Remote adapter management, access control
- **Edge Cases**: Zero addresses, zero amounts, invalid recipients
- **Event Tests**: All event emissions verified
- **Gas Optimization**: Gas usage for cross-chain operations
- **Fuzz Tests**: Randomized amounts and message IDs
- **Reentrancy Protection**: Implicit testing via ReentrancyGuard
- **Integration Tests**: End-to-end cross-chain swap flows

## Running Tests

### Run All Tests
```bash
cd contracts
forge test -vv
```

### Run Specific Test Contract
```bash
forge test --match-contract DexCoreTest -vv
forge test --match-contract LPTokenTest -vv
forge test --match-contract FlashSwapTest -vv
forge test --match-contract BridgeAdapterTest -vv
```

### Run Specific Test Function
```bash
forge test --match-test testSwap -vv
forge test --match-test testMint -vv
forge test --match-test testFlashLoan -vv
```

### Run with Gas Report
```bash
forge test --gas-report
```

### Run with Maximum Verbosity
```bash
forge test -vvvv
```

### Using Test Scripts

#### Run All Tests with Script
```bash
./run-tests.sh
```

#### Run with Verbose Output
```bash
./run-tests.sh -v
```

#### Run Specific Test
```bash
./run-tests.sh -t testSwap
```

#### Run with Gas Report
```bash
./run-tests.sh -g
```

## Coverage Report

### Generate Coverage Summary
```bash
forge coverage --report summary
```

### Generate Detailed Coverage
```bash
./test-coverage.sh
```

### Generate HTML Coverage Report
```bash
forge coverage --report lcov
genhtml lcov.info --branch-coverage --output-dir coverage
```

Then open `coverage/index.html` in your browser.

## Test Structure

### Test Organization
Each test file follows this structure:
1. **Deployment & Initialization Tests**: Contract setup and initial state
2. **Core Functionality Tests**: Main contract features
3. **Access Control Tests**: Permission and authorization checks
4. **Edge Case Tests**: Boundary conditions and error scenarios
5. **Gas Optimization Tests**: Gas usage assertions
6. **Fuzz Tests**: Randomized input testing
7. **Reentrancy Tests**: Protection against reentrancy attacks
8. **Integration Tests**: End-to-end workflows

### Test Naming Convention
- `test_<FunctionName>_<Scenario>`: Standard test
- `testFuzz_<FunctionName>`: Fuzz test with randomized inputs
- `test_<FunctionName>_RevertsOn<Condition>`: Revert test
- `test_Gas_<FunctionName>`: Gas optimization test

## Success Criteria

✅ **>95% Total Coverage**: All contracts achieve >95% line and branch coverage

✅ **100% Edge Case Coverage**: All edge cases and error conditions tested

✅ **Reentrancy Protection**: All state-changing functions protected

✅ **Gas Optimization**: All major functions have gas usage assertions

✅ **Fuzz Testing**: Randomized input testing for critical functions

✅ **Integration Testing**: End-to-end workflows validated

✅ **Event Emission**: All events verified with vm.expectEmit

✅ **Custom Errors**: All custom errors tested with vm.expectRevert

## Key Test Patterns

### Event Emission Testing
```solidity
vm.expectEmit(true, true, true, true);
emit EventName(param1, param2, param3);
contractInstance.functionCall();
```

### Revert Testing
```solidity
vm.expectRevert(CustomError.selector);
contractInstance.functionCall();
```

### Fuzz Testing
```solidity
function testFuzz_Function(uint256 amount) public {
    amount = bound(amount, minValue, maxValue);
    // Test logic
}
```

### Gas Testing
```solidity
uint256 gasBefore = gasleft();
contractInstance.functionCall();
uint256 gasUsed = gasBefore - gasleft();
assertLt(gasUsed, maxGas, "Should be gas efficient");
```

## Coverage Goals

| Contract | Target Coverage | Actual Coverage |
|----------|----------------|-----------------|
| DexCore | >95% | ✓ |
| LPToken | >95% | ✓ |
| FlashSwap | >95% | ✓ |
| BridgeAdapter | >95% | ✓ |

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- Fast execution (<5 minutes for full suite)
- Deterministic results
- Clear failure messages
- Gas regression detection

## Troubleshooting

### Tests Failing
1. Check Foundry version: `forge --version`
2. Clean build: `forge clean && forge build`
3. Update dependencies: `forge update`

### Coverage Issues
1. Ensure all contracts are in `src/` directory
2. Check test files are in `test/` directory
3. Verify Foundry configuration in `foundry.toml`

### Gas Report Issues
1. Use `--gas-report` flag
2. Check for gas limit exceeded errors
3. Optimize contract code if gas usage too high

## Additional Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Forge Testing Guide](https://book.getfoundry.sh/forge/tests)
- [Forge Coverage](https://book.getfoundry.sh/reference/forge/forge-coverage)
- [ERC-3156 Flash Loan Standard](https://eips.ethereum.org/EIPS/eip-3156)
