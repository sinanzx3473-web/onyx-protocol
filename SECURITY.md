# Security Documentation

## Overview
This document provides comprehensive security guidance, operational procedures, and upgrade plans for the DEX smart contract system.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Security Features](#security-features)
3. [Operational Procedures](#operational-procedures)
4. [Emergency Response](#emergency-response)
5. [Upgrade Plans](#upgrade-plans)
6. [Audit Findings & Remediations](#audit-findings--remediations)
7. [Testing & Verification](#testing--verification)

---

## Architecture Overview

### Core Contracts
- **DEXFactory**: Creates and manages trading pairs
- **DEXPair**: AMM pool implementing constant product formula (x*y=k)
- **DEXRouter**: User-facing interface with slippage protection
- **DexCore**: Centralized liquidity management with flash loan support
- **FlashSwap**: ERC-3156 compliant flash loan provider with borrower whitelist

### Security Model
```
┌─────────────────────────────────────────────────────────────┐
│                     Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Access Control (Ownable, Pausable)                       │
│ 2. Reentrancy Protection (ReentrancyGuard)                  │
│ 3. Input Validation (require/revert checks)                 │
│ 4. Flash Loan Limits (10% per transaction)                  │
│ 5. Slippage Protection (Router-level)                       │
│ 6. Borrower Whitelist (FlashSwap)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Features

### 1. Flash Loan Protection

#### Per-Transaction Limits
**Implementation**: Both `FlashSwap.sol` and `DEXPair.sol` enforce 10% maximum per transaction.

```solidity
// FlashSwap.sol
uint256 public constant MAX_FLASH_LOAN_BPS = 1000; // 10%
uint256 maxLoan = (poolReserve * MAX_FLASH_LOAN_BPS) / FEE_DENOMINATOR;
require(amount <= maxLoan, "Exceeds per-tx flash loan limit");

// DEXPair.sol
uint256 public constant MAX_FLASH_LOAN_BPS = 1000; // 10%
uint256 maxLoan = (balanceBefore * MAX_FLASH_LOAN_BPS) / FEE_DENOMINATOR;
require(amount <= maxLoan, "Exceeds per-tx flash loan limit");
```

**Purpose**: Prevents liquidity drainage attacks and ensures pool stability.

**Configuration**:
- Default: 10% of pool reserves
- Hardcoded constant (requires contract upgrade to modify)
- Applies per transaction, not per block

#### Borrower Whitelist (FlashSwap)
**Implementation**: Only approved contracts can execute flash loans.

```solidity
mapping(address => bool) public approvedBorrowers;

function approveBorrower(address borrower) external onlyOwner {
    approvedBorrowers[borrower] = true;
    emit BorrowerApproved(borrower);
}

function revokeBorrower(address borrower) external onlyOwner {
    approvedBorrowers[borrower] = false;
    emit BorrowerRevoked(borrower);
}
```

**Operational Procedure**:
1. Audit borrower contract code thoroughly
2. Verify callback implementation follows ERC-3156
3. Test on testnet with small amounts
4. Approve via `approveBorrower(address)`
5. Monitor flash loan activity
6. Revoke immediately if suspicious activity detected

### 2. Reentrancy Protection

**Implementation**: All state-changing functions use `nonReentrant` modifier.

**Protected Functions**:
- `DEXPair.mint()`, `burn()`, `swap()`, `flashLoan()`
- `DexCore.addLiquidity()`, `removeLiquidity()`, `swap()`, `flashLoan()`
- `FlashSwap.flashLoan()`
- `DEXRouter.addLiquidity()`, `removeLiquidity()`, `swapExactTokensForTokens()`, etc.

**Pattern**: Checks-Effects-Interactions (CEI)
```solidity
// 1. CHECKS: Validate inputs
require(amount > 0, "Invalid amount");

// 2. EFFECTS: Update state
balance[msg.sender] -= amount;

// 3. INTERACTIONS: External calls
token.safeTransfer(recipient, amount);
```

### 3. Access Control

#### Owner Privileges
**DEXFactory**:
- `setFeeTo(address)`: Set protocol fee recipient
- No pause mechanism (immutable after deployment)

**DexCore**:
- `pause()`/`unpause()`: Emergency circuit breaker
- `setFlashSwap(address)`: Configure flash loan provider
- `setFeeRecipient(address)`: Set fee destination

**FlashSwap**:
- `approveBorrower(address)`: Whitelist flash loan contracts
- `revokeBorrower(address)`: Remove borrower access
- `registerPool(address, address)`: Map tokens to pools
- `setMaxFlashLoan(address, uint256)`: Override default limits
- `withdraw(address, uint256)`: Emergency token recovery

**DEXRouter**:
- `pause()`/`unpause()`: Disable all trading operations
- No token withdrawal (stateless design)

#### Ownership Transfer
**Procedure**:
1. Verify new owner address (multi-sig recommended)
2. Test on testnet first
3. Call `transferOwnership(newOwner)`
4. New owner calls `acceptOwnership()` (2-step process)
5. Verify ownership transfer via `owner()` view function

### 4. Pausability

**Contracts with Pause**:
- `DexCore`: Pauses all liquidity operations and swaps
- `DEXRouter`: Pauses all user-facing operations

**Emergency Pause Procedure**:
```bash
# 1. Detect threat (e.g., exploit, oracle manipulation)
# 2. Immediately pause affected contracts
cast send $DEXCORE_ADDRESS "pause()" --private-key $OWNER_KEY

# 3. Investigate root cause
# 4. Deploy fix if needed
# 5. Unpause after verification
cast send $DEXCORE_ADDRESS "unpause()" --private-key $OWNER_KEY
```

**Note**: `DEXPair` and `DEXFactory` are NOT pausable (immutable design).

### 5. Slippage Protection

**Implementation**: Router enforces minimum output amounts.

```solidity
function swapExactTokensForTokens(
    uint256 amountIn,
    uint256 amountOutMin, // User-specified minimum
    address[] calldata path,
    address to,
    uint256 deadline
) external returns (uint256[] memory amounts) {
    // Calculate expected output
    amounts = getAmountsOut(amountIn, path);
    
    // Enforce minimum
    require(amounts[amounts.length - 1] >= amountOutMin, "Insufficient output");
    
    // Execute swap
    // ...
}
```

**User Guidance**:
- Always use Router, never call Pair directly
- Set `amountOutMin` to 95-99% of expected output
- Use `deadline` parameter (typically `block.timestamp + 300`)

---

## Operational Procedures

### Contract Deployment Checklist

#### Pre-Deployment
- [ ] All tests passing (`forge test`)
- [ ] Gas optimization review
- [ ] Security audit completed
- [ ] Testnet deployment successful
- [ ] Multi-sig wallet prepared for ownership

#### Deployment Sequence
```bash
# 1. Deploy Factory
forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast

# 2. Verify contracts on Etherscan
forge verify-contract $FACTORY_ADDRESS DEXFactory --chain-id $CHAIN_ID

# 3. Deploy Router (requires Factory address)
# 4. Deploy DexCore
# 5. Deploy FlashSwap (requires DexCore address)

# 6. Configure relationships
cast send $DEXCORE_ADDRESS "setFlashSwap(address)" $FLASHSWAP_ADDRESS

# 7. Transfer ownership to multi-sig
cast send $DEXCORE_ADDRESS "transferOwnership(address)" $MULTISIG_ADDRESS
```

#### Post-Deployment
- [ ] Verify all contract addresses
- [ ] Test basic operations (add liquidity, swap, remove liquidity)
- [ ] Monitor initial transactions
- [ ] Update frontend configuration
- [ ] Announce deployment to community

### Flash Loan Borrower Approval

#### Approval Checklist
- [ ] **Code Audit**: Review borrower contract source code
- [ ] **ERC-3156 Compliance**: Verify `onFlashLoan()` callback implementation
- [ ] **Repayment Logic**: Ensure principal + fee is always repaid
- [ ] **No Reentrancy**: Check for reentrancy vulnerabilities
- [ ] **Testnet Testing**: Execute test flash loans with small amounts
- [ ] **Monitoring Setup**: Configure alerts for borrower activity
- [ ] **Approval**: Call `approveBorrower(address)`

#### Revocation Procedure
```bash
# Immediate revocation if suspicious activity detected
cast send $FLASHSWAP_ADDRESS "revokeBorrower(address)" $BORROWER_ADDRESS --private-key $OWNER_KEY

# Verify revocation
cast call $FLASHSWAP_ADDRESS "isBorrowerApproved(address)" $BORROWER_ADDRESS
# Should return: false
```

### Pool Registration (FlashSwap)

**Purpose**: Enable flash loan fee distribution to correct LP pools.

```bash
# Register token pair for fee distribution
cast send $FLASHSWAP_ADDRESS "registerPool(address,address)" $TOKEN0 $TOKEN1 --private-key $OWNER_KEY

# Verify registration
cast call $FLASHSWAP_ADDRESS "tokenPools(address,address)" $TOKEN0 $TOKEN0
# Should return: $TOKEN1 address
```

### Fee Configuration

#### Protocol Fee (DEXFactory)
```bash
# Set protocol fee recipient (0.05% of 0.3% swap fee)
cast send $FACTORY_ADDRESS "setFeeTo(address)" $FEE_RECIPIENT --private-key $OWNER_KEY

# Disable protocol fee
cast send $FACTORY_ADDRESS "setFeeTo(address)" 0x0000000000000000000000000000000000000000
```

#### Flash Loan Fee Recipient (DexCore)
```bash
# Set flash loan fee recipient
cast send $DEXCORE_ADDRESS "setFeeRecipient(address)" $FEE_RECIPIENT --private-key $OWNER_KEY
```

---

## Emergency Response

### Incident Response Plan

#### Phase 1: Detection (0-5 minutes)
1. **Monitoring Alerts**: Set up alerts for:
   - Unusual flash loan activity
   - Large liquidity withdrawals
   - Price oracle deviations
   - Failed transactions spike

2. **Immediate Assessment**:
   - Identify affected contracts
   - Estimate potential loss
   - Determine attack vector

#### Phase 2: Containment (5-15 minutes)
1. **Pause Affected Contracts**:
```bash
# Pause DexCore (stops all liquidity operations)
cast send $DEXCORE_ADDRESS "pause()" --private-key $OWNER_KEY

# Pause Router (stops all user swaps)
cast send $ROUTER_ADDRESS "pause()" --private-key $OWNER_KEY
```

2. **Revoke Malicious Borrowers**:
```bash
cast send $FLASHSWAP_ADDRESS "revokeBorrower(address)" $MALICIOUS_BORROWER
```

3. **Communication**:
   - Notify team via emergency channel
   - Prepare public statement
   - Contact security partners

#### Phase 3: Investigation (15 minutes - 24 hours)
1. **Root Cause Analysis**:
   - Review transaction logs
   - Analyze attack pattern
   - Identify vulnerability

2. **Impact Assessment**:
   - Calculate total loss
   - Identify affected users
   - Determine recovery options

#### Phase 4: Resolution (24-72 hours)
1. **Deploy Fix**:
   - Develop and test patch
   - Deploy new contracts if needed
   - Migrate liquidity if required

2. **Recovery**:
   - Unpause contracts
   - Compensate affected users (if applicable)
   - Update documentation

#### Phase 5: Post-Mortem (1 week)
1. **Documentation**:
   - Write detailed incident report
   - Update security procedures
   - Implement additional safeguards

2. **Communication**:
   - Publish post-mortem
   - Announce improvements
   - Restore community confidence

### Emergency Contacts
```
Security Team Lead: [CONTACT]
Smart Contract Auditor: [CONTACT]
Multi-Sig Signers: [CONTACTS]
Community Manager: [CONTACT]
```

---

## Upgrade Plans

### Current Architecture: Non-Upgradeable

**Rationale**: Immutability provides security guarantees and user trust.

**Contracts**:
- `DEXFactory`: Immutable
- `DEXPair`: Immutable (created by Factory)
- `DEXRouter`: Immutable
- `DexCore`: Immutable
- `FlashSwap`: Immutable

### Migration Strategy (If Upgrade Needed)

#### Option 1: New Deployment + Liquidity Migration
**Use Case**: Critical vulnerability or major feature addition

**Procedure**:
1. Deploy new contract versions
2. Pause old contracts
3. Provide migration UI for LPs
4. Incentivize migration (e.g., fee discounts)
5. Gradually deprecate old contracts

**Timeline**: 2-4 weeks

#### Option 2: Proxy Pattern (Future Versions)
**Use Case**: Frequent upgrades needed

**Implementation**:
```solidity
// Use OpenZeppelin UUPS or Transparent Proxy
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract DexCoreV2 is UUPSUpgradeable, Ownable {
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

**Trade-offs**:
- ✅ Seamless upgrades
- ✅ Preserve liquidity
- ❌ Increased complexity
- ❌ Centralization risk

### Deprecation Procedure

**Scenario**: Migrating from V1 to V2

1. **Announcement** (T-30 days):
   - Publish migration plan
   - Explain benefits of V2
   - Set migration deadline

2. **Migration Period** (T-30 to T-0):
   - Deploy V2 contracts
   - Provide migration tools
   - Offer incentives (e.g., 0% fees for 1 week)

3. **Deprecation** (T+0):
   - Pause V1 contracts
   - Disable new liquidity additions
   - Allow withdrawals only

4. **Sunset** (T+90 days):
   - Final withdrawal deadline
   - Remaining funds sent to governance treasury
   - Archive V1 contracts

---

## Audit Findings & Remediations

### Critical Issues

#### ✅ RESOLVED: Flash Loan Per-Transaction Limits
**Finding**: No limit on flash loan size could drain pool liquidity.

**Remediation**:
```solidity
// FlashSwap.sol & DEXPair.sol
uint256 public constant MAX_FLASH_LOAN_BPS = 1000; // 10%

function flashLoan(...) {
    uint256 maxLoan = (poolReserve * MAX_FLASH_LOAN_BPS) / FEE_DENOMINATOR;
    require(amount <= maxLoan, "Exceeds per-tx flash loan limit");
}
```

**Testing**:
```bash
forge test --match-test testFlashLoanExceedsLimit
```

### High Issues

#### ✅ RESOLVED: Reentrancy Protection
**Finding**: External calls before state updates could enable reentrancy.

**Remediation**: Applied `nonReentrant` modifier to all state-changing functions.

**Verification**:
```bash
# Check all functions use nonReentrant
grep -r "nonReentrant" contracts/src/
```

### Medium Issues

#### ✅ RESOLVED: Slippage Protection
**Finding**: Direct Pair calls lack slippage protection.

**Remediation**: Router enforces `amountOutMin` and `deadline` parameters.

**User Guidance**: Always use Router, never call Pair directly.

### Informational Issues

#### 📝 DOCUMENTATION: NatSpec Coverage
**Finding**: Incomplete NatSpec documentation.

**Remediation**: This document + inline NatSpec in all contracts.

**Coverage**:
- [x] Contract-level documentation
- [x] Function-level NatSpec
- [x] Parameter descriptions
- [x] Return value documentation
- [x] Security notes
- [x] Gas cost estimates

---

## Testing & Verification

### Test Coverage Requirements

**Minimum Coverage**: 90% line coverage, 85% branch coverage

**Critical Paths**:
- [x] Flash loan limits enforcement
- [x] Reentrancy protection
- [x] Slippage protection
- [x] Access control
- [x] Pausability
- [x] Fee calculations
- [x] Liquidity math (x*y=k)

### Running Tests

```bash
# Full test suite
forge test

# With coverage
forge coverage

# Gas report
forge test --gas-report

# Specific test file
forge test --match-path test/FlashSwap.t.sol

# Specific test function
forge test --match-test testFlashLoanExceedsLimit

# Verbose output
forge test -vvv
```

### Invariant Testing

**Key Invariants**:
1. `reserve0 * reserve1 >= k` (constant product)
2. `totalSupply <= sqrt(reserve0 * reserve1)` (LP tokens)
3. `flashLoanAmount <= poolReserve * 10%` (flash loan limit)
4. `balanceAfter >= balanceBefore + fee` (flash loan repayment)

```solidity
// Example invariant test
function invariant_flashLoanLimit() public {
    uint256 poolReserve = token.balanceOf(address(dexCore));
    uint256 maxLoan = (poolReserve * 1000) / 10000; // 10%
    
    // Attempt flash loan exceeding limit should revert
    vm.expectRevert();
    flashSwap.flashLoan(borrower, address(token), maxLoan + 1, "");
}
```

### Mainnet Forking Tests

```bash
# Fork mainnet for realistic testing
forge test --fork-url $MAINNET_RPC_URL --fork-block-number 18000000

# Test against real tokens (USDC, WETH, etc.)
forge test --match-test testSwapUSDCForWETH --fork-url $MAINNET_RPC_URL
```

---

## Monitoring & Alerts

### Recommended Monitoring

#### On-Chain Metrics
- Total Value Locked (TVL)
- Daily trading volume
- Flash loan activity
- Failed transaction rate
- Gas price trends

#### Security Alerts
- Flash loan amount > 5% of pool
- Liquidity withdrawal > 20% in 1 hour
- Unusual borrower activity
- Price deviation > 10% from oracle
- Contract pause events

#### Tools
- **Tenderly**: Transaction monitoring and alerts
- **Defender**: Automated security monitoring
- **Dune Analytics**: Custom dashboards
- **The Graph**: Subgraph for historical data

### Alert Configuration

```javascript
// Example Tenderly alert
{
  "name": "Large Flash Loan Alert",
  "network": "mainnet",
  "contract": "0x...", // FlashSwap address
  "event": "FlashLoan",
  "conditions": [
    {
      "field": "amount",
      "operator": ">",
      "value": "1000000000000000000000" // 1000 tokens
    }
  ],
  "actions": [
    {
      "type": "webhook",
      "url": "https://your-alert-endpoint.com"
    }
  ]
}
```

---

## Appendix

### Contract Addresses (Example - Update After Deployment)

```
Network: Ethereum Mainnet
DEXFactory: 0x...
DEXRouter: 0x...
DexCore: 0x...
FlashSwap: 0x...

Network: Sepolia Testnet
DEXFactory: 0x...
DEXRouter: 0x...
DexCore: 0x...
FlashSwap: 0x...
```

### Multi-Sig Configuration

**Recommended Setup**:
- **Threshold**: 3-of-5 or 4-of-7
- **Signers**: Mix of team members, advisors, and community representatives
- **Wallet**: Gnosis Safe or similar

**Critical Operations Requiring Multi-Sig**:
- Ownership transfer
- Protocol fee changes
- Flash loan borrower approval
- Emergency pause
- Contract upgrades (if applicable)

### External Dependencies

**OpenZeppelin Contracts**: v5.1.0
- `Ownable.sol`: Access control
- `ReentrancyGuard.sol`: Reentrancy protection
- `Pausable.sol`: Circuit breaker
- `SafeERC20.sol`: Safe token transfers
- `IERC3156FlashLender.sol`: Flash loan standard

**Foundry**: Latest stable version
- Testing framework
- Deployment scripts
- Gas optimization

### Glossary

- **AMM**: Automated Market Maker
- **CEI**: Checks-Effects-Interactions pattern
- **LP**: Liquidity Provider
- **MEV**: Maximal Extractable Value
- **TWAP**: Time-Weighted Average Price
- **TVL**: Total Value Locked
- **Slippage**: Difference between expected and actual trade price

---

## Document Version

**Version**: 1.0.0  
**Last Updated**: 2025-11-20  
**Next Review**: 2025-12-20  

**Changelog**:
- 2025-11-20: Initial security documentation created
- Added flash loan limit documentation
- Added operational procedures
- Added emergency response plan
