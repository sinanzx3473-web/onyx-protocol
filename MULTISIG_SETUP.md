# Multi-Signature Wallet Setup Guide

## Overview
This guide provides step-by-step instructions for transferring ownership of all critical DEX contracts to a Gnosis Safe multi-signature wallet before mainnet deployment.

## Why Multi-Sig?
- **No Single Point of Failure**: Prevents any single party from pausing, withdrawing, or modifying critical protocol parameters
- **Enhanced Security**: Requires consensus from multiple trusted parties for sensitive operations
- **Transparency**: All ownership actions are publicly visible on-chain
- **Industry Standard**: Required best practice for DeFi protocols managing user funds

## Recommended Configuration
- **Wallet Type**: Gnosis Safe (Safe{Wallet})
- **Minimum Signers**: 3-of-5 configuration
- **Signer Distribution**: Ideally from different organizations/geographies
- **Threshold**: 60% (3 out of 5) for balance of security and operational efficiency

## Step-by-Step Implementation

### 1. Deploy Gnosis Safe

**Option A: Using Safe Web Interface**
1. Visit https://app.safe.global/
2. Connect wallet with deployment funds
3. Click "Create new Safe"
4. Select your target network (Ethereum, Polygon, BSC, etc.)
5. Add 5 signer addresses
6. Set threshold to 3
7. Review and deploy
8. Save the Safe address

**Option B: Using Safe CLI**
```bash
# Install Safe CLI
npm install -g @safe-global/safe-cli

# Create Safe with 3-of-5 configuration
safe-cli create \
  --owners 0xSigner1,0xSigner2,0xSigner3,0xSigner4,0xSigner5 \
  --threshold 3 \
  --network mainnet
```

### 2. Verify Safe Deployment
```bash
# Check Safe on block explorer
# Verify all signers are correct
# Confirm threshold is 3
# Test with a small transaction
```

### 3. Transfer Contract Ownership

**For Each Contract (DexCore, FlashSwap, BridgeAdapter, PriceOracle):**

```solidity
// Using Foundry script
forge script script/TransferOwnership.s.sol \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify

// Or using cast
cast send <CONTRACT_ADDRESS> \
  "transferOwnership(address)" <SAFE_ADDRESS> \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

**Contracts to Transfer:**
- ✅ DexCore
- ✅ FlashSwap
- ✅ BridgeAdapter
- ✅ PriceOracle
- ✅ DEXFactory (if deployed)

### 4. Create Transfer Script

```solidity
// script/TransferToMultisig.s.sol
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/DexCore.sol";
import "../src/FlashSwap.sol";
import "../src/BridgeAdapter.sol";
import "../src/PriceOracle.sol";

contract TransferToMultisig is Script {
    function run() external {
        address safeAddress = vm.envAddress("SAFE_ADDRESS");
        
        vm.startBroadcast();
        
        // Transfer DexCore
        DexCore dexCore = DexCore(vm.envAddress("DEXCORE_ADDRESS"));
        dexCore.transferOwnership(safeAddress);
        
        // Transfer FlashSwap
        FlashSwap flashSwap = FlashSwap(vm.envAddress("FLASHSWAP_ADDRESS"));
        flashSwap.transferOwnership(safeAddress);
        
        // Transfer BridgeAdapter
        BridgeAdapter bridge = BridgeAdapter(vm.envAddress("BRIDGE_ADDRESS"));
        bridge.transferOwnership(safeAddress);
        
        // Transfer PriceOracle
        PriceOracle oracle = PriceOracle(vm.envAddress("ORACLE_ADDRESS"));
        oracle.transferOwnership(safeAddress);
        
        vm.stopBroadcast();
    }
}
```

### 5. Verify Ownership Transfer

```bash
# Check each contract's owner
cast call <DEXCORE_ADDRESS> "owner()" --rpc-url $RPC_URL
cast call <FLASHSWAP_ADDRESS> "owner()" --rpc-url $RPC_URL
cast call <BRIDGE_ADDRESS> "owner()" --rpc-url $RPC_URL
cast call <ORACLE_ADDRESS> "owner()" --rpc-url $RPC_URL

