# Frontend Architecture

## Overview

The ONYX frontend is a modern **React 18** application built with **TypeScript**, **Vite**, and **Tailwind CSS**. It provides a responsive, accessible, and feature-rich user interface for decentralized trading.

## Technology Stack

### Core Framework
- **React 18.3.1** - UI library with concurrent features
- **TypeScript 5.7.2** - Type-safe development
- **Vite 6.0.11** - Build tool and dev server
- **React Router DOM 7.1.1** - Client-side routing

### Web3 Integration
- **Wagmi 2.15.2** - React hooks for Ethereum
- **RainbowKit 2.2.2** - Wallet connection UI
- **ethers.js 6.13.4** - Blockchain interaction
- **viem 2.21.66** - Low-level Ethereum utilities

### UI Components
- **Tailwind CSS 3.4.17** - Utility-first styling
- **Radix UI** - Headless accessible components
- **shadcn/ui** - Pre-built component library
- **Lucide React** - Icon library

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   ├── swap/           # Swap-specific components
│   ├── liquidity/      # Liquidity-specific components
│   ├── flash/          # Flash loan components
│   ├── governance/     # Governance components
│   └── common/         # Shared components
├── pages/              # Page components (routes)
│   ├── Swap.tsx
│   ├── Liquidity.tsx
│   ├── FlashSwap.tsx
│   ├── Governance.tsx
│   ├── Portfolio.tsx
│   └── ...
├── context/            # React context providers
│   ├── RelayerProvider.tsx
│   └── ReferralProvider.tsx
├── hooks/              # Custom React hooks
│   ├── use-toast.ts
│   ├── useMetaTransaction.ts
│   ├── useNotifications.ts
│   └── useReferralTracking.ts
├── utils/              # Utility functions
│   ├── evmConfig.ts
│   ├── wagmiConfig.ts
│   ├── rainbowkit.ts
│   ├── math.ts
│   └── transactionHistory.ts
├── lib/                # Third-party library configs
│   └── utils.ts
├── App.tsx             # Root component
├── main.tsx            # Entry point
└── index.css           # Global styles
```

## Core Pages

### 1. Swap Page (`src/pages/Swap.tsx`)

**Purpose:** Token swapping interface with instant and limit order modes

**Key Features:**
- Token selection with balance display
- Amount input with validation
- Slippage and deadline settings
- Route optimization
- Transaction simulation
- Gasless transaction toggle
- Limit order creation
- Referral tracking

**State Management:**
```typescript
// Token selection
const [fromToken, setFromToken] = useState(TOKENS[0]);
const [toToken, setToToken] = useState(TOKENS[1]);

// Amounts
const [fromAmount, setFromAmount] = useState('');
const [toAmount, setToAmount] = useState('');

// Settings
const [slippage, setSlippage] = useState('0.5');
const [deadline, setDeadline] = useState('20');

