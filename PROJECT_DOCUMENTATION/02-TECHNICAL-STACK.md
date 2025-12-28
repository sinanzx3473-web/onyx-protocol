# Technical Stack

## Overview

ONYX is built with modern, production-ready technologies across the entire stack. This document provides a comprehensive breakdown of all technologies, libraries, and tools used in the project.

## Frontend Stack

### Core Framework
- **React 18.3.1** - Modern UI library with concurrent features
  - Hooks-based architecture
  - Concurrent rendering for better UX
  - Automatic batching for performance
  - Server Components ready (future)

- **TypeScript 5.7.2** - Type-safe JavaScript
  - Strict mode enabled
  - Full type coverage across codebase
  - Enhanced IDE support and autocomplete
  - Compile-time error detection

- **Vite 6.0.11** - Next-generation build tool
  - Lightning-fast HMR (Hot Module Replacement)
  - Optimized production builds
  - Native ESM support
  - Plugin ecosystem

### Web3 Integration
- **Wagmi 2.15.2** - React hooks for Ethereum
  - Type-safe contract interactions
  - Automatic ABI typing
  - Built-in caching and request deduplication
  - Multi-chain support

- **ethers.js 6.13.4** - Ethereum library
  - Contract interaction
  - Transaction signing
  - Provider management
  - Utility functions (formatting, parsing)

- **RainbowKit 2.2.2** - Wallet connection UI
  - Beautiful, customizable wallet modal
  - Support for 100+ wallets
  - Mobile wallet deep linking
  - Chain switching UI

- **viem 2.21.66** - Low-level Ethereum library
  - Type-safe contract calls
  - ABI encoding/decoding
  - Used internally by Wagmi

### UI Components & Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
  - Custom design system
  - Dark mode support
  - Responsive utilities
  - JIT (Just-In-Time) compilation

- **Radix UI** - Headless UI components
  - `@radix-ui/react-dialog` - Modal dialogs
  - `@radix-ui/react-dropdown-menu` - Dropdowns
  - `@radix-ui/react-popover` - Popovers
  - `@radix-ui/react-accordion` - Accordions
  - `@radix-ui/react-checkbox` - Checkboxes
  - `@radix-ui/react-label` - Form labels
  - `@radix-ui/react-avatar` - User avatars
  - `@radix-ui/react-alert-dialog` - Confirmation dialogs
  - Full accessibility (ARIA, keyboard navigation)

- **shadcn/ui** - Re-usable component library
  - Built on Radix UI primitives
  - Customizable with Tailwind
  - Copy-paste component architecture

- **Lucide React 0.468.0** - Icon library
  - 1000+ consistent icons
  - Tree-shakeable
  - Customizable size and color

### Forms & Validation
- **React Hook Form 7.54.2** - Form state management
  - Minimal re-renders
  - Built-in validation
  - TypeScript support
  - Easy integration with UI libraries

- **Zod 3.23.8** - Schema validation
  - Type-safe validation
  - Runtime type checking
  - Integration with React Hook Form via `@hookform/resolvers`

### State Management
- **React Context API** - Global state
  - `RelayerProvider` - Gasless transaction state
  - `ReferralProvider` - Referral tracking
  - No external state library needed (Wagmi handles Web3 state)

### Routing
- **React Router DOM 7.1.1** - Client-side routing
  - Nested routes
  - Lazy loading
  - Type-safe navigation

### PWA & Offline Support
- **Vite PWA Plugin 0.21.1** - Progressive Web App
  - Service worker generation
  - Offline caching
  - Install prompts
  - Background sync

- **Workbox 7.3.0** - Service worker library
  - Precaching strategies
  - Runtime caching
  - Background sync

### Utilities
- **clsx 2.1.1** - Conditional class names
- **tailwind-merge 2.6.0** - Merge Tailwind classes intelligently
- **class-variance-authority 0.7.1** - Component variants
- **date-fns 4.1.0** - Date manipulation
- **recharts 2.15.0** - Charts and data visualization

## Backend Stack

### Runtime & Framework
- **Node.js 20+** - JavaScript runtime
  - LTS version for stability
  - Native ESM support
  - Performance improvements

- **Express 4.18.2** - Web framework
  - RESTful API routing
  - Middleware ecosystem
  - Battle-tested and stable

