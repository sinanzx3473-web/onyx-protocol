# Deployment Guide

Complete guide for deploying DexCore contracts and frontend to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Contract Deployment](#contract-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Verification](#verification)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Node.js** 20+ and pnpm
- **Foundry** (forge, cast, anvil)
- **jq** for JSON processing
- **Git** for version control

### Required Accounts

1. **Deployer Wallet**
   - Funded with native tokens for gas
   - Private key for deployment
   - Hardware wallet recommended for mainnet

2. **Block Explorer API Keys**
   - Etherscan (Ethereum, Sepolia)
   - Arbiscan (Arbitrum)
   - Basescan (Base)
   - Polygonscan (Polygon)
   - Others as needed

3. **RPC Providers**
   - Alchemy, Infura, or QuickNode
   - Free tier sufficient for testnets
   - Paid tier recommended for mainnet

4. **WalletConnect Project ID**
   - Get from https://cloud.walletconnect.com/
   - Required for frontend wallet integration

## Environment Setup

### 1. Contract Environment

```bash
cd contracts
cp .env.example .env
```

Edit `contracts/.env`:

```bash
# Deployer private key (NEVER commit!)
PRIVATE_KEY=0x...

# RPC endpoints
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Block explorer API keys
ETHERSCAN_API_KEY=YOUR_KEY
ARBISCAN_API_KEY=YOUR_KEY
BASESCAN_API_KEY=YOUR_KEY

# Deployment config
DEPLOY_CHAIN=sepolia
AUTO_VERIFY=true
CONFIRMATIONS=5
```

### 2. Frontend Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Target network
VITE_CHAIN=sepolia

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=your_project_id

# Feature flags
VITE_ENABLE_FLASH_SWAPS=true
VITE_ENABLE_BRIDGE=true
VITE_ENABLE_ANALYTICS=true
```

## Contract Deployment

### Quick Start

Deploy to testnet (Sepolia):

```bash
cd contracts
./scripts/deploy-multi-chain.sh sepolia
```

Deploy to mainnet:

```bash
# Set REQUIRE_CONFIRMATION=true in .env for safety
./scripts/deploy-multi-chain.sh mainnet
```

### Deployment Process

The deployment script will:

1. ✓ Check prerequisites (forge, jq, private key)
2. ✓ Validate chain configuration
3. ✓ Build contracts
4. ✓ Deploy in order: DexCore → FlashSwap → BridgeAdapter
5. ✓ Save deployment metadata
6. ✓ Wait for confirmations
7. ✓ Auto-verify on block explorer (if enabled)
8. ✓ Generate deployment summary

### Deployment Output

After successful deployment:

```
deployments/
└── sepolia/
    ├── metadata.json           # Contract addresses and ABIs
    ├── addresses.json          # Simple address mapping
    ├── deployment-*.json       # Full deployment transaction data
    └── DEPLOYMENT_SUMMARY.md   # Human-readable summary
```

### Manual Deployment Steps

If you prefer manual control:

```bash
# 1. Build contracts
forge build

# 2. Deploy to specific chain
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# 3. Verify contracts
./scripts/verify-contract.sh sepolia DexCore 0x...
./scripts/verify-contract.sh sepolia FlashSwap 0x...
./scripts/verify-contract.sh sepolia BridgeAdapter 0x...

# 4. Run post-deployment tasks
./scripts/post-deploy.sh sepolia
```

## Frontend Deployment

### Prepare Frontend

After contract deployment:

```bash
# 1. Copy deployment metadata
cd contracts
./scripts/post-deploy.sh sepolia

# 2. Verify metadata copied
cat ../src/metadata.json

# 3. Build frontend
cd ..
pnpm run build
```

### Deploy to Vercel

#### Option 1: Vercel CLI

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add VITE_CHAIN production
vercel env add VITE_WALLETCONNECT_PROJECT_ID production
```

#### Option 2: Vercel Dashboard

1. Import repository to Vercel
2. Configure build settings:
   - **Framework**: Vite
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist`
3. Add environment variables:
   - `VITE_CHAIN=sepolia`
   - `VITE_WALLETCONNECT_PROJECT_ID=...`
4. Deploy

### Deploy to Netlify

#### Option 1: Netlify CLI

```bash
# Install Netlify CLI
pnpm add -g netlify-cli

# Deploy
netlify deploy --prod

# Set environment variables
netlify env:set VITE_CHAIN sepolia
netlify env:set VITE_WALLETCONNECT_PROJECT_ID your_id
```

#### Option 2: Netlify Dashboard

1. Import repository to Netlify
2. Build settings are auto-detected from `netlify.toml`
3. Add environment variables in Site Settings
4. Deploy

### Environment Variables for Production

Required variables:

```bash
VITE_CHAIN=mainnet
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

Optional variables:

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_ENABLE_FLASH_SWAPS=true
VITE_ENABLE_BRIDGE=true
VITE_ENABLE_ANALYTICS=true
VITE_DEBUG=false
```

## Verification

### Verify Contracts

Automatic verification (if enabled in .env):

```bash
# Already done during deployment
```

Manual verification:

```bash
./scripts/verify-contract.sh sepolia DexCore 0x...
./scripts/verify-contract.sh sepolia FlashSwap 0x...
./scripts/verify-contract.sh sepolia BridgeAdapter 0x...
```

Check verification status:

```bash
# On Etherscan
https://sepolia.etherscan.io/address/0x...#code

# Using cast
cast code 0x... --rpc-url $SEPOLIA_RPC_URL
```

### Verify Frontend

1. **Check deployment URL**
   - Vercel: `https://your-app.vercel.app`
   - Netlify: `https://your-app.netlify.app`

2. **Test wallet connection**
   - Connect MetaMask/WalletConnect
   - Verify correct network

3. **Test contract interaction**
   - Create swap
   - Check transaction on block explorer
   - Verify events emitted

4. **Check console for errors**
   - Open browser DevTools
   - Look for contract ABI errors
   - Verify RPC connectivity

## Post-Deployment

### Initialize Protocol

```bash
# Set protocol parameters (using cast or frontend)
cast send $DEXCORE_ADDRESS "setFee(uint256)" 30 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Set fee recipient
cast send $DEXCORE_ADDRESS "setFeeRecipient(address)" $FEE_RECIPIENT \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### Create Initial Liquidity

```bash
# Create pair
cast send $FACTORY_ADDRESS "createPair(address,address)" $TOKEN_A $TOKEN_B \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Add liquidity via frontend or router
```

### Monitor Deployment

1. **Block Explorer**
   - Watch contract transactions
   - Monitor gas usage
   - Check event logs

2. **Frontend Analytics**
   - User interactions
   - Swap volume
   - Error rates

3. **RPC Metrics**
   - Request count
   - Response times
   - Error rates

## Troubleshooting

### Common Issues

#### Deployment Fails

```bash
# Check gas balance
cast balance $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL

# Check nonce
cast nonce $DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC_URL

# Increase gas price
export GAS_PRICE=50  # gwei
./scripts/deploy-multi-chain.sh sepolia
```

#### Verification Fails

```bash
# Wait longer (some explorers have delays)
sleep 60
./scripts/verify-contract.sh sepolia DexCore 0x...

# Check if already verified
curl "https://api-sepolia.etherscan.io/api?module=contract&action=getsourcecode&address=0x...&apikey=$ETHERSCAN_API_KEY"

# Manual verification via Etherscan UI
# 1. Go to contract page
# 2. Click "Verify and Publish"
# 3. Upload flattened source
```

#### Frontend Build Fails

```bash
# Clear cache
rm -rf node_modules dist .vite
pnpm install
pnpm run build

# Check metadata exists
ls -la src/metadata.json

# Verify environment variables
cat .env
```

#### Contract Interaction Fails

```bash
# Check contract is deployed
cast code $CONTRACT_ADDRESS --rpc-url $SEPOLIA_RPC_URL

# Check ABI matches
jq '.abi' src/abis/DexCore.json

# Test with cast
cast call $DEXCORE_ADDRESS "owner()" --rpc-url $SEPOLIA_RPC_URL
```

### Getting Help

1. **Check logs**
   ```bash
   # Deployment logs
   cat contracts/deployments/sepolia/deployment-*.json
   
   # Frontend logs
   vercel logs
   netlify logs
   ```

2. **Verify configuration**
   ```bash
   # Contract config
   cat contracts/.env
   
   # Frontend config
   cat .env
   cat src/metadata.json
   ```

3. **Test locally first**
   ```bash
   # Local blockchain
   anvil
   
   # Deploy locally
   ./scripts/deploy-multi-chain.sh localhost
   
   # Test frontend
   pnpm run dev
   ```

## Multi-Chain Deployment

Deploy to multiple chains:

```bash
# Deploy to all configured chains
./scripts/deploy-multi-chain.sh all

# Or deploy individually
./scripts/deploy-multi-chain.sh sepolia
./scripts/deploy-multi-chain.sh arbitrum
./scripts/deploy-multi-chain.sh base
./scripts/deploy-multi-chain.sh polygon
```

Each chain will have its own deployment directory:

```
deployments/
├── sepolia/
├── arbitrum/
├── base/
└── polygon/
```

Frontend will automatically load contracts based on `VITE_CHAIN` environment variable.

## Security Checklist

Before mainnet deployment:

- [ ] Contracts audited by professional firm
- [ ] All tests passing (unit, integration, fuzz)
- [ ] Deployment tested on testnet
- [ ] Private keys secured (hardware wallet for mainnet)
- [ ] Multi-sig for admin functions
- [ ] Emergency pause mechanism tested
- [ ] Gas limits verified
- [ ] Frontend security headers configured
- [ ] Rate limiting on RPC endpoints
- [ ] Monitoring and alerting setup

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com/)
- [Etherscan API](https://docs.etherscan.io/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