// Gasless mode
const { gaslessEnabled, setGaslessEnabled, signAndRelaySwap } = useRelayer();
```

**User Flow:**
```
1. Connect wallet
2. Select tokens (from/to)
3. Enter amount
4. (Optional) Enable gasless mode
5. Review price impact and slippage
6. (Optional) Simulate transaction
7. Approve token (if needed)
8. Execute swap
9. Confirm transaction
```

**Components Used:**
- `TokenSelector` - Token selection dropdown
- `RouteOptimizer` - Best route finder
- `LimitOrder` - Limit order creation
- `TxSimulator` - Transaction preview
- Settings modal for slippage/deadline

---

### 2. Liquidity Page (`src/pages/Liquidity.tsx`)

**Purpose:** Add and remove liquidity from pools

**Key Features:**
- Add liquidity with auto-balancing
- Remove liquidity with percentage slider
- Pool share calculation
- APY display
- Impermanent loss warning
- Gasless transaction support

**Components:**
- `AddLiquidity` - Add liquidity form
- `RemoveLiquidity` - Remove liquidity form
- Pool stats display
- LP token balance

**State Management:**
```typescript
const [mode, setMode] = useState<'add' | 'remove'>('add');
const [tokenA, setTokenA] = useState(TOKENS[0]);
const [tokenB, setTokenB] = useState(TOKENS[1]);
const [amountA, setAmountA] = useState('');
const [amountB, setAmountB] = useState('');
```

---

### 3. Flash Swap Page (`src/pages/FlashSwap.tsx`)

**Purpose:** Flash loan interface for advanced users

**Key Features:**
- Borrow any amount without collateral
- Custom borrower contract integration
- Fee calculation (0.09%)
- Safety checks and validation
- Gasless transaction support

**Components:**
- `FlashSwapCard` - Main flash loan interface
- Borrower contract input
- Amount and token selection
- Fee display

**Validation:**
- Borrower contract address validation
- Amount validation (max 10% of reserves)
- Sufficient liquidity check

---

### 4. Governance Page (`src/pages/Governance.tsx`)

**Purpose:** Protocol governance and voting

**Key Features:**
- Proposal listing
- Proposal creation
- Voting interface
- Execution queue
- Timelock status

**Components:**
- Proposal list
- Proposal detail view
- Vote buttons
- Execution status

---

### 5. Portfolio Page (`src/pages/Portfolio.tsx`)

**Purpose:** User's positions and transaction history

**Key Features:**
- LP positions
- Token balances
- Transaction history
- P&L tracking

---

## Context Providers

### RelayerProvider (`src/context/RelayerProvider.tsx`)

**Purpose:** Manages gasless transaction state and relay logic

**Features:**
- Gasless mode toggle
- EIP-712 signature generation
- Relay transaction submission
- Nonce management
- Forwarder address fetching

**API:**
```typescript
interface RelayerContextType {
  gaslessEnabled: boolean;
  setGaslessEnabled: (enabled: boolean) => void;
  relayerFeePercent: number;
  signAndRelaySwap: (params: SwapParams) => Promise<RelayResult>;
  signAndRelayLiquidity: (params: LiquidityParams) => Promise<RelayResult>;
  signAndRelayFlashLoan: (params: FlashLoanParams) => Promise<RelayResult>;
  isRelaying: boolean;
}
```

**Usage:**
```typescript
const { gaslessEnabled, setGaslessEnabled, signAndRelaySwap, isRelaying } = useRelayer();

// Enable gasless mode
setGaslessEnabled(true);

// Execute gasless swap
const result = await signAndRelaySwap({
  tokenIn: fromToken.address,
  tokenOut: toToken.address,
  amountIn: fromAmount,
  amountOutMin: minOutput,
  deadline: deadlineTimestamp,
  decimalsIn: fromToken.decimals
});
```

**EIP-712 Signing:**
```typescript
const domain = {
  name: 'MinimalForwarder',
  version: '1.0.0',
  chainId: chainId,
  verifyingContract: forwarderAddress
};

const types = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'data', type: 'bytes' }
  ]
};

const signature = await signTypedDataAsync({ domain, types, primaryType: 'ForwardRequest', message: request });
```

---

### ReferralProvider (`src/context/ReferralProvider.tsx`)

**Purpose:** Tracks referral codes and rewards

**Features:**
- Referral code detection from URL
- Referral tracking for swaps
- Reward calculation

---

## Custom Hooks

### useMetaTransaction

**Purpose:** Simplified meta-transaction execution

**Usage:**
```typescript
const { executeMetaTx, isExecuting } = useMetaTransaction();

await executeMetaTx({
  to: DEX_CORE_ADDRESS,
  data: encodedFunctionData,
  value: 0n
});
```

---

### useNotifications

**Purpose:** Browser notifications for price alerts and transactions

**Features:**
- Permission request
- Notification display
- Alert management

---

### useReferralTracking

**Purpose:** Track referral conversions

**Features:**
- Referral code storage
- Conversion tracking
- Reward calculation

---

## Utility Modules

### evmConfig.ts

**Purpose:** Contract address and ABI management

**Features:**
- Environment-based chain selection
- Contract address extraction from metadata.json
- ABI exports for all contracts

**Usage:**
```typescript
import { 
  DEX_CORE_ADDRESS, 
  DEX_CORE_ABI, 
  ROUTER_ADDRESS, 
  ROUTER_ABI,
  chainId,
  rpcUrl 
} from '@/utils/evmConfig';
```

**Implementation:**
```typescript
// Read metadata.json
import metadata from '../metadata.json';