- **TypeScript 5.7.2** - Type safety
  - Shared types with frontend
  - Compile-time checks

### Database & ORM
- **Prisma 5.22.0** - Next-generation ORM
  - Type-safe database client
  - Auto-generated types
  - Migration system
  - Introspection tools

- **PostgreSQL** - Relational database
  - ACID compliance
  - JSON support
  - Full-text search
  - Scalability

### Caching & Queue
- **Redis (ioredis 5.8.2)** - In-memory data store
  - Rate limiting storage
  - Session caching
  - Real-time data
  - Pub/sub for WebSocket

### Web3 Integration
- **ethers.js 6.13.4** - Blockchain interaction
  - Relayer wallet management
  - Contract calls
  - Transaction signing
  - Event listening

### Security & Middleware
- **Helmet 8.0.0** - Security headers
  - XSS protection
  - Content Security Policy
  - HSTS
  - Frame options

- **CORS 2.8.5** - Cross-origin resource sharing
  - Configurable origins
  - Credentials support

- **express-validator 7.2.0** - Input validation
  - Request sanitization
  - Custom validators

- **rate-limit-redis 4.3.0** - Rate limiting
  - Redis-backed rate limiting
  - Per-IP and per-user limits
  - Configurable windows

### Monitoring & Logging
- **prom-client 15.1.3** - Prometheus metrics
  - Request duration
  - Error rates
  - Custom metrics

- **Morgan 1.10.0** - HTTP request logger
  - Configurable formats
  - Stream support

### Utilities
- **dotenv 16.4.7** - Environment variables
- **uuid 13.0.0** - Unique ID generation
- **Zod 3.23.8** - Runtime validation

## Smart Contract Stack

### Language & Compiler
- **Solidity 0.8.28** - Smart contract language
  - Latest stable version
  - Built-in overflow protection
  - Custom errors for gas savings
  - NatSpec documentation

### Development Framework
- **Foundry** - Ethereum development toolkit
  - **Forge** - Testing framework
    - Fuzz testing
    - Invariant testing
    - Gas snapshots
    - Coverage reports
  - **Cast** - CLI for blockchain interaction
  - **Anvil** - Local Ethereum node
  - **Chisel** - Solidity REPL

### Libraries
- **OpenZeppelin Contracts 5.1.0** - Security standards
  - `ERC20` - Token standard
  - `Ownable` - Access control
  - `ReentrancyGuard` - Reentrancy protection
  - `ERC2771Context` - Meta-transaction support
  - `Pausable` - Emergency pause
  - `SafeERC20` - Safe token transfers

### Testing
- **Foundry Test** - Unit and integration tests
  - 100+ test files
  - Fuzz testing with 10,000+ runs
  - Gas optimization tests
  - Event emission tests

## Testing Stack

### E2E Testing
- **Playwright 1.56.1** - Browser automation
  - Cross-browser testing (Chromium, Firefox, WebKit)
  - Mobile emulation
  - Network interception
  - Screenshot and video recording
  - Accessibility testing

### Unit Testing
- **Vitest 2.1.8** - Unit test framework
  - Vite-native testing
  - Fast execution
  - Coverage reports
  - Compatible with Jest API

### Contract Testing
- **Foundry Forge** - Solidity testing
  - Fast execution (Rust-based)
  - Fuzz testing
  - Invariant testing
  - Gas profiling

## Development Tools

### Code Quality
- **ESLint 9.17.0** - JavaScript/TypeScript linting
  - TypeScript rules
  - React hooks rules
  - Custom rules

- **PostCSS 8.4.49** - CSS processing
  - Tailwind CSS processing
  - Autoprefixer
  - CSS minification

### Build Tools
- **tsx 4.19.2** - TypeScript execution
  - Fast TS execution for backend
  - Watch mode for development

- **Vite** - Frontend bundler
  - Code splitting
  - Tree shaking
  - Asset optimization

### Package Management
- **pnpm** - Fast, disk-efficient package manager
  - Workspace support
  - Strict dependency resolution
  - Content-addressable storage

## Infrastructure & Deployment

### Hosting
- **Netlify** - Frontend hosting
  - Automatic deployments
  - CDN distribution
  - Preview deployments
  - Custom domains

- **Vercel** - Alternative frontend hosting
  - Edge functions
  - Analytics
  - Preview deployments

