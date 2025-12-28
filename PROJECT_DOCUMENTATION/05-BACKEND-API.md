# Backend API Documentation

## Overview

The ONYX backend is a **Node.js/Express** REST API that provides analytics, relayer services, limit orders, notifications, and governance support for the decentralized exchange.

## Technology Stack

- **Node.js 20+** - JavaScript runtime
- **Express 4.18.2** - Web framework
- **TypeScript 5.7.2** - Type safety
- **Prisma 5.22.0** - Database ORM
- **PostgreSQL** - Relational database
- **Redis (ioredis 5.8.2)** - Caching and rate limiting
- **ethers.js 6.13.4** - Blockchain interaction

## Project Structure

```
api/
├── src/
│   ├── index.ts              # Entry point
│   ├── routes/               # API endpoints
│   │   ├── health.ts         # Health check
│   │   ├── analytics.ts      # Analytics data
│   │   ├── pools.ts          # Pool information
│   │   ├── quote.ts          # Price quotes
│   │   ├── gas.ts            # Gas estimates
│   │   ├── relayer.ts        # Meta-transaction relay
│   │   ├── monitoring.ts     # Relayer monitoring
│   │   ├── limit-orders.ts   # Limit order management
│   │   ├── relay-tx.ts       # Transaction relay
│   │   ├── referrals.ts      # Referral tracking
│   │   ├── portfolio.ts      # User portfolio
│   │   ├── trades.ts         # Trade history
│   │   ├── simulate-tx.ts    # Transaction simulation
│   │   ├── notifications.ts  # Push notifications
│   │   ├── alerts.ts         # Price alerts
│   │   └── governance.ts     # Governance proposals
│   ├── services/             # Business logic
│   │   ├── relayerService.ts # Relayer implementation
│   │   ├── orderMatcher.ts   # Limit order matching
│   │   └── alertMonitor.ts   # Price alert monitoring
│   └── middleware/           # Express middleware
│       ├── errorHandler.ts   # Error handling
│       ├── rateLimiter.ts    # Rate limiting
│       ├── validation.ts     # Input validation
│       ├── correlationId.ts  # Request tracking
│       └── metrics.ts        # Prometheus metrics
├── prisma/
│   └── schema.prisma         # Database schema
├── .env                      # Environment variables
├── package.json
└── tsconfig.json
```

## API Endpoints

### Health & Monitoring

#### GET /health
**Purpose:** Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-29T01:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

**Status Codes:**
- `200` - Service healthy
- `503` - Service unhealthy

---

### Relayer Endpoints

#### POST /api/relayer/relay
**Purpose:** Relay a meta-transaction

**Request Body:**
```json
{
  "request": {
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "gas": "300000",
    "nonce": "5",
    "data": "0x..."
  },
  "signature": "0x...",
  "chainId": 20258
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x..."
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid signature"
}
```

**Status Codes:**
- `200` - Transaction relayed successfully
- `400` - Invalid request or signature
- `500` - Relayer error

---

#### GET /api/relayer/status/:chainId
**Purpose:** Get relayer status for a chain

**Response:**
```json
{
  "chainId": 20258,
  "relayerAddress": "0x...",
  "balance": "1.5",
  "nativeToken": "ETH",
  "isOperational": true,
  "lastRelayedBlock": 12345678
}
```

---

#### GET /api/relayer/nonce/:chainId/:address
**Purpose:** Get user's current nonce for meta-transactions

**Response:**
```json
{
  "nonce": "5"
}
```

---

#### GET /api/relayer/forwarder/:chainId
**Purpose:** Get MinimalForwarder address for a chain

**Response:**
```json
{
  "forwarderAddress": "0x..."
}
```

**Status Codes:**
- `200` - Forwarder found
- `404` - Forwarder not configured for chain

---

#### GET /api/relayer/chains
**Purpose:** Get list of supported chains

**Response:**
```json
{
  "chains": [
    {
      "chainId": 20258,
      "name": "Devnet",
      "rpcUrl": "https://dev-rpc.codenut.dev",
      "forwarderAddress": "0x..."
    }
  ]
}
```

---

### Monitoring Endpoints

