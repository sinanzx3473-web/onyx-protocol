# Project Overview

## What is ONYX?

ONYX is a **production-ready decentralized exchange (DEX)** built on EVM-compatible blockchains. It provides a comprehensive trading platform with advanced features including gasless transactions, flash loans, governance, and multi-chain support.

## Core Value Propositions

### 1. **User-Friendly Trading Experience**
- Intuitive swap interface with real-time price quotes
- Slippage protection and transaction simulation
- Gasless transactions (users don't need native tokens for gas)
- Mobile-responsive design with PWA support

### 2. **Advanced DeFi Features**
- **Flash Loans:** Borrow any amount without collateral (single transaction)
- **Liquidity Provision:** Earn fees by providing liquidity to pools
- **Governance:** Community-driven protocol upgrades via token voting
- **Limit Orders:** Set price targets for automated execution
- **Price Alerts:** Get notified when tokens reach target prices

### 3. **Developer-First Architecture**
- Comprehensive testing (100+ smart contract tests)
- Security audits and formal verification
- Well-documented codebase with TypeScript
- Modular architecture for easy extensions

### 4. **Accessibility & Compliance**
- WCAG 2.1 Level AA compliant
- Full keyboard navigation support
- Screen reader optimized
- High contrast mode and dark theme

## Key Features

### Trading & Swaps
- **Instant Token Swaps:** Exchange ERC-20 tokens with optimal routing
- **Slippage Protection:** Configurable slippage tolerance (0.1% - 5%)
- **Price Impact Warning:** Visual indicators for large trades
- **Transaction Simulation:** Preview outcomes before execution
- **Multi-hop Routing:** Automatic best path finding for token pairs

### Liquidity Management
- **Add Liquidity:** Provide token pairs and earn LP tokens
- **Remove Liquidity:** Withdraw liquidity with accrued fees
- **LP Token Staking:** Earn additional rewards
- **Impermanent Loss Calculator:** Understand risks before providing liquidity
- **Pool Analytics:** Track APY, volume, and fee earnings

### Flash Loans
- **Uncollateralized Borrowing:** Borrow any amount in a single transaction
- **Arbitrage Opportunities:** Execute complex trading strategies
- **Safety Checks:** Automatic validation and reversion on failure
- **Fee Distribution:** Flash loan fees distributed to LP providers
- **Developer-Friendly:** Simple interface for custom flash loan strategies

### Gasless Transactions (EIP-2771)
- **Meta-Transactions:** Users sign transactions without paying gas
- **Relayer Infrastructure:** Backend service pays gas on behalf of users
- **Multi-Chain Support:** Works across all supported networks
- **Toggle Control:** Users can enable/disable gasless mode
- **Nonce Management:** Automatic nonce tracking per user per chain

### Governance
- **Proposal Creation:** Token holders can propose protocol changes
- **Voting System:** One token = one vote
- **Timelock Protection:** 2-day delay before execution
- **Quorum Requirements:** Minimum participation threshold
- **Execution Queue:** Automated proposal execution after timelock

### Advanced Features
- **Limit Orders:** Set buy/sell orders at specific prices
- **Price Alerts:** Email/push notifications for price targets
- **Referral System:** Earn rewards for referring new users
- **Portfolio Tracking:** View all positions and transaction history
- **Analytics Dashboard:** Real-time metrics and insights

## Technical Highlights

### Smart Contracts
- **Solidity 0.8.28:** Latest compiler with built-in overflow protection
- **OpenZeppelin Libraries:** Battle-tested security standards
- **Foundry Framework:** Fast testing and deployment
- **Gas Optimized:** Efficient storage patterns and minimal gas usage
- **Upgradeable Governance:** Timelock-controlled protocol upgrades

### Frontend
- **React 18:** Modern concurrent rendering
- **TypeScript:** Full type safety
- **Wagmi & RainbowKit:** Best-in-class wallet integration
- **Vite:** Lightning-fast development and builds
- **Tailwind CSS:** Utility-first styling with design system

### Backend
- **Node.js & Express:** RESTful API server
- **Prisma ORM:** Type-safe database access
- **Redis:** Caching and rate limiting
- **ethers.js v6:** Blockchain interaction
- **Monitoring:** Health checks and alerting

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Swap    │  │Liquidity │  │  Flash   │  │Governance│   │
│  │  Page    │  │   Page   │  │  Loans   │  │   Page   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│                ┌─────────▼─────────┐                        │
│                │  Wagmi + ethers   │                        │
│                │  (Web3 Provider)  │                        │
│                └─────────┬─────────┘                        │
└──────────────────────────┼──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌──────▼──────┐ ┌─────────▼────────┐
│  Smart         │ │   Backend   │ │   Relayer        │
│  Contracts     │ │   API       │ │   Service        │
│  (Solidity)    │ │   (Node.js) │ │   (Gasless TX)   │
│                │ │             │ │                  │
│ • DEXRouter    │ │ • Analytics │ │ • Meta-TX        │
│ • DEXFactory   │ │ • Quotes    │ │ • Nonce Mgmt     │
│ • DEXPair      │ │ • Orders    │ │ • Monitoring     │
│ • FlashSwap    │ │ • Alerts    │ │                  │
│ • Governance   │ │ • Referrals │ │                  │
│ • Forwarder    │ │             │ │                  │
└────────────────┘ └─────────────┘ └──────────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                  ┌────────▼────────┐
                  │   Blockchain    │
                  │   (EVM Chain)   │
                  └─────────────────┘
```

## Supported Networks

### Current Support
- **Devnet:** Development and testing (Chain ID: 20258)
- **Testnet:** Pre-production testing
- **Mainnet:** Production deployment

### Multi-Chain Architecture
The platform is designed for easy multi-chain deployment:
- Single codebase supports multiple EVM chains
- Chain-specific configuration via `metadata.json`
- Environment-based chain selection (`VITE_CHAIN`)
- Automatic contract address resolution per chain

## User Flows

### 1. Token Swap Flow
```
User connects wallet
  → Selects tokens to swap
  → Enters amount
  → Reviews price and slippage
  → (Optional) Enables gasless mode
  → Signs transaction
  → Transaction confirmed
  → Tokens received
```

### 2. Liquidity Provision Flow
```
User connects wallet
  → Selects token pair
  → Enters amounts (auto-balanced)
  → Reviews pool share and APY
  → Approves tokens (if needed)
  → Adds liquidity
  → Receives LP tokens
  → Earns trading fees
```

### 3. Flash Loan Flow
```
Developer deploys flash borrower contract
  → Calls FlashSwap.flashLoan()
  → Receives borrowed tokens
  → Executes custom logic (arbitrage, etc.)
  → Repays loan + fee
  → Transaction succeeds or reverts
```

### 4. Gasless Transaction Flow
```
User enables gasless mode
  → Signs EIP-712 typed data (no gas)
  → Frontend sends to relayer backend
  → Relayer verifies signature
  → Relayer submits to MinimalForwarder
  → Forwarder executes on behalf of user
  → User receives confirmation
```

## Security Measures

### Smart Contract Security
- ✅ Reentrancy guards on all state-changing functions
- ✅ Integer overflow protection (Solidity 0.8+)
- ✅ Access control with OpenZeppelin's Ownable
- ✅ Timelock for governance actions (2-day delay)
- ✅ Flash loan callback validation
- ✅ Slippage protection on swaps
- ✅ Comprehensive test coverage (100+ tests)

### Frontend Security
- ✅ Input validation and sanitization
- ✅ Transaction simulation before execution
- ✅ Error boundaries for graceful failures
- ✅ Secure wallet connection via RainbowKit
- ✅ HTTPS-only in production
- ✅ Content Security Policy headers

### Backend Security
- ✅ Rate limiting on all endpoints
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Environment variable validation
- ✅ Signature verification for meta-transactions
- ✅ Relayer wallet balance monitoring

## Performance Metrics

### Smart Contracts
- **Gas Efficiency:** Optimized storage patterns
- **Swap Gas Cost:** ~120,000 gas
- **Add Liquidity:** ~180,000 gas
- **Flash Loan:** ~150,000 gas base + custom logic

### Frontend
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices)
- **Bundle Size:** < 500KB gzipped

### Backend
- **API Response Time:** < 100ms (p95)
- **Uptime:** 99.9% target
- **Rate Limit:** 100 requests/minute per IP

## Roadmap

### Completed (v1.0)
- ✅ Core DEX functionality
- ✅ Flash loans
- ✅ Gasless transactions
- ✅ Governance system
- ✅ Multi-chain support
- ✅ Security audits

### In Progress
- 🔄 Analytics dashboard
- 🔄 Governance WebSocket updates

### Future Enhancements
- 🔮 Cross-chain bridges
- 🔮 NFT marketplace integration
- 🔮 Advanced order types (stop-loss, trailing stop)
- 🔮 Liquidity mining programs
- 🔮 Mobile native apps (iOS/Android)

## Success Metrics

### User Metrics
- **Total Value Locked (TVL):** Target $10M+
- **Daily Active Users:** Target 1,000+
- **Transaction Volume:** Target $1M+ daily
- **User Retention:** Target 60%+ monthly

### Technical Metrics
- **Uptime:** 99.9%
- **Transaction Success Rate:** 98%+
- **Average Confirmation Time:** < 30 seconds
- **Bug Severity:** Zero critical bugs in production

## Competitive Advantages

1. **Gasless Transactions:** Lower barrier to entry for new users
2. **Flash Loans:** Advanced DeFi capabilities
3. **Accessibility:** WCAG AA compliant (rare in DeFi)
4. **Developer Experience:** Well-documented, tested, and modular
5. **Security:** Multiple audits and comprehensive testing
6. **Performance:** Fast, responsive, and optimized

## Target Audience

### Primary Users
- **DeFi Traders:** Looking for efficient token swaps
- **Liquidity Providers:** Seeking yield opportunities
- **Arbitrageurs:** Using flash loans for profit
- **Governance Participants:** Shaping protocol direction

### Secondary Users
- **Developers:** Building on top of the platform
- **Integrators:** Embedding DEX functionality
- **Researchers:** Studying DeFi mechanics
- **Educators:** Teaching blockchain development

## Conclusion

ONYX represents a **production-ready, feature-rich decentralized exchange** that combines cutting-edge DeFi functionality with exceptional user experience and developer-friendly architecture. The platform is designed for scalability, security, and accessibility, making it suitable for both end-users and developers building the next generation of DeFi applications.
