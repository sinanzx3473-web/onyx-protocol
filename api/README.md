# ONYX Protocol - Backend API

RESTful API server for the ONYX DEX protocol, providing analytics, gasless transactions, limit orders, and real-time notifications.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 16+ database
- Redis (optional, for rate limiting)

### Installation

```bash
cd api
pnpm install
```

### Database Setup

1. **Configure Database Connection**

Create `api/.env` file from the example:

```bash
cp .env.example .env
```

Update `DATABASE_URL` with your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/onyx_dex?schema=public"
```

2. **Run Database Migrations**

```bash
npx prisma migrate dev --name init
```

This will:
- Create all database tables (User, Order, Alert, Pool, Swap, etc.)
- Generate the Prisma client

3. **Seed Initial Data**

```bash
pnpm tsx scripts/init-db.ts
```

This will:
- Verify database connectivity
- Seed supported chain configurations (Ethereum, Polygon, Arbitrum, etc.)
- Display database statistics

### Development

```bash
pnpm dev
```

Server runs on `http://localhost:3001`

### Production Build

```bash
pnpm build
pnpm start
```

## 📊 Database Schema

### Core Models

- **User** - Registered users with notification preferences
- **Order** - Limit and stop orders for trading
- **Alert** - Price alerts and notifications
- **Pool** - Liquidity pool tracking
- **Swap** - Individual swap transactions
- **LPPosition** - Liquidity provider positions
- **ChainConfig** - Supported blockchain networks

### Prisma Commands

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name your_migration_name

# View database in Prisma Studio
npx prisma studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options:

- **Database**: `DATABASE_URL`
- **Server**: `NODE_ENV`, `PORT`, `API_HOST`
- **CORS**: `CORS_ORIGIN`
- **Redis**: `REDIS_URL` (optional)
- **Monitoring**: `SENTRY_DSN`, `LOG_LEVEL`
- **Blockchain RPCs**: `RPC_URL_*`
- **Security**: `JWT_SECRET`, rate limiting settings

### Supported Chains

The database is pre-seeded with configurations for:

- Ethereum Mainnet (Chain ID: 1)
- Sepolia Testnet (Chain ID: 11155111)
- Polygon (Chain ID: 137)
- Arbitrum One (Chain ID: 42161)
- Optimism (Chain ID: 10)
- Base (Chain ID: 8453)
- BNB Smart Chain (Chain ID: 56)
- Avalanche C-Chain (Chain ID: 43114)

## 📡 API Endpoints

### Health & Monitoring

- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

### Analytics

- `GET /api/analytics/overview` - 24h volume, TVL, fees
- `GET /api/analytics/pools` - Pool statistics

### Trading

- `POST /api/quote` - Get swap quote
- `POST /api/limit-orders` - Create limit order
- `GET /api/limit-orders/:address` - Get user orders

### Gasless Transactions

- `POST /api/relay-tx` - Submit gasless transaction

### Alerts & Notifications

- `POST /api/alerts` - Create price alert
- `GET /api/alerts/:address` - Get user alerts
- `GET /api/notifications/:address` - Get notifications

### Governance

- `GET /api/governance/proposals` - List proposals
- `POST /api/governance/vote` - Submit vote

See full API documentation at `/api-docs` when server is running.

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## 🔒 Security

- Helmet.js for security headers
- CORS whitelist configuration
- Rate limiting (Redis-backed)
- Input validation with Zod
- SQL injection protection via Prisma

## 📈 Monitoring

- Prometheus metrics at `/metrics`
- Sentry error tracking (configure `SENTRY_DSN`)
- Structured logging with Winston
- Request correlation IDs

## 🛠️ Development Tools

### Database Management

```bash
# View database schema
npx prisma db pull

# Seed database
pnpm tsx scripts/init-db.ts

# Check migration status
npx prisma migrate status
```

### Code Quality

```bash
# Lint TypeScript
pnpm lint

# Format code
pnpm format
```

## 📝 Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests
- `pnpm tsx scripts/init-db.ts` - Initialize database

## 🚨 Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
3. Ensure database exists: `createdb onyx_dex`
4. Test connection: `pnpm tsx scripts/init-db.ts`

### Migration Errors

```bash
# Reset and reapply migrations
npx prisma migrate reset

# Force push schema (⚠️ development only)
npx prisma db push
```

### Redis Connection (Optional)

If Redis is not available, the API will fall back to in-memory rate limiting. For production, Redis is recommended.

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Express.js Guide](https://expressjs.com/)
- [API Design Best Practices](../docs/API_DOCUMENTATION.md)

## 🤝 Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## 📄 License

Copyright © 2025 ONYX Protocol
