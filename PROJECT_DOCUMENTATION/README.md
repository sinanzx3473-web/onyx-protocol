# ONYX - Complete Project Documentation

This directory contains comprehensive documentation for the ONYX project, a production-ready decentralized exchange with advanced features including gasless transactions, flash loans, governance, and multi-chain support.

## Documentation Structure

- **[01-PROJECT-OVERVIEW.md](./01-PROJECT-OVERVIEW.md)** - High-level project description, features, and architecture
- **[02-TECHNICAL-STACK.md](./02-TECHNICAL-STACK.md)** - Complete technology stack and dependencies
- **[03-SMART-CONTRACTS.md](./03-SMART-CONTRACTS.md)** - Smart contract architecture and deployment
- **[04-FRONTEND-ARCHITECTURE.md](./04-FRONTEND-ARCHITECTURE.md)** - Frontend structure, components, and patterns
- **[05-BACKEND-API.md](./05-BACKEND-API.md)** - Backend services, APIs, and infrastructure
- **[06-GASLESS-TRANSACTIONS.md](./06-GASLESS-TRANSACTIONS.md)** - EIP-2771 meta-transaction implementation
- **[07-DEPLOYMENT-GUIDE.md](./07-DEPLOYMENT-GUIDE.md)** - Deployment procedures and configuration
- **[08-DEVELOPMENT-GUIDE.md](./08-DEVELOPMENT-GUIDE.md)** - Developer setup and workflows
- **[09-TESTING-STRATEGY.md](./09-TESTING-STRATEGY.md)** - Testing approach and coverage
- **[10-SECURITY-AUDIT.md](./10-SECURITY-AUDIT.md)** - Security measures and audit reports

## Quick Navigation

### For New Developers
Start with:
1. [Project Overview](./01-PROJECT-OVERVIEW.md)
2. [Development Guide](./08-DEVELOPMENT-GUIDE.md)
3. [Technical Stack](./02-TECHNICAL-STACK.md)

### For Smart Contract Developers
Focus on:
1. [Smart Contracts](./03-SMART-CONTRACTS.md)
2. [Security Audit](./10-SECURITY-AUDIT.md)
3. [Testing Strategy](./09-TESTING-STRATEGY.md)

### For Frontend Developers
Review:
1. [Frontend Architecture](./04-FRONTEND-ARCHITECTURE.md)
2. [Gasless Transactions](./06-GASLESS-TRANSACTIONS.md)
3. [Development Guide](./08-DEVELOPMENT-GUIDE.md)

### For DevOps/Deployment
Check:
1. [Deployment Guide](./07-DEPLOYMENT-GUIDE.md)
2. [Backend API](./05-BACKEND-API.md)
3. [Smart Contracts](./03-SMART-CONTRACTS.md)

## Project Status

**Current Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** November 2024

### Completed Features
- ✅ Core DEX functionality (swap, liquidity, pools)
- ✅ Flash loan system with safety checks
- ✅ EIP-2771 gasless transactions (meta-transactions)
- ✅ Governance system with timelock
- ✅ Multi-chain support (devnet, testnet, mainnet)
- ✅ Backend relayer infrastructure
- ✅ Comprehensive testing suite
- ✅ Security audits and fixes
- ✅ WCAG AA accessibility compliance
- ✅ PWA support with offline capabilities
- ✅ Advanced features (limit orders, alerts, referrals)

### In Progress
- 🔄 Analytics dashboard
- 🔄 Governance WebSocket real-time updates

## Key Technologies

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Web3:** Wagmi, RainbowKit, ethers.js v6
- **Smart Contracts:** Solidity 0.8.28, Foundry, OpenZeppelin
- **Backend:** Node.js, Express, Prisma, Redis
- **Testing:** Foundry (contracts), Playwright (E2E), Vitest (unit)
- **Infrastructure:** Multi-chain EVM support, gasless relayer

## Getting Started

```bash
# Install dependencies
pnpm install

# Start frontend development server
pnpm dev

# Start backend API server
cd api && pnpm dev

# Run smart contract tests
cd contracts && forge test

# Run E2E tests
pnpm test:e2e
```

## Environment Configuration

### Frontend (.env)
```bash
VITE_CHAIN=devnet  # devnet | testnet | mainnet
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Backend (api/.env)
```bash
NODE_ENV=development
PORT=3001
RELAYER_PRIVATE_KEY=0x...
DEVNET_RPC_URL=https://dev-rpc.codenut.dev
DEVNET_FORWARDER_ADDRESS=0x...
```

### Smart Contracts (contracts/.env)
```bash
PRIVATE_KEY=0x...
DEVNET_RPC_URL=https://dev-rpc.codenut.dev
ETHERSCAN_API_KEY=your_api_key
```

## Project Structure

```
codenut-dex/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── api/                   # Backend Node.js API
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   └── middleware/    # Express middleware
│   └── prisma/            # Database schema
├── contracts/             # Solidity smart contracts
│   ├── src/               # Contract source files
│   ├── test/              # Foundry tests
│   └── script/            # Deployment scripts
├── e2e/                   # Playwright E2E tests
└── PROJECT_DOCUMENTATION/ # This documentation
```

## Support & Resources

- **Main README:** [../README.md](../README.md)
- **Architecture:** [../ARCHITECTURE.md](../ARCHITECTURE.md)
- **Security:** [../SECURITY.md](../SECURITY.md)
- **Contributing:** [../CONTRIBUTING.md](../CONTRIBUTING.md)
- **Deployment:** [../DEPLOYMENT.md](../DEPLOYMENT.md)

## License

MIT License - see [LICENSE](../LICENSE) for details
