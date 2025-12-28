# ONYX

A fully accessible, production-ready decentralized exchange built with modern web technologies and blockchain integration.

![ONYX](https://img.shields.io/badge/Built%20with-CodeNut-purple)
![WCAG AA](https://img.shields.io/badge/WCAG-AA%20Compliant-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

### Core Functionality
- **Token Swapping**: Instant token exchanges with slippage protection
- **Liquidity Provision**: Add/remove liquidity and earn trading fees
- **Pool Analytics**: Comprehensive pool metrics and performance tracking
- **Flash Loans**: Advanced flash loan functionality with safety checks
- **Account Management**: Transaction history and LP position tracking

### Accessibility & UX
- ✅ **WCAG 2.1 Level AA Compliant**: Full keyboard navigation and screen reader support
- ✅ **Dark Mode**: System preference detection with manual toggle
- ✅ **Responsive Design**: Optimized for mobile, tablet, and desktop (320px+)
- ✅ **Touch Targets**: Minimum 44×44px for all interactive elements
- ✅ **High Contrast**: 4.5:1 text contrast ratio, 3:1 for UI components
- ✅ **Focus Management**: Clear focus indicators and modal focus trapping
- ✅ **Error Boundaries**: Graceful error handling across the application

### Developer Experience
- **TypeScript**: Full type safety across the codebase
- **React 18**: Modern React with hooks and concurrent features
- **Vite**: Lightning-fast development and optimized builds
- **Tailwind CSS**: Utility-first styling with design tokens
- **Wagmi & RainbowKit**: Best-in-class Web3 wallet integration
- **Playwright**: Comprehensive E2E testing including accessibility tests

## Quick Start

### Prerequisites
- Node.js 18+ and pnpm
- A Web3 wallet (MetaMask, Rainbow, etc.)
- Test tokens for development

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/codenut-dex.git
cd codenut-dex

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

### Environment Variables

```env
# Network selection (devnet, testnet, mainnet)
VITE_CHAIN=devnet

# RPC endpoints
VITE_RPC_URL=https://your-rpc-endpoint

# Contract addresses (auto-loaded from metadata.json)
```

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build

# Testing
pnpm test:e2e         # Run E2E tests
pnpm test:a11y        # Run accessibility tests

# Code Quality
pnpm lint             # Lint code
pnpm type-check       # TypeScript type checking
```

### Project Structure

```
codenut-dex/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # Reusable UI primitives
│   │   ├── swap/        # Swap-specific components
│   │   ├── liquidity/   # Liquidity components
│   │   └── flash/       # Flash loan components
│   ├── pages/           # Page components
│   ├── utils/           # Utility functions
│   ├── hooks/           # Custom React hooks
│   └── App.tsx          # Root component
├── contracts/           # Smart contracts
│   └── interfaces/      # Contract ABIs and metadata
├── e2e/                 # E2E tests
├── docs/                # Documentation
│   ├── ACCESSIBILITY.md # Accessibility audit
│   └── ONBOARDING.md    # User guide
└── public/              # Static assets
```

## Accessibility

ONYX is built with accessibility as a core principle. See [ACCESSIBILITY.md](./docs/ACCESSIBILITY.md) for detailed information.

### Keyboard Navigation
- **Tab/Shift+Tab**: Navigate between elements
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and dialogs
- **Arrow Keys**: Navigate within menus and tabs

### Screen Reader Support
- Tested with NVDA, JAWS, VoiceOver, and TalkBack
- Semantic HTML and ARIA attributes throughout
- Live regions for dynamic content updates
- Descriptive labels and error messages

### Visual Accessibility
- WCAG AA color contrast ratios
- Clear focus indicators (2px purple ring)
- Dark mode with system preference detection
- Resizable text up to 200% without loss of functionality

## Testing

### E2E Testing

```bash
# Run all E2E tests
pnpm test:e2e

# Run accessibility tests only
pnpm test:e2e e2e/accessibility.spec.ts

# Run in UI mode
pnpm test:e2e --ui

# Run specific browser
pnpm test:e2e --project=chromium
```

### Accessibility Testing

Our accessibility test suite covers:
- Keyboard navigation flows
- ARIA labels and roles
- Focus management
- Screen reader announcements
- Touch target sizes
- Color contrast
- Modal accessibility

### Manual Testing Checklist

Before each release:
- [ ] Test keyboard-only navigation
- [ ] Verify screen reader compatibility
- [ ] Check color contrast with tools
- [ ] Test on mobile devices
- [ ] Verify all forms and validation
- [ ] Test error states and boundaries
- [ ] Verify network switching
- [ ] Test wallet connection/disconnection

## Deployment

### Building for Production

```bash
# Build optimized production bundle
pnpm build

# Preview production build locally
pnpm preview
```

### Performance Targets
- **Lighthouse Score**: 90+ across all categories
- **LCP (Largest Contentful Paint)**: < 2.0s
- **TTI (Time to Interactive)**: < 3.0s
- **CLS (Cumulative Layout Shift)**: < 0.1
- **FID (First Input Delay)**: < 100ms

### Network Configuration

The app supports multiple networks:
- **Devnet**: Local development and testing
- **Testnet**: Public testnet (Sepolia, Goerli, etc.)
- **Mainnet**: Production Ethereum mainnet

Network selection persists across sessions and can be changed via the Network Settings dialog.

## User Guide

For end-user documentation, see [ONBOARDING.md](./docs/ONBOARDING.md).

Topics covered:
- Connecting your wallet
- Network selection
- Trading tokens
- Providing liquidity
- Using flash loans
- Managing your account
- Troubleshooting

## Smart Contracts

### Contract Integration

The app integrates with the following contracts:
- **DEX Router**: Token swapping logic
- **Liquidity Pool**: AMM liquidity provision
- **Flash Swap**: ERC-3156 flash loan implementation

Contract metadata is automatically loaded from `contracts/interfaces/metadata.json`.

### Security Features
- Borrower whitelist for flash loans
- Slippage protection on swaps
- Maximum loan size limits
- Reentrancy guards
- Comprehensive error handling

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow code style**: Use ESLint and Prettier configs
3. **Write tests**: Add E2E tests for new features
4. **Check accessibility**: Ensure WCAG AA compliance
5. **Update docs**: Document new features and changes
6. **Submit PR**: Provide clear description of changes

### Code Style
- Use TypeScript for all new code
- Follow existing component patterns
- Add ARIA labels to interactive elements
- Ensure keyboard accessibility
- Maintain color contrast ratios
- Add loading and error states

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android 90+)

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Support

- **Documentation**: See [docs/](./docs) directory
- **Issues**: [GitHub Issues](https://github.com/your-org/codenut-dex/issues)
- **Accessibility**: accessibility@codenut.dev
- **General Support**: support@codenut.dev

## Acknowledgments

Built with:
- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Wagmi](https://wagmi.sh)
- [RainbowKit](https://rainbowkit.com)
- [Radix UI](https://radix-ui.com)
- [Playwright](https://playwright.dev)

---

**Built with CodeNut** | Version 1.0.0 | [Accessibility Statement](./docs/ACCESSIBILITY.md)