// Get target chain from environment
const targetChainName = import.meta.env.VITE_CHAIN || 'devnet';

// Find chain config
const evmConfig = metadata.chains.find(chain => chain.network === targetChainName);

// Extract contract addresses
export const FACTORY_ADDRESS = factoryContract.address;
export const ROUTER_ADDRESS = routerContract.address;
export const DEX_CORE_ADDRESS = dexCoreContract.address;
// ... etc
```

---

### wagmiConfig.ts

**Purpose:** Wagmi configuration for Web3 hooks

**Features:**
- Chain configuration
- Transport setup (HTTP/WebSocket)
- Wallet connectors

**Configuration:**
```typescript
import { createConfig, http } from 'wagmi';
import { selectedChain, rpcUrl } from './evmConfig';

export const config = createConfig({
  chains: [selectedChain],
  transports: {
    [selectedChain.id]: http(rpcUrl)
  }
});
```

---

### rainbowkit.ts

**Purpose:** RainbowKit wallet connection setup

**Features:**
- Custom chain configuration
- Wallet list customization
- Theme configuration

---

### transactionHistory.ts

**Purpose:** Local transaction history management

**Features:**
- Transaction storage (localStorage)
- Status updates
- History retrieval

**API:**
```typescript
addTransaction(txHash, type, details);
updateTransactionStatus(txHash, status);
getTransactionHistory(address);
```

---

## Component Architecture

### UI Components (`src/components/ui/`)

**shadcn/ui components:**
- `Button` - Accessible button with variants
- `Input` - Form input with validation
- `Card` - Container component
- `Dialog` - Modal dialogs
- `Tabs` - Tab navigation
- `Switch` - Toggle switch
- `Label` - Form labels
- `Select` - Dropdown select
- `Slider` - Range slider
- `Toast` - Notification toasts

**Customization:**
All components use Tailwind CSS and support:
- Dark mode
- Custom variants
- Accessibility features (ARIA, keyboard nav)

---

### Swap Components (`src/components/swap/`)

#### TokenSelector
**Purpose:** Token selection dropdown with search

**Features:**
- Token list with icons
- Balance display
- Search/filter
- Custom token import

#### RouteOptimizer
**Purpose:** Find best swap route

**Features:**
- Multi-hop path finding
- Price comparison
- Gas estimation
- Route visualization

#### LimitOrder
**Purpose:** Create limit orders

**Features:**
- Price target input
- Expiration setting
- Order management

---

### Common Components (`src/components/common/`)

#### TxSimulator
**Purpose:** Preview transaction outcomes

**Features:**
- Estimated output
- Price impact
- Gas estimation
- Failure prediction

#### ErrorBoundary
**Purpose:** Graceful error handling

**Features:**
- Error catching
- Fallback UI
- Error reporting

---

## State Management Strategy

### Local State (useState)
- Component-specific UI state
- Form inputs
- Modal visibility

### Context API
- Global gasless mode state (RelayerProvider)
- Referral tracking (ReferralProvider)

### Wagmi State
- Wallet connection
- Contract reads/writes
- Transaction status
- Account balances

**No Redux/Zustand needed** - Wagmi handles most global state

---

## Styling System

### Tailwind CSS Configuration

**Design Tokens:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        // ... etc
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      }
    }
  }
}
```

**CSS Variables:**
```css
/* index.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

---

## Accessibility Features

### WCAG 2.1 Level AA Compliance

**Keyboard Navigation:**
- All interactive elements focusable
- Logical tab order
- Escape key closes modals
- Arrow keys for dropdowns

**Screen Reader Support:**
- ARIA labels on all inputs
- ARIA live regions for dynamic content
- Semantic HTML elements
- Alt text for images

**Visual Accessibility:**
- 4.5:1 text contrast ratio
- 3:1 UI component contrast
- Focus indicators (2px outline)
- 44×44px minimum touch targets

**Implementation:**
```tsx
<Button
  aria-label="Connect Wallet"
  aria-describedby="wallet-description"
  className="min-h-[44px] min-w-[44px]"