# All should return the Safe address
```

### 6. Test Multi-Sig Operations

**Test Scenario: Schedule Pause**
1. One signer initiates transaction on Safe interface
2. Navigate to DexCore contract
3. Call `schedulePause()` function
4. Two additional signers approve
5. Execute transaction
6. Verify pause is scheduled on-chain

### 7. Document Safe Configuration

Update `README.md` and `SECURITY.md`:

```markdown
## Governance

All critical contracts are owned by a Gnosis Safe multi-signature wallet:

- **Safe Address**: `0x...` ([View on Etherscan](https://etherscan.io/address/0x...))
- **Configuration**: 3-of-5 signers
- **Signers**:
  1. Organization A: `0x...`
  2. Organization B: `0x...`
  3. Organization C: `0x...`
  4. Organization D: `0x...`
  5. Organization E: `0x...`

### Controlled Contracts
- DexCore: `0x...`
- FlashSwap: `0x...`
- BridgeAdapter: `0x...`
- PriceOracle: `0x...`
```

## Signer Selection Best Practices

### Recommended Signer Profile
- **Technical Expertise**: Understanding of smart contracts and DeFi
- **Availability**: Able to respond within 24-48 hours
- **Reputation**: Established track record in crypto/DeFi space
- **Geographic Distribution**: Different time zones for 24/7 coverage
- **Organizational Diversity**: Different companies/entities

### Example Signer Distribution
1. **Core Team Lead** (Technical founder)
2. **Security Auditor** (Representative from audit firm)
3. **Community Representative** (Elected by governance)
4. **Institutional Partner** (Strategic investor/partner)
5. **Independent Advisor** (DeFi expert/advisor)

## Emergency Procedures

### If Signer Key Compromised
1. Immediately notify all other signers
2. Initiate signer replacement transaction (requires 3 signatures)
3. Add new signer address
4. Remove compromised signer
5. Update documentation

### If Multiple Signers Unavailable
- Ensure at least 3 signers are always accessible
- Maintain backup communication channels
- Document escalation procedures
- Consider increasing signer count to 7 with 4-of-7 threshold

## Operational Workflows

### Routine Operations (Non-Emergency)
1. Proposal submitted to Safe
2. 48-hour review period
3. Signers review and approve
4. Execute after threshold met

### Emergency Operations (Critical Bug/Exploit)
1. Emergency call initiated
2. Rapid signer coordination
3. Execute pause within 2 hours
4. Public communication
5. Post-mortem and fix

## Cost Considerations

### Gas Costs
- Safe deployment: ~$50-200 (one-time)
- Ownership transfer: ~$10-30 per contract
- Multi-sig transactions: ~$20-50 per execution
- Signer changes: ~$30-60

### Ongoing Costs
- Safe has no monthly fees
- Only pay gas for transactions
- Budget ~$500-1000/year for routine operations

## Testing Checklist

Before mainnet transfer:
- [ ] Deploy Safe on testnet
- [ ] Add all signer addresses
- [ ] Set correct threshold
- [ ] Transfer test contract ownership
- [ ] Execute test transaction (pause/unpause)
- [ ] Verify all signers can access Safe interface
- [ ] Test signer replacement procedure
- [ ] Document all addresses and procedures
- [ ] Conduct signer training session

## Post-Transfer Verification

- [ ] All contracts show Safe as owner
- [ ] Safe configuration is 3-of-5
- [ ] All signers confirmed access
- [ ] Test transaction executed successfully
- [ ] Documentation updated
- [ ] Community announcement published
- [ ] Block explorer verification links added

## Resources

- [Gnosis Safe Documentation](https://docs.safe.global/)
- [Safe Web App](https://app.safe.global/)
- [Safe Contracts on GitHub](https://github.com/safe-global/safe-contracts)
- [Multi-Sig Best Practices](https://blog.openzeppelin.com/gnosis-safe-multisig-wallet/)

## Support

For questions or assistance:
- Safe Discord: https://discord.gg/safe
- Safe Support: https://help.safe.global/
- Community Forum: [Your forum link]

---

**CRITICAL**: Do not deploy to mainnet or accept significant user funds until multi-sig ownership is established and tested.
