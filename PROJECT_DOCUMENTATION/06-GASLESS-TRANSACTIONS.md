# Gasless Transactions (EIP-2771 Meta-Transactions)

## Overview

ONYX implements **EIP-2771 meta-transactions** to enable gasless user experiences. Users can execute swaps, add/remove liquidity, and perform flash loans without holding native tokens for gas fees.

## What are Meta-Transactions?

**Meta-transactions** allow users to sign transactions off-chain, which are then submitted on-chain by a third party (relayer) who pays the gas fees.

### Traditional Transaction Flow
```
User → Signs TX → Pays Gas → Blockchain
```

### Meta-Transaction Flow
```
User → Signs Message (EIP-712) → Relayer → Pays Gas → Blockchain
                                    ↓
                            Forwards to Contract
```

## EIP-2771 Standard

**EIP-2771** defines a standard for meta-transaction forwarding:
- Trusted forwarder contract
- `_msgSender()` instead of `msg.sender`
- EIP-712 typed data signing
- Nonce-based replay protection

### Key Components

1. **MinimalForwarder** - Verifies signatures and forwards calls
2. **ERC2771Context** - Extracts original sender from calldata
3. **Relayer Service** - Backend service that pays gas
4. **Frontend Integration** - Signs and submits meta-transactions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (User)                          │
│  1. User enables gasless mode                              │
│  2. Signs EIP-712 typed data (no gas required)             │
│  3. Sends signature to relayer backend                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Relayer Backend (Node.js)                   │
│  4. Verifies signature                                     │
│  5. Checks nonce for replay protection                     │
│  6. Submits transaction to MinimalForwarder                │
│  7. Pays gas fees from relayer wallet                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              MinimalForwarder (Smart Contract)              │
│  8. Verifies signature again (on-chain)                    │
│  9. Checks nonce matches                                   │
│  10. Forwards call to target contract (DEXRouter, etc.)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           Target Contract (DEXRouter, DexCore, etc.)        │
│  11. Inherits ERC2771Context                               │
│  12. Uses _msgSender() to get original user address        │
│  13. Executes function as if user called directly          │
└─────────────────────────────────────────────────────────────┘
```

## Smart Contract Implementation

### 1. MinimalForwarder Contract

**File:** `contracts/src/MinimalForwarder.sol`

**Key Features:**
- EIP-712 domain separator
- Signature verification
- Nonce management
- Generic call forwarding

**ForwardRequest Structure:**
```solidity
struct ForwardRequest {
    address from;      // Original sender
    address to;        // Target contract
    uint256 value;     // ETH value to send
    uint256 gas;       // Gas limit
    uint256 nonce;     // Replay protection
    bytes data;        // Encoded function call
}
```

**Main Functions:**
```solidity
function execute(
    ForwardRequest calldata req,
    bytes calldata signature
) public payable returns (bool, bytes memory) {
    // Verify signature
    require(verify(req, signature), "Invalid signature");
    
    // Check nonce
    require(_nonces[req.from] == req.nonce, "Invalid nonce");
    _nonces[req.from]++;
    
    // Forward call
    (bool success, bytes memory returnData) = req.to.call{
        gas: req.gas,
        value: req.value
    }(abi.encodePacked(req.data, req.from));
    
    emit MetaTransactionExecuted(req.from, req.to, req.nonce, success, returnData);
    return (success, returnData);
}

function verify(
    ForwardRequest calldata req,
    bytes calldata signature
) public view returns (bool) {
    address signer = _hashTypedDataV4(
        keccak256(abi.encode(
            keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
            req.from,
            req.to,
            req.value,
            req.gas,
            req.nonce,
            keccak256(req.data)
        ))
    ).recover(signature);
    
    return signer == req.from;
}

function getNonce(address from) public view returns (uint256) {
    return _nonces[from];
}
```

---

### 2. ERC2771Context Integration

**All target contracts inherit from ERC2771Context:**

```solidity
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