### Backend Hosting
- **Node.js Server** - API hosting
  - PM2 for process management
  - Nginx reverse proxy
  - SSL/TLS certificates

### Blockchain
- **EVM-Compatible Chains** - Smart contract deployment
  - Custom devnet (Chain ID: 20258)
  - Testnet support
  - Mainnet ready

### Monitoring
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization (future)
- **Sentry** - Error tracking (future)

## Development Environment

### Required Tools
- **Node.js 20+** - JavaScript runtime
- **pnpm** - Package manager
- **Foundry** - Smart contract development
- **Git** - Version control

### Recommended Tools
- **VS Code** - Code editor
  - Solidity extension
  - ESLint extension
  - Tailwind CSS IntelliSense
  - Prettier extension

- **MetaMask** - Browser wallet
- **Hardhat Network** - Local blockchain (alternative to Anvil)

## Version Management

### Frontend Dependencies (package.json)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "wagmi": "^2.15.2",
    "ethers": "^6.13.4",
    "@rainbow-me/rainbowkit": "^2.2.2",
    "viem": "^2.21.66",
    "react-hook-form": "^7.54.2",
    "zod": "^3.23.8",
    "tailwindcss": "^3.4.17"
  }
}
```

### Backend Dependencies (api/package.json)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "@prisma/client": "^5.22.0",
    "ethers": "^6.13.4",
    "ioredis": "^5.8.2",
    "helmet": "^8.0.0",
    "cors": "^2.8.5"
  }
}
```

### Smart Contract Dependencies (contracts/foundry.toml)
```toml
[dependencies]
openzeppelin-contracts = "5.1.0"
forge-std = "1.9.4"
```

## Browser Support

### Desktop
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

### Mobile
- iOS Safari 14+ ✅
- Chrome Android 90+ ✅
- Samsung Internet 14+ ✅

### Web3 Wallets
- MetaMask ✅
- Rainbow ✅
- Coinbase Wallet ✅
- WalletConnect ✅
- Trust Wallet ✅
- Ledger ✅
- Trezor ✅

## Performance Considerations

### Frontend Optimization
- **Code Splitting:** Route-based lazy loading
- **Tree Shaking:** Unused code elimination
- **Image Optimization:** WebP format, lazy loading
- **Bundle Size:** < 500KB gzipped
- **Caching:** Service worker caching strategies

### Backend Optimization
- **Redis Caching:** Frequently accessed data
- **Connection Pooling:** Database connections
- **Rate Limiting:** Prevent abuse
- **Compression:** Gzip response compression

### Smart Contract Optimization
- **Storage Packing:** Efficient variable ordering
- **Custom Errors:** Gas savings over require strings
- **Immutable Variables:** Gas savings for constants
- **View Functions:** No gas cost for reads

## Security Stack

### Frontend Security
- **Content Security Policy** - XSS protection
- **HTTPS Only** - Encrypted communication
- **Input Sanitization** - Prevent injection attacks
- **Wallet Security** - RainbowKit secure connection

### Backend Security
- **Helmet.js** - Security headers
- **Rate Limiting** - DDoS protection
- **CORS** - Origin validation
- **Input Validation** - express-validator
- **Environment Variables** - Secret management

### Smart Contract Security
- **OpenZeppelin** - Audited libraries
- **Reentrancy Guards** - Attack prevention
- **Access Control** - Permission management
- **Timelock** - Governance protection
- **Comprehensive Testing** - 100+ tests

## Continuous Integration

### GitHub Actions (Future)
- Automated testing on PR
- Linting and type checking
- Contract compilation
- E2E test execution
- Deployment automation

## Documentation Tools

### Code Documentation
- **NatSpec** - Solidity documentation
- **TSDoc** - TypeScript documentation
- **Markdown** - Project documentation

### API Documentation
- **OpenAPI/Swagger** - REST API docs (future)
- **Postman Collections** - API testing (future)

## Conclusion

The ONYX technical stack represents a **modern, production-ready architecture** that prioritizes:
- **Developer Experience:** TypeScript, modern tooling, comprehensive testing
- **Performance:** Optimized builds, caching, efficient algorithms
- **Security:** Multiple layers of protection across all components
- **Scalability:** Modular architecture, multi-chain support
- **Maintainability:** Well-documented, tested, and structured codebase

This stack is designed to support rapid development while maintaining high standards for security, performance, and user experience.
