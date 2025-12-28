# Incident Response Plan

## Overview

This document outlines the incident response procedures for the ONYX DEX Protocol. All team members must be familiar with these procedures and ready to execute them in emergency situations.

## Severity Levels

### Sev1 - Critical (Fund Loss / Security Breach)
**Impact**: Active or imminent loss of user funds, smart contract exploit, or critical security vulnerability.

**Examples**:
- Smart contract exploit in progress
- Oracle manipulation attack
- Flash loan attack draining liquidity
- Private key compromise
- Critical vulnerability discovered in production contracts

**Response Time**: Immediate (< 15 minutes)

**Escalation**: All hands on deck, external security firms if needed

### Sev2 - High (Service Degradation)
**Impact**: Significant service degradation affecting user experience but no immediate fund loss.

**Examples**:
- API service outage
- Frontend application down
- Database performance issues
- RPC provider failures
- Subgraph indexing delays

**Response Time**: < 1 hour

**Escalation**: On-call engineer + team lead

### Sev3 - Medium (Minor Issues)
**Impact**: Minor service degradation with workarounds available.

**Examples**:
- UI bugs affecting non-critical features
- Analytics dashboard issues
- Documentation errors
- Minor performance degradation

**Response Time**: < 4 hours

**Escalation**: On-call engineer

### Sev4 - Low (Cosmetic)
**Impact**: Cosmetic issues with no functional impact.

**Examples**:
- UI styling issues
- Typos in documentation
- Non-critical logging errors

**Response Time**: Next business day

**Escalation**: Standard ticket queue

## Roles and Responsibilities

### Incident Commander (IC)
**Primary**: Lead Smart Contract Developer  
**Backup**: CTO / Technical Lead

**Responsibilities**:
- Declare incident severity level
- Coordinate response team
- Make critical decisions (pause contracts, emergency withdrawals)
- Communicate with stakeholders
- Lead post-mortem analysis

### Smart Contract Engineer
**Responsibilities**:
- Execute emergency pause via timelock
- Analyze on-chain exploit patterns
- Prepare contract fixes
- Deploy emergency patches if needed

### Backend Engineer
**Responsibilities**:
- Monitor API health and database integrity
- Execute database rollbacks if needed
- Restore services from backups
- Coordinate with infrastructure team

### Frontend Engineer
**Responsibilities**:
- Deploy emergency UI updates
- Implement user warnings/banners
- Rollback deployments if needed
- Monitor client-side errors

### Communications Lead
**Responsibilities**:
- Draft incident notifications
- Post updates to Twitter/Discord
- Coordinate with community moderators
- Prepare public post-mortem

### Security Auditor (External)
**Contact**: [Insert security firm contact]

**Responsibilities**:
- Provide emergency security analysis
- Review proposed fixes
- Validate incident resolution

## Incident Response Procedures

### Phase 1: Detection & Assessment (0-15 minutes)

1. **Incident Detection**
   - Automated monitoring alerts
   - User reports via Discord/Twitter
   - Security researcher disclosure
   - Internal team discovery

2. **Initial Assessment**
   ```bash
   # Check contract balances
   cast balance <CONTRACT_ADDRESS> --rpc-url $RPC_URL
   
   # Check recent transactions
   cast logs --address <CONTRACT_ADDRESS> --from-block <BLOCK> --rpc-url $RPC_URL
   
   # Check API health
   curl https://api.onyx.io/api/health
   ```

3. **Severity Classification**
   - Incident Commander determines severity level
   - Activate appropriate response team
   - Create incident channel: `#incident-YYYY-MM-DD-HH-MM`

### Phase 2: Containment (15-30 minutes)

#### For Sev1 (Smart Contract Exploit)