contract DEXRouter is ERC2771Context {
    constructor(
        address _factory,
        address _WETH,
        address _trustedForwarder
    ) ERC2771Context(_trustedForwarder) {
        // ...
    }
    
    // Use _msgSender() instead of msg.sender
    function swapExactTokensForTokens(...) external {
        address user = _msgSender(); // Gets original sender
        // ...
    }
}
```

**Critical Rule:** Always use `_msgSender()` instead of `msg.sender` in contracts that support meta-transactions.

---

## Backend Relayer Service

### RelayerService Implementation

**File:** `api/src/services/relayerService.ts`

**Key Features:**
- Multi-chain wallet management
- Signature verification
- Transaction forwarding
- Balance monitoring
- Nonce tracking

**Initialization:**
```typescript
class RelayerService {
  private wallets: Map<number, ethers.Wallet> = new Map();
  private forwarders: Map<number, string> = new Map();
  
  constructor() {
    this.initializeWallets();
  }
  
  private initializeWallets() {
    // Devnet
    const devnetWallet = new ethers.Wallet(
      process.env.RELAYER_PRIVATE_KEY!,
      new ethers.JsonRpcProvider(process.env.DEVNET_RPC_URL)
    );
    this.wallets.set(20258, devnetWallet);
    this.forwarders.set(20258, process.env.DEVNET_FORWARDER_ADDRESS!);
    
    // Add more chains as needed
  }
}
```

**Relay Transaction:**
```typescript
async relayTransaction({ request, signature, chainId }: RelayParams) {
  // Get wallet and forwarder for chain
  const wallet = this.wallets.get(chainId);
  const forwarderAddress = this.forwarders.get(chainId);
  
  if (!wallet || !forwarderAddress) {
    throw new Error('Chain not supported');
  }
  
  // Create forwarder contract instance
  const forwarder = new ethers.Contract(
    forwarderAddress,
    FORWARDER_ABI,
    wallet
  );
  
  // Verify signature (optional, forwarder will verify on-chain)
  const isValid = await forwarder.verify(request, signature);
  if (!isValid) {
    return { success: false, error: 'Invalid signature' };
  }
  
  // Execute meta-transaction
  try {
    const tx = await forwarder.execute(request, signature, {
      gasLimit: 500000 // Safety limit
    });
    
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

**Get User Nonce:**
```typescript
async getUserNonce(chainId: number, address: string): Promise<string> {
  const wallet = this.wallets.get(chainId);
  const forwarderAddress = this.forwarders.get(chainId);
  
  const forwarder = new ethers.Contract(
    forwarderAddress!,
    FORWARDER_ABI,
    wallet
  );
  
  const nonce = await forwarder.getNonce(address);
  return nonce.toString();
}
```

**Balance Monitoring:**
```typescript
async checkBalance(chainId: number): Promise<string> {
  const wallet = this.wallets.get(chainId);
  const balance = await wallet!.provider.getBalance(wallet!.address);
  return ethers.formatEther(balance);
}
```

---

## Frontend Integration

### RelayerProvider Context

**File:** `src/context/RelayerProvider.tsx`

**Features:**
- Gasless mode toggle
- EIP-712 signature generation
- Relay transaction submission
- Nonce fetching
- Forwarder address fetching

**Context API:**
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

**EIP-712 Signing:**
```typescript
const signAndRelaySwap = async (params: SwapParams) => {
  if (!address || !forwarderAddress) {
    return { success: false, error: 'Not connected' };
  }
  
  setIsRelaying(true);
  
  try {
    // 1. Fetch current nonce
    const nonceResponse = await fetch(
      `${RELAYER_API_URL}/api/relayer/nonce/${chainId}/${address}`
    );
    const { nonce } = await nonceResponse.json();
    
    // 2. Encode function call
    const data = encodeFunctionData({
      abi: DEX_CORE_ABI,
      functionName: 'swap',
      args: [
        params.tokenIn,
        params.tokenOut,
        parseUnits(params.amountIn, params.decimalsIn),
        parseUnits(params.amountOutMin, params.decimalsIn),
        params.deadline
      ]
    });
    
    // 3. Create forward request
    const request: ForwardRequest = {
      from: address,
      to: DEX_CORE_ADDRESS,
      value: '0',
      gas: '300000',
      nonce: nonce,
      data: data
    };
    
    // 4. Sign EIP-712 typed data
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
    
    const signature = await signTypedDataAsync({
      domain,
      types,
      primaryType: 'ForwardRequest',
      message: request
    });
    
    // 5. Send to relayer backend
    const relayResponse = await fetch(
      `${RELAYER_API_URL}/api/relayer/relay`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request,
          signature,
          chainId
        })
      }
    );
    
    const result = await relayResponse.json();
    
    if (result.success) {
      toast({
        title: 'Gasless Transaction Submitted',
        description: `TX: ${result.txHash.slice(0, 10)}...`
      });
    }
    
    return result;
  } catch (error: any) {
    toast({
      title: 'Relay Failed',
      description: error.message,
      variant: 'destructive'
    });
    return { success: false, error: error.message };
  } finally {
    setIsRelaying(false);
  }
};
```

---

### UI Integration

**Gasless Toggle in Swap Page:**
```tsx
import { useRelayer } from '@/context/RelayerProvider';

export default function SwapPage() {
  const { gaslessEnabled, setGaslessEnabled, signAndRelaySwap, isRelaying } = useRelayer();
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Swap</CardTitle>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <Label htmlFor="gasless-mode">Gasless</Label>
            <Switch
              id="gasless-mode"
              checked={gaslessEnabled}
              onCheckedChange={setGaslessEnabled}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Swap form */}
        
        <Button
          onClick={async () => {
            if (gaslessEnabled) {
              // Use meta-transaction
              await signAndRelaySwap({
                tokenIn: fromToken.address,
                tokenOut: toToken.address,
                amountIn: fromAmount,
                amountOutMin: minOutput,
                deadline: deadlineTimestamp,
                decimalsIn: fromToken.decimals
              });
            } else {
              // Use regular transaction
              await writeContract({ ... });
            }
          }}
          disabled={isRelaying}
        >
          {isRelaying ? 'Relaying...' : 'Swap'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Security Considerations

### Signature Verification
- ✅ Signature verified both off-chain (relayer) and on-chain (forwarder)
- ✅ EIP-712 typed data prevents signature reuse across chains
- ✅ Domain separator includes chain ID and verifying contract

### Replay Protection
- ✅ Nonce-based replay protection
- ✅ Nonce incremented after each transaction
- ✅ Nonce checked on-chain before execution

### Gas Limit Protection
- ✅ Gas limit specified in forward request
- ✅ Relayer enforces maximum gas limit
- ✅ Prevents griefing attacks

### Relayer Security
- ✅ Private key stored in environment variables
- ✅ Balance monitoring and alerts
- ✅ Rate limiting on relay endpoints
- ✅ Signature validation before submission

### Contract Security
- ✅ Trusted forwarder address immutable
- ✅ `_msgSender()` used consistently
- ✅ No direct `msg.sender` usage in meta-tx contracts

---

## Monitoring & Alerts

### Relayer Health Monitoring

**Endpoint:** `GET /api/monitoring/health`

**Checks:**
- Relayer wallet balance
- RPC endpoint connectivity
- Database connectivity
- Redis connectivity

**Response:**
```json
{
  "status": "healthy",
  "relayers": [
    {
      "chainId": 20258,
      "address": "0x...",
      "balance": "1.5",
      "minBalance": "0.1",
      "isHealthy": true
    }
  ]
}
```

### Balance Alerts

**Endpoint:** `GET /api/monitoring/alerts`

**Alert Conditions:**
- `critical`: Balance < minimum threshold
- `warning`: Balance < 2x minimum threshold
- `info`: Informational messages

**Example Alert:**
```json
{
  "severity": "warning",
  "chainId": 20258,
  "message": "Relayer balance below 0.5 ETH",
  "timestamp": "2024-11-29T01:00:00.000Z"
}
```

---

## Cost Analysis

### Gas Costs

**Regular Transaction:**
- User pays: ~120,000 gas
- Cost at 20 gwei: ~0.0024 ETH ($6 at $2500/ETH)

**Meta-Transaction:**
- User pays: $0 (signs message off-chain)
- Relayer pays: ~150,000 gas (includes forwarding overhead)
- Cost at 20 gwei: ~0.003 ETH ($7.50 at $2500/ETH)

**Overhead:** ~30,000 gas (~25% increase)

### Relayer Economics

**Revenue Sources:**
- Optional relayer fee (0.05% of swap amount)
- Sponsored by protocol
- Subscription model

**Cost Management:**
- Batch transactions when possible
- Dynamic gas pricing
- Balance monitoring and auto-refill

---

## Deployment Checklist

### Smart Contracts
- [ ] Deploy MinimalForwarder to all target chains
- [ ] Update all contracts to inherit ERC2771Context
- [ ] Replace `msg.sender` with `_msgSender()`
- [ ] Set trusted forwarder address in constructors
- [ ] Verify contracts on block explorers

### Backend
- [ ] Configure relayer private keys (one per chain)
- [ ] Set forwarder addresses in environment
- [ ] Configure RPC URLs for all chains
- [ ] Set minimum balance thresholds
- [ ] Enable monitoring and alerts
- [ ] Test relay endpoints

### Frontend
- [ ] Integrate RelayerProvider
- [ ] Add gasless toggles to all pages
- [ ] Fetch forwarder addresses on load
- [ ] Implement EIP-712 signing
- [ ] Add relay error handling
- [ ] Test on all supported chains

### Testing
- [ ] Test signature generation and verification
- [ ] Test nonce management
- [ ] Test replay protection
- [ ] Test gas limit enforcement
- [ ] Test multi-chain support
- [ ] Load test relayer service

---

## Troubleshooting

### Common Issues

**Issue:** "Invalid signature"
- **Cause:** Incorrect EIP-712 domain or types
- **Fix:** Verify domain matches forwarder contract

**Issue:** "Invalid nonce"
- **Cause:** Nonce mismatch or replay
- **Fix:** Fetch latest nonce before signing

**Issue:** "Execution failed"
- **Cause:** Target contract reverted
- **Fix:** Check contract function requirements

**Issue:** "Relayer balance low"
- **Cause:** Insufficient funds in relayer wallet
- **Fix:** Fund relayer wallet

---

## Best Practices

### For Users
1. Enable gasless mode for small transactions
2. Disable for large transactions (relayer fee applies)
3. Wait for confirmation before retrying

### For Developers
1. Always use `_msgSender()` in meta-tx contracts
2. Test signature generation thoroughly
3. Monitor relayer balance proactively
4. Implement proper error handling
5. Use rate limiting on relay endpoints

### For Relayers
1. Monitor wallet balance continuously
2. Set up auto-refill mechanisms
3. Implement transaction batching
4. Use dynamic gas pricing
5. Log all relay attempts

---

## Future Enhancements

### Planned Features
- 🔮 Multi-relayer support (decentralization)
- 🔮 Relayer reputation system
- 🔮 Gasless transaction batching
- 🔮 EIP-4337 account abstraction integration
- 🔮 Relayer fee optimization
- 🔮 Cross-chain meta-transactions

---

## Conclusion

The ONYX gasless transaction system provides a **seamless, user-friendly experience** by eliminating the need for users to hold native tokens for gas fees. Built on the EIP-2771 standard with comprehensive security measures, it enables broader adoption of DeFi by reducing barriers to entry.

**Key Benefits:**
- ✅ Zero gas fees for users
- ✅ Improved onboarding experience
- ✅ Standard EIP-2771 implementation
- ✅ Multi-chain support
- ✅ Secure signature verification
- ✅ Robust monitoring and alerts