>
  Connect
</Button>
```

---

## Performance Optimization

### Code Splitting
```typescript
// Lazy load pages
const Governance = lazy(() => import('./pages/Governance'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
```

### Memoization
```typescript
// Expensive calculations
const priceImpact = useMemo(() => {
  return calculatePriceImpact(fromAmount, toAmount, reserves);
}, [fromAmount, toAmount, reserves]);
```

### Debouncing
```typescript
// Debounce input changes
const debouncedAmount = useDebounce(fromAmount, 500);
```

### Wagmi Caching
- Automatic request deduplication
- SWR-style caching
- Background refetching

---

## Error Handling

### Error Boundaries
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <SwapPage />
</ErrorBoundary>
```

### Toast Notifications
```typescript
toast({
  title: "Transaction Failed",
  description: error.message,
  variant: "destructive"
});
```

### Transaction Error Handling
```typescript
try {
  const tx = await writeContract({ ... });
  await waitForTransactionReceipt({ hash: tx });
} catch (error) {
  if (error.code === 'ACTION_REJECTED') {
    toast({ title: "Transaction rejected by user" });
  } else {
    toast({ title: "Transaction failed", description: error.message });
  }
}
```

---

## Responsive Design

### Breakpoints
```
sm: 640px   // Mobile landscape
md: 768px   // Tablet
lg: 1024px  // Desktop
xl: 1280px  // Large desktop
2xl: 1536px // Extra large
```

### Mobile-First Approach
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Responsive grid */}
</div>
```

---

## PWA Features

### Service Worker
- Offline caching
- Background sync
- Push notifications

### Manifest
```json
{
  "name": "ONYX",
  "short_name": "DEX",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "icons": [...]
}
```

---

## Build & Deployment

### Build Command
```bash
pnpm build
```

**Output:**
- Optimized bundle (< 500KB gzipped)
- Code splitting
- Tree shaking
- Asset optimization

### Environment Variables
```bash
VITE_CHAIN=devnet                    # devnet | testnet | mainnet
VITE_WALLETCONNECT_PROJECT_ID=...    # WalletConnect project ID
VITE_API_URL=http://localhost:3001   # Backend API URL
```

---

## Testing Strategy

### E2E Tests (Playwright)
```typescript
test('should swap tokens', async ({ page }) => {
  await page.goto('/swap');
  await page.fill('[data-testid="from-amount"]', '10');
  await page.click('[data-testid="swap-button"]');
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

### Component Tests (Vitest)
```typescript
describe('TokenSelector', () => {
  it('should display token list', () => {
    render(<TokenSelector tokens={TOKENS} />);
    expect(screen.getByText('TKA')).toBeInTheDocument();
  });
});
```

---

## Best Practices

### Component Design
1. Single responsibility principle
2. Props interface for type safety
3. Memoization for expensive operations
4. Error boundaries for resilience

### State Management
1. Keep state as local as possible
2. Use context sparingly
3. Leverage Wagmi for Web3 state
4. Avoid prop drilling

### Performance
1. Lazy load routes
2. Debounce user inputs
3. Memoize calculations
4. Optimize re-renders

### Accessibility
1. Semantic HTML
2. ARIA labels
3. Keyboard navigation
4. Focus management

---

## Conclusion

The ONYX frontend provides a **modern, accessible, and performant** user interface for decentralized trading. Built with industry-standard tools and following best practices, it delivers an exceptional user experience while maintaining code quality and maintainability.

**Key Strengths:**
- ✅ Type-safe development with TypeScript
- ✅ Modern React patterns and hooks
- ✅ Comprehensive Web3 integration
- ✅ WCAG AA accessibility compliance
- ✅ Responsive and mobile-friendly
- ✅ PWA support for offline use
- ✅ Optimized performance
