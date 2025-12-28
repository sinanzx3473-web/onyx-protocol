# Architecture Documentation

## Table of Contents

- [System Overview](#system-overview)
- [Smart Contract Architecture](#smart-contract-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data Flow](#data-flow)
- [Deployment Architecture](#deployment-architecture)
- [Security Architecture](#security-architecture)

## System Overview

The DEX Platform is a three-tier decentralized application consisting of:

1. **Smart Contract Layer**: On-chain logic for AMM, flash loans, and cross-chain bridging
2. **Frontend Layer**: React-based user interface for wallet interaction
3. **Backend Layer**: Analytics API and database for off-chain data aggregation

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Swap UI    │  │ Liquidity UI │  │ Flash Loan   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────┬────────────────┬────────────────┬─────────────────┘
             │                │                │
             │ RainbowKit/Wagmi/ethers.js     │
             │                │                │
┌────────────▼────────────────▼────────────────▼─────────────────┐
│                    Blockchain Layer (EVM)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ DexCore  │  │ LPToken  │  │FlashSwap │  │  Bridge  │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Events & State Queries
             │
┌────────────▼─────────────────────────────────────────────────────┐
│                      Backend API Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Express    │  │    Prisma    │  │  Supabase    │          │
│  │   REST API   │  │     ORM      │  │  PostgreSQL  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

## Smart Contract Architecture

### Contract Hierarchy

```
                    ┌─────────────┐
                    │   Ownable   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼──────┐    ┌─────▼─────┐
   │ DexCore │      │  FlashSwap  │    │  Bridge   │
   │         │      │             │    │  Adapter  │
   └────┬────┘      └──────┬──────┘    └───────────┘
        │                  │
        │                  │
   ┌────▼────┐      ┌──────▼──────┐
   │ LPToken │      │ IERC3156... │
   └─────────┘      └─────────────┘
```

### DexCore Contract

**Purpose**: Core AMM implementation with constant product formula

**Key Components**:

```solidity
contract DexCore is Ownable, ReentrancyGuard, Pausable {
    // State
    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => address) public lpTokens;
    
    // Core functions
    function createPool(address tokenA, address tokenB) external
    function addLiquidity(...) external nonReentrant whenNotPaused
    function removeLiquidity(...) external nonReentrant whenNotPaused
    function swap(...) external nonReentrant whenNotPaused
    
    // Admin functions
    function pause() external onlyOwner
    function unpause() external onlyOwner
    function setFee(uint256 newFee) external onlyOwner
}
```

**State Management**:

| State Variable | Type | Purpose |
|---------------|------|---------|
| `pools` | `mapping(bytes32 => Pool)` | Pool reserves and metadata |
| `lpTokens` | `mapping(bytes32 => address)` | LP token addresses per pool |
| `fee` | `uint256` | Trading fee (basis points) |
| `paused` | `bool` | Emergency pause state |

**Pool Structure**:

```solidity
struct Pool {
    address tokenA;
    address tokenB;
    uint256 reserveA;
    uint256 reserveB;
    uint256 kLast;           // For oracle TWAP
    uint256 lastUpdateTime;  // Timestamp of last update
}
```

### LPToken Contract

**Purpose**: ERC20 token representing liquidity provider shares

**Access Control**:
- Only DexCore can mint/burn tokens
- Standard ERC20 transfers allowed for all holders

```solidity
contract LPToken is ERC20, Ownable {
    address public dexCore;
    
    modifier onlyDexCore() {
        require(msg.sender == dexCore, "Only DexCore");
        _;
    }
    
    function mint(address to, uint256 amount) external onlyDexCore
    function burn(address from, uint256 amount) external onlyDexCore
}
```

### FlashSwap Contract

**Purpose**: ERC-3156 compliant flash loan provider

**Flash Loan Flow**:

```
1. User calls flashLoan(receiver, token, amount, data)
2. FlashSwap transfers tokens to receiver
3. Receiver executes onFlashLoan callback
4. FlashSwap pulls back amount + fee
5. Transaction reverts if repayment fails
```

**Fee Structure**:
- Flash loan fee: 0.09% (9 basis points)
- Fee accrues to contract owner

```solidity
contract FlashSwap is IERC3156FlashLender, Ownable, ReentrancyGuard {
    uint256 public constant FLASH_FEE_RATE = 9; // 0.09%
    mapping(address => bool) public approvedBorrowers;
    
    function flashLoan(
        IERC3156FlashBorrower receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external nonReentrant returns (bool)
}
```

### BridgeAdapter Contract

**Purpose**: Cross-chain swap execution with replay protection

**Security Features**:
- Message ID tracking prevents replay attacks
- Only authorized bridge can call executeSwap
- Integrates with DexCore for actual swaps

```solidity
contract BridgeAdapter is Ownable {
    address public bridge;
    address public dexCore;
    mapping(bytes32 => bool) public processedMessages;
    
    modifier onlyBridge() {
        require(msg.sender == bridge, "Only bridge");
        _;
    }
    
    function executeSwap(
        bytes32 messageId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external onlyBridge
}
```

### DEX Factory Pattern (Uniswap V2 Style)

**Components**:
- `DEXFactory`: Creates and tracks pair contracts
- `DEXPair`: Individual AMM pool implementation
- `DEXRouter`: User-facing interface for swaps and liquidity

```
User → DEXRouter → DEXPair (via Factory)
                ↓
            Token Transfers
```

## Frontend Architecture

### Component Structure

```
src/
├── App.tsx                    # Root component with routing
├── components/
│   ├── Layout.tsx            # App shell with navigation
│   ├── liquidity/
│   │   ├── AmountInput.tsx   # Token amount input
│   │   ├── PoolSelector.tsx  # Pool selection dropdown
│   │   └── LPPositions.tsx   # User's LP positions
│   ├── flash/
│   │   └── FlashSwapCard.tsx # Flash loan interface
│   └── ui/                   # shadcn/ui components
├── pages/
│   ├── Index.tsx             # Landing page
│   ├── Swap.tsx              # Token swap interface
│   ├── Liquidity.tsx         # Add/remove liquidity
│   ├── Pools.tsx             # Pool analytics
│   └── FlashSwap.tsx         # Flash loan page
├── utils/
│   ├── evmConfig.ts          # Contract ABIs and addresses
│   ├── wagmiConfig.ts        # Wagmi configuration
│   └── rainbowkit.ts         # Wallet connection config
└── hooks/
    ├── use-toast.ts          # Toast notifications
    └── use-mobile.tsx        # Responsive utilities
```

### State Management

**Wagmi Hooks** for blockchain state:

```typescript
// Read contract state
const { data: reserves } = useReadContract({
  address: poolAddress,
  abi: DexCoreABI,
  functionName: 'getReserves',
  args: [tokenA, tokenB]
})

// Write contract transactions
const { writeContract } = useWriteContract()
const swap = () => writeContract({
  address: dexCoreAddress,
  abi: DexCoreABI,
  functionName: 'swap',
  args: [tokenIn, tokenOut, amountIn, minAmountOut, deadline]
})

// Wait for transaction
const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash })
```

**React State** for UI:
- Form inputs (amounts, slippage, deadline)
- Loading states
- Error messages
- Modal visibility

### Wallet Integration

**RainbowKit** provides:
- Multi-wallet support (MetaMask, WalletConnect, Coinbase, etc.)
- Network switching
- Account management
- Transaction signing

```typescript
// wagmiConfig.ts
export const config = createConfig({
  chains: [mainnet, sepolia, base, arbitrum],
  transports: {
    [mainnet.id]: http(MAINNET_RPC),
    [sepolia.id]: http(SEPOLIA_RPC),
    // ...
  },
})

// App.tsx
<WagmiProvider config={config}>
  <QueryClientProvider client={queryClient}>
    <RainbowKitProvider>
      <App />
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### Contract Interaction Pattern

```typescript
// 1. Read current state
const { data: allowance } = useReadContract({
  address: tokenAddress,
  abi: ERC20_ABI,
  functionName: 'allowance',
  args: [userAddress, dexCoreAddress]
})

// 2. Approve if needed
if (allowance < amount) {
  await writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [dexCoreAddress, MAX_UINT256]
  })
}

// 3. Execute main transaction
await writeContract({
  address: dexCoreAddress,
  abi: DexCoreABI,
  functionName: 'swap',
  args: [tokenIn, tokenOut, amountIn, minAmountOut, deadline]
})

// 4. Wait for confirmation
const receipt = await waitForTransactionReceipt({ hash })

// 5. Update UI
toast.success('Swap successful!')
```

## Backend Architecture

### API Structure

```
api/
├── src/
│   ├── index.ts              # Express app setup
│   ├── routes/
│   │   ├── health.ts         # Health check endpoint
│   │   ├── pools.ts          # Pool analytics
│   │   ├── analytics.ts      # Historical data
│   │   └── gas.ts            # Gas estimation
│   ├── middleware/
│   │   └── errorHandler.ts   # Global error handling
│   └── tests/
│       ├── health.test.ts
│       └── gas.test.ts
└── prisma/
    └── schema.prisma         # Database schema
```

### Database Schema

```prisma
model Pool {
  id            String   @id @default(uuid())
  address       String   @unique
  tokenA        String
  tokenB        String
  reserveA      String
  reserveB      String
  totalSupply   String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  swaps         Swap[]
  snapshots     PoolSnapshot[]
}

model Swap {
  id            String   @id @default(uuid())
  poolId        String
  pool          Pool     @relation(fields: [poolId], references: [id])
  
  tokenIn       String
  tokenOut      String
  amountIn      String
  amountOut     String
  sender        String
  recipient     String
  
  txHash        String   @unique
  blockNumber   Int
  timestamp     DateTime
  
  @@index([poolId, timestamp])
}

model PoolSnapshot {
  id            String   @id @default(uuid())
  poolId        String
  pool          Pool     @relation(fields: [poolId], references: [id])
  
  reserveA      String
  reserveB      String
  totalSupply   String
  volume24h     String
  tvl           String
  
  timestamp     DateTime @default(now())
  
  @@index([poolId, timestamp])
}
```

### API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/health` | GET | Health check | No |
| `/api/pools` | GET | List all pools | No |
| `/api/pools/:address` | GET | Pool details | No |
| `/api/pools/:address/swaps` | GET | Pool swap history | No |
| `/api/pools/:address/snapshots` | GET | Historical snapshots | No |
| `/api/analytics/volume` | GET | Platform volume | No |
| `/api/analytics/tvl` | GET | Total value locked | No |
| `/api/gas/estimate` | POST | Estimate gas cost | No |

### Event Indexing

The backend listens to blockchain events and indexes them:

```typescript
// Event listener setup
const dexCore = new ethers.Contract(address, abi, provider)

dexCore.on('Swap', async (
  sender,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  recipient,
  event
) => {
  await prisma.swap.create({
    data: {
      poolId: getPoolId(tokenIn, tokenOut),
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      sender,
      recipient,
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: new Date()
    }
  })
})
```

## Data Flow

### Swap Transaction Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. Initiate swap
     ▼
┌─────────────┐
│  Frontend   │
└────┬────────┘
     │ 2. Check allowance
     ▼
┌─────────────┐
│ ERC20 Token │ ◄─── 3. Approve if needed
└─────────────┘
     │
     │ 4. Call swap()
     ▼
┌─────────────┐
│  DexCore    │
└────┬────────┘
     │ 5. Transfer tokenIn from user
     │ 6. Calculate amountOut
     │ 7. Update reserves
     │ 8. Transfer tokenOut to user
     │ 9. Emit Swap event
     ▼
┌─────────────┐
│  Blockchain │
└────┬────────┘
     │ 10. Event emitted
     ▼
┌─────────────┐
│  Backend    │
└────┬────────┘
     │ 11. Index event
     │ 12. Update database
     ▼
┌─────────────┐
│  Database   │
└─────────────┘
```

### Flash Loan Flow

```
┌──────────────┐
│ Flash Borrower│
└──────┬───────┘
       │ 1. Call flashLoan()
       ▼
┌──────────────┐
│  FlashSwap   │
└──────┬───────┘
       │ 2. Transfer tokens to borrower
       ▼
┌──────────────┐
│ Borrower     │
│ Contract     │
└──────┬───────┘
       │ 3. Execute onFlashLoan()
       │    - Arbitrage
       │    - Liquidation
       │    - Collateral swap
       │ 4. Approve repayment
       ▼
┌──────────────┐
│  FlashSwap   │
└──────┬───────┘
       │ 5. Pull back amount + fee
       │ 6. Verify repayment
       │ 7. Emit FlashLoan event
       ▼
    Success ✓
```

### Cross-Chain Bridge Flow

```
┌─────────────┐                    ┌─────────────┐
│  Chain A    │                    │  Chain B    │
│             │                    │             │
│  User       │                    │             │
│    │        │                    │             │
│    │ 1. Lock tokens             │             │
│    ▼        │                    │             │
│  Bridge     │                    │             │
│  Contract   │                    │             │
│    │        │                    │             │
│    │ 2. Emit event              │             │
│    │        │                    │             │
└────┼────────┘                    └─────────────┘
     │
     │ 3. Relay message
     │
     ▼
┌─────────────────────────────────────────────────┐
│           Bridge Relayer (Off-chain)            │
└────────────────────┬────────────────────────────┘
                     │
                     │ 4. Submit proof
                     ▼
┌─────────────┐                    ┌─────────────┐
│  Chain A    │                    │  Chain B    │
│             │                    │             │
│             │                    │  Bridge     │
│             │                    │  Adapter    │
│             │                    │    │        │
│             │                    │    │ 5. Verify proof
│             │                    │    │ 6. Check replay
│             │                    │    ▼        │
│             │                    │  DexCore    │
│             │                    │    │        │
│             │                    │    │ 7. Execute swap
│             │                    │    ▼        │
│             │                    │  User       │
│             │                    │  receives   │
└─────────────┘                    └─────────────┘
```

## Deployment Architecture

### Development Environment

```
┌──────────────────────────────────────────────────┐
│              Developer Machine                   │
│                                                  │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │  Frontend  │  │  Backend   │  │  Anvil    │ │
│  │  :5173     │  │  :3001     │  │  :8545    │ │
│  └────────────┘  └────────────┘  └───────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │         Local PostgreSQL :5432             │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Production Environment

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel/Netlify                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Frontend (Static CDN)                     │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           │ API calls
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 Railway/Heroku/AWS                      │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Backend API (Node.js)                     │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase                             │
│  ┌───────────────────────────────────────────────────┐ │
│  │         PostgreSQL Database                       │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Read state
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Ethereum/L2 Networks                       │
│  ┌───────────────────────────────────────────────────┐ │
│  │         Smart Contracts                           │ │
│  │  - DexCore                                        │ │
│  │  - FlashSwap                                      │ │
│  │  - BridgeAdapter                                  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Deployment Order

1. **Smart Contracts** (Foundry)
   ```bash
   forge script script/Deploy.s.sol --rpc-url <network> --broadcast --verify
   ```

2. **Database** (Prisma)
   ```bash
   pnpm prisma:migrate
   pnpm prisma:generate
   ```

3. **Backend API** (Node.js)
   ```bash
   pnpm build
   pnpm start
   ```

4. **Frontend** (React)
   ```bash
   pnpm build
   # Deploy dist/ to CDN
   ```

## Security Architecture

### Smart Contract Security Layers

```
┌─────────────────────────────────────────────────┐
│         Application Logic Layer                 │
│  - Business rules                               │
│  - State transitions                            │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│         Access Control Layer                    │
│  - onlyOwner                                    │
│  - onlyBridge                                   │
│  - onlyDexCore                                  │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│         Security Modifiers Layer                │
│  - nonReentrant                                 │
│  - whenNotPaused                                │
│  - validDeadline                                │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│         Input Validation Layer                  │
│  - require() checks                             │
│  - Custom errors                                │
│  - Bounds checking                              │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│         Safe Operations Layer                   │
│  - SafeERC20                                    │
│  - Safe math (Solidity 0.8+)                    │
│  - Checked arithmetic                           │
└─────────────────────────────────────────────────┘
```

### Attack Prevention

| Attack Vector | Prevention Mechanism |
|--------------|---------------------|
| Reentrancy | `nonReentrant` modifier (OpenZeppelin) |
| Front-running | Slippage protection, deadline checks |
| Flash loan attacks | Fee mechanism, callback validation |
| Replay attacks | Message ID tracking (BridgeAdapter) |
| Integer overflow | Solidity 0.8+ checked arithmetic |
| Unauthorized access | `onlyOwner`, `onlyBridge` modifiers |
| Denial of service | Pausable pattern, gas limits |
| Price manipulation | TWAP oracle, minimum liquidity |

### Audit Checklist

- [ ] All external calls use checks-effects-interactions pattern
- [ ] All state-changing functions have reentrancy protection
- [ ] All user inputs are validated
- [ ] All arithmetic operations are safe (no overflow/underflow)
- [ ] All access control is properly implemented
- [ ] All events are emitted for state changes
- [ ] All error messages are descriptive
- [ ] All edge cases are tested (>95% coverage)
- [ ] All dependencies are up-to-date and audited
- [ ] All admin functions have appropriate access control

---

For security details, see [SECURITY.md](./SECURITY.md).
For contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).