1. **Emergency Pause (Immediate - No Timelock)**
   ```bash
   # Connect to emergency multisig
   cd contracts
   
   # Schedule immediate pause (requires PAUSER_ROLE)
   cast send $DEXCORE_ADDRESS "schedulePause()" \
     --private-key $EMERGENCY_PRIVATE_KEY \
     --rpc-url $RPC_URL
   
   # Execute pause immediately (bypass timelock in emergency)
   cast send $DEXCORE_ADDRESS "pause()" \
     --private-key $EMERGENCY_PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

2. **Verify Pause Status**
   ```bash
   # Check if contract is paused
   cast call $DEXCORE_ADDRESS "paused()(bool)" --rpc-url $RPC_URL
   ```

3. **Emergency Withdrawal (If Needed)**
   ```solidity
   // Only callable when paused by DEFAULT_ADMIN_ROLE
   function emergencyWithdraw(address token, uint256 amount, address to)
   ```
   
   ```bash
   # Withdraw funds to secure multisig
   cast send $DEXCORE_ADDRESS \
     "emergencyWithdraw(address,uint256,address)" \
     $TOKEN_ADDRESS $AMOUNT $SECURE_MULTISIG \
     --private-key $ADMIN_PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

#### For Sev2 (Service Degradation)

1. **API Service Issues**
   ```bash
   # Check API logs
   cd api
   pnpm logs
   
   # Restart API service
   pnpm restart
   
   # Check database connection
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Frontend Issues**
   ```bash
   # Rollback to previous deployment
   vercel rollback
   
   # Or deploy emergency fix
   pnpm build && vercel --prod
   ```

### Phase 3: Communication (30-60 minutes)

1. **Internal Communication**
   - Post incident summary in `#incident-YYYY-MM-DD-HH-MM`
   - Update status page: https://status.onyx.io
   - Notify all team members via emergency contact list

2. **External Communication**

   **Twitter Template (Sev1)**:
   ```
   🚨 SECURITY ALERT 🚨
   
   We have detected [brief description] and have paused the protocol as a precautionary measure.
   
   ✅ All funds are safe
   ✅ No user action required
   ✅ Investigation underway
   
   Updates: https://status.onyx.io
   ```

   **Discord Template (Sev1)**:
   ```
   @everyone
   
   **INCIDENT ALERT - [TIMESTAMP]**
   
   **Status**: Protocol Paused
   **Severity**: Critical
   **Impact**: [Description]
   
   **What We Know**:
   - [Bullet points of confirmed facts]
   
   **What We're Doing**:
   - [Response actions taken]
   
   **User Action Required**: None at this time. Do NOT interact with any unofficial contracts or links.
   
   **Next Update**: Within 2 hours
   ```

3. **Regulatory Notification (If Applicable)**
   - Contact legal counsel
   - Prepare regulatory filings if required
   - Document all actions taken

### Phase 4: Investigation & Resolution (1-24 hours)

1. **Root Cause Analysis**
   ```bash
   # Analyze exploit transaction
   cast tx <TX_HASH> --rpc-url $RPC_URL
   
   # Trace transaction execution
   cast run <TX_HASH> --rpc-url $RPC_URL
   
   # Check contract state changes
   cast storage <CONTRACT_ADDRESS> --rpc-url $RPC_URL
   ```

2. **Develop Fix**
   - Write comprehensive tests reproducing the issue
   - Implement fix in isolated branch
   - External security review of fix
   - Deploy to testnet for validation

3. **Deploy Fix (Via Timelock)**
   ```bash
   # For contract upgrades (if using proxy pattern)
   cd contracts
   
   # Deploy new implementation
   forge script script/Deploy.s.sol:DeployScript --broadcast --verify
   
   # Queue upgrade via timelock (2 day delay)
   cast send $TIMELOCK_ADDRESS \
     "queueTransaction(address,uint256,string,bytes,uint256)" \
     $PROXY_ADDRESS 0 "upgradeTo(address)" \
     $(cast abi-encode "upgradeTo(address)" $NEW_IMPLEMENTATION) \
     $(($(date +%s) + 172800)) \
     --private-key $GOVERNANCE_KEY
   
   # Execute after timelock (2 days later)
   cast send $TIMELOCK_ADDRESS "executeTransaction(...)" \
     --private-key $GOVERNANCE_KEY
   ```

4. **Unpause Protocol**
   ```bash
   # Schedule unpause
   cast send $DEXCORE_ADDRESS "scheduleUnpause()" \
     --private-key $PAUSER_KEY \
     --rpc-url $RPC_URL
   
   # Execute unpause (after timelock)
   cast send $DEXCORE_ADDRESS "unpause()" \
     --private-key $PAUSER_KEY \
     --rpc-url $RPC_URL
   ```