#### GET /api/monitoring/health
**Purpose:** Comprehensive relayer health check

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-11-29T01:00:00.000Z",
  "relayers": [
    {
      "chainId": 20258,
      "address": "0x...",
      "balance": "1.5",
      "minBalance": "0.1",
      "isHealthy": true
    }
  ],
  "database": "connected",
  "redis": "connected"
}
```

---

#### GET /api/monitoring/alerts
**Purpose:** Get active relayer alerts

**Response:**
```json
{
  "alerts": [
    {
      "severity": "warning",
      "chainId": 20258,
      "message": "Relayer balance below 0.5 ETH",
      "timestamp": "2024-11-29T01:00:00.000Z"
    }
  ]
}
```

**Alert Severities:**
- `critical` - Relayer balance below minimum
- `warning` - Relayer balance low
- `info` - Informational messages

---

#### GET /api/monitoring/metrics
**Purpose:** Prometheus metrics endpoint

**Response:** (Prometheus format)
```
# HELP relayer_balance_eth Relayer wallet balance in ETH
# TYPE relayer_balance_eth gauge
relayer_balance_eth{chain_id="20258"} 1.5

# HELP relayer_transactions_total Total relayed transactions
# TYPE relayer_transactions_total counter
relayer_transactions_total{chain_id="20258",status="success"} 1234
```

---

### Analytics Endpoints

#### GET /api/analytics/overview
**Purpose:** Get DEX overview statistics

**Response:**
```json
{
  "totalValueLocked": "1000000",
  "volume24h": "50000",
  "fees24h": "150",
  "transactions24h": 1234,
  "uniqueUsers24h": 567
}
```

---

#### GET /api/analytics/pools
**Purpose:** Get all pool statistics

**Response:**
```json
{
  "pools": [
    {
      "address": "0x...",
      "token0": "TKA",
      "token1": "TKB",
      "reserve0": "1000000",
      "reserve1": "2000000",
      "tvl": "3000000",
      "volume24h": "10000",
      "apy": "25.5"
    }
  ]
}
```

---

### Pool Endpoints

#### GET /api/pools/:pairAddress
**Purpose:** Get specific pool information

**Response:**
```json
{
  "address": "0x...",
  "token0": {
    "address": "0x...",
    "symbol": "TKA",
    "decimals": 18
  },
  "token1": {
    "address": "0x...",
    "symbol": "TKB",
    "decimals": 18
  },
  "reserve0": "1000000",
  "reserve1": "2000000",
  "totalSupply": "1414213",
  "price": "2.0"
}
```

---

### Quote Endpoints

#### GET /api/quote
**Purpose:** Get swap quote

**Query Parameters:**
- `tokenIn` - Input token address
- `tokenOut` - Output token address
- `amountIn` - Input amount (in token decimals)

**Response:**
```json
{
  "amountOut": "1980000000000000000",
  "priceImpact": "0.5",
  "route": ["0x...", "0x..."],
  "gasEstimate": "120000"
}
```

---

### Gas Endpoints

#### GET /api/gas/estimate
**Purpose:** Get current gas prices

**Response:**
```json
{
  "slow": "10",
  "standard": "15",
  "fast": "20",
  "instant": "30",
  "unit": "gwei"
}
```

---

### Limit Order Endpoints

#### POST /api/limit-orders
**Purpose:** Create a limit order

**Request Body:**
```json
{
  "maker": "0x...",
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "1000000000000000000",
  "minAmountOut": "2000000000000000000",
  "expiry": 1735516800,
  "signature": "0x..."
}
```

**Response:**
```json
{
  "orderId": "123",
  "status": "pending"
}
```

---

#### GET /api/limit-orders/:address
**Purpose:** Get user's limit orders

**Response:**
```json
{
  "orders": [
    {
      "id": "123",
      "tokenIn": "TKA",
      "tokenOut": "TKB",
      "amountIn": "1.0",
      "targetPrice": "2.0",
      "status": "pending",
      "createdAt": "2024-11-29T01:00:00.000Z"
    }
  ]
}
```

---

#### DELETE /api/limit-orders/:orderId
**Purpose:** Cancel a limit order

**Response:**
```json
{
  "success": true,
  "orderId": "123"
}
```

---

### Notification Endpoints

#### POST /api/notifications/subscribe
**Purpose:** Subscribe to push notifications

**Request Body:**
```json
{
  "address": "0x...",
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

---

#### POST /api/notifications/send
**Purpose:** Send a notification (internal use)

**Request Body:**
```json
{
  "address": "0x...",
  "title": "Price Alert",
  "body": "TKA reached $2.00",
  "icon": "/icon.png"
}
```

---

### Alert Endpoints

#### POST /api/alerts
**Purpose:** Create a price alert

**Request Body:**
```json
{
  "address": "0x...",
  "token": "0x...",
  "targetPrice": "2.0",
  "condition": "above"
}
```

---

#### GET /api/alerts/:address
**Purpose:** Get user's price alerts

**Response:**
```json
{
  "alerts": [
    {
      "id": "456",
      "token": "TKA",
      "targetPrice": "2.0",
      "condition": "above",
      "isActive": true,
      "createdAt": "2024-11-29T01:00:00.000Z"
    }
  ]
}
```

---

### Governance Endpoints

#### GET /api/governance/proposals
**Purpose:** Get all governance proposals

**Response:**
```json
{
  "proposals": [
    {
      "id": "1",
      "title": "Reduce protocol fee to 0.04%",
      "description": "...",
      "proposer": "0x...",
      "status": "active",
      "votesFor": "1000000",
      "votesAgainst": "500000",
      "startBlock": 12345678,
      "endBlock": 12445678
    }
  ]
}
```

---

#### GET /api/governance/proposals/:id
**Purpose:** Get specific proposal details

**Response:**
```json
{
  "id": "1",
  "title": "Reduce protocol fee to 0.04%",
  "description": "Full proposal text...",
  "proposer": "0x...",
  "status": "active",
  "votesFor": "1000000",
  "votesAgainst": "500000",
  "quorum": "5000000",
  "startBlock": 12345678,
  "endBlock": 12445678,
  "executionETA": 1735516800,
  "votes": [
    {
      "voter": "0x...",
      "support": true,
      "votes": "10000",
      "timestamp": "2024-11-29T01:00:00.000Z"
    }
  ]
}
```

---

## Services

### RelayerService (`src/services/relayerService.ts`)

**Purpose:** Manages meta-transaction relay infrastructure

**Key Features:**
- Multi-chain wallet management
- Signature verification
- Transaction forwarding
- Nonce tracking
- Balance monitoring

**Methods:**
```typescript
class RelayerService {
  async relayTransaction(params: RelayParams): Promise<RelayResult>
  async getRelayerStatus(chainId: number): Promise<RelayerStatus>
  async getUserNonce(chainId: number, address: string): Promise<string>
  getForwarderAddress(chainId: number): string | null
  async checkBalance(chainId: number): Promise<string>
}
```

**Implementation Highlights:**
```typescript
// Initialize wallets per chain
private initializeWallets() {
  const devnetWallet = new ethers.Wallet(
    process.env.RELAYER_PRIVATE_KEY!,
    new ethers.JsonRpcProvider(process.env.DEVNET_RPC_URL)
  );
  this.wallets.set(20258, devnetWallet);
}

// Verify and relay transaction
async relayTransaction({ request, signature, chainId }: RelayParams) {
  const wallet = this.wallets.get(chainId);
  const forwarder = new ethers.Contract(forwarderAddress, FORWARDER_ABI, wallet);
  
  // Verify signature
  const isValid = await forwarder.verify(request, signature);
  if (!isValid) throw new Error('Invalid signature');
  
  // Execute meta-transaction
  const tx = await forwarder.execute(request, signature);
  const receipt = await tx.wait();
  
  return { success: true, txHash: receipt.hash };
}
```

---

### OrderMatcher (`src/services/orderMatcher.ts`)

**Purpose:** Matches and executes limit orders

**Key Features:**
- Price monitoring
- Order matching logic
- Automatic execution
- Order expiration handling

**Background Process:**
```typescript
export function startOrderMatcher() {
  setInterval(async () => {
    const pendingOrders = await getPendingOrders();
    
    for (const order of pendingOrders) {
      const currentPrice = await getCurrentPrice(order.tokenIn, order.tokenOut);
      
      if (shouldExecuteOrder(order, currentPrice)) {
        await executeOrder(order);
      }
    }
  }, 10000); // Check every 10 seconds
}
```

---

### AlertMonitor (`src/services/alertMonitor.ts`)

**Purpose:** Monitors prices and triggers alerts

**Key Features:**
- Price tracking
- Alert condition checking
- Notification sending
- Alert deactivation

**Background Process:**
```typescript
export const alertMonitor = {
  start() {
    setInterval(async () => {
      const activeAlerts = await getActiveAlerts();
      
      for (const alert of activeAlerts) {
        const currentPrice = await getTokenPrice(alert.token);
        
        if (alertConditionMet(alert, currentPrice)) {
          await sendNotification(alert.address, {
            title: 'Price Alert',
            body: `${alert.token} reached ${currentPrice}`
          });
          await deactivateAlert(alert.id);
        }
      }
    }, 30000); // Check every 30 seconds
  }
};
```

---

## Middleware

### Error Handler (`src/middleware/errorHandler.ts`)

**Purpose:** Centralized error handling

**Features:**
- Error logging
- User-friendly error messages
- Status code mapping
- Stack trace in development

**Implementation:**
```typescript
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
```

---

### Rate Limiter (`src/middleware/rateLimiter.ts`)

**Purpose:** Prevent API abuse

**Features:**
- Redis-backed rate limiting
- Per-IP and per-user limits
- Different limits per endpoint
- Configurable windows

**Configuration:**
```typescript
export const generalLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
});

export const relayLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),
  windowMs: 60 * 1000, // 1 minute
  max: 10 // 10 relay requests per minute
});
```

---

### Validation (`src/middleware/validation.ts`)

**Purpose:** Input validation

**Features:**
- Request body validation
- Query parameter validation
- Address validation
- Amount validation

**Usage:**
```typescript
router.post('/relay',
  body('request').isObject(),
  body('signature').isString(),
  body('chainId').isNumeric(),
  validate,
  async (req, res) => { ... }
);
```

---

### Correlation ID (`src/middleware/correlationId.ts`)

**Purpose:** Request tracking

**Features:**
- Unique ID per request
- Logging correlation
- Distributed tracing support

---

### Metrics (`src/middleware/metrics.ts`)

**Purpose:** Prometheus metrics collection

**Metrics:**
- Request duration
- Request count by endpoint
- Error rate
- Relayer balance
- Transaction count

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

model LimitOrder {
  id            String   @id @default(uuid())
  maker         String
  tokenIn       String
  tokenOut      String
  amountIn      String
  minAmountOut  String
  expiry        Int
  signature     String
  status        String   // pending, filled, cancelled, expired
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model PriceAlert {
  id           String   @id @default(uuid())
  address      String
  token        String
  targetPrice  String
  condition    String   // above, below
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
}

model Notification {
  id           String   @id @default(uuid())
  address      String
  subscription Json
  createdAt    DateTime @default(now())
}
```

---

## Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dex_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Relayer Configuration
RELAYER_PRIVATE_KEY=0x...
RELAYER_MIN_BALANCE=0.1

# Network Configuration
DEVNET_RPC_URL=https://dev-rpc.codenut.dev
DEVNET_FORWARDER_ADDRESS=0x...

TESTNET_RPC_URL=https://testnet-rpc.example.com
TESTNET_FORWARDER_ADDRESS=0x...

MAINNET_RPC_URL=https://mainnet-rpc.example.com
MAINNET_FORWARDER_ADDRESS=0x...
```

---

## Security Measures

### API Security
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ Input validation
- ✅ SQL injection prevention (Prisma)
- ✅ XSS protection

### Relayer Security
- ✅ Signature verification
- ✅ Nonce-based replay protection
- ✅ Gas limit enforcement
- ✅ Balance monitoring
- ✅ Private key encryption

---

## Monitoring & Logging

### Health Checks
- Database connectivity
- Redis connectivity
- Relayer wallet balance
- RPC endpoint availability

### Logging
- Request/response logging (Morgan)
- Error logging
- Relayer transaction logging
- Alert logging

### Metrics (Prometheus)
- HTTP request metrics
- Relayer metrics
- Database query metrics
- Error rates

---

## Deployment

### Development
```bash
cd api
pnpm install
pnpm prisma:generate
pnpm dev
```

### Production
```bash
pnpm build
pnpm start
```

### Docker (Future)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install --production
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
```

---

## Conclusion

The ONYX backend API provides **robust, scalable infrastructure** for the decentralized exchange, with comprehensive relayer services, analytics, and advanced features. Built with security, performance, and reliability in mind, it supports the frontend application and enables gasless transactions for an improved user experience.

**Key Strengths:**
- ✅ Multi-chain relayer infrastructure
- ✅ Comprehensive API endpoints
- ✅ Security best practices
- ✅ Rate limiting and monitoring
- ✅ Background services (order matching, alerts)
- ✅ Type-safe development with TypeScript