### Phase 5: Post-Incident (24-72 hours)

1. **Post-Mortem Report**
   - Timeline of events
   - Root cause analysis
   - Impact assessment (funds affected, users impacted)
   - Response effectiveness
   - Lessons learned
   - Action items to prevent recurrence

2. **Public Disclosure**
   - Publish detailed post-mortem on blog
   - Share on Twitter/Discord
   - Update documentation with new safeguards
   - Consider bug bounty payout if applicable

3. **Process Improvements**
   - Update monitoring alerts
   - Enhance testing coverage
   - Implement additional safeguards
   - Update incident response procedures

## Emergency Contacts

### Internal Team
- **Incident Commander**: [Name] - [Phone] - [Telegram]
- **Smart Contract Lead**: [Name] - [Phone] - [Telegram]
- **Backend Lead**: [Name] - [Phone] - [Telegram]
- **Frontend Lead**: [Name] - [Phone] - [Telegram]
- **Communications Lead**: [Name] - [Phone] - [Telegram]

### External Partners
- **Security Auditor**: [Firm Name] - [Emergency Email] - [Phone]
- **Legal Counsel**: [Firm Name] - [Emergency Email] - [Phone]
- **Infrastructure Provider**: [Provider] - [Support Email] - [Phone]
- **RPC Provider**: [Provider] - [Support Email] - [Phone]

### Multisig Signers
- **Emergency Multisig**: [Address] - 3/5 threshold
  - Signer 1: [Name] - [Contact]
  - Signer 2: [Name] - [Contact]
  - Signer 3: [Name] - [Contact]
  - Signer 4: [Name] - [Contact]
  - Signer 5: [Name] - [Contact]

## Monitoring & Alerting

### Critical Alerts (PagerDuty)
- Contract pause events
- Large withdrawals (> $100k)
- Oracle price deviations (> 10%)
- API error rate > 5%
- Database connection failures

### Warning Alerts (Slack)
- Unusual transaction patterns
- Gas price spikes
- RPC provider latency
- Subgraph sync delays

### Monitoring Dashboards
- **Grafana**: https://grafana.onyx.io
- **Dune Analytics**: https://dune.com/onyx
- **Tenderly**: https://dashboard.tenderly.co/onyx

## Testing & Drills

### Quarterly Incident Drills
- Simulate Sev1 incident
- Test emergency pause procedures
- Verify multisig access
- Practice communication protocols
- Review and update procedures

### Annual Security Review
- External security audit
- Penetration testing
- Social engineering tests
- Disaster recovery validation

## Appendix

### A. Emergency Pause Checklist
- [ ] Incident severity confirmed as Sev1
- [ ] Incident Commander notified
- [ ] Emergency multisig signers available (3/5)
- [ ] Pause transaction prepared and reviewed
- [ ] Communication templates ready
- [ ] Status page updated
- [ ] Execute pause transaction
- [ ] Verify pause status on-chain
- [ ] Post public notification within 15 minutes

### B. Contract Addresses (Mainnet)
```
DexCore: 0x...
DEXRouter: 0x...
DEXFactory: 0x...
GovernanceTimelock: 0x...
MinimalForwarder: 0x...
PriceOracle: 0x...
FlashSwap: 0x...
```

### C. Useful Commands Reference
```bash
# Check contract owner
cast call $CONTRACT "owner()(address)" --rpc-url $RPC_URL

# Check role membership
cast call $CONTRACT "hasRole(bytes32,address)(bool)" \
  $(cast keccak "PAUSER_ROLE") $ADDRESS --rpc-url $RPC_URL

# Estimate gas for emergency action
cast estimate $CONTRACT "pause()" --from $ADDRESS --rpc-url $RPC_URL

# Monitor mempool for suspicious transactions
cast mpool --rpc-url $RPC_URL | grep $CONTRACT_ADDRESS
```

---

**Last Updated**: 2025-12-02  
**Version**: 1.0  
**Owner**: Security Team  
**Review Cycle**: Quarterly
