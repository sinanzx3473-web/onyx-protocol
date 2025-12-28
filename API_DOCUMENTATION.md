# API Documentation

## Overview

The ONYX Protocol API is now fully documented using OpenAPI 3.0 (Swagger) specification. Interactive documentation is available at the `/api-docs` endpoint.

## Accessing Documentation

### Development
```
http://localhost:3001/api-docs
```

### Production
```
https://api.onyx.io/api-docs
```

### JSON Specification
```
http://localhost:3001/api-docs.json
```

## Features

✅ **Interactive API Explorer**: Test endpoints directly from the browser
✅ **Complete Schema Definitions**: All request/response models documented
✅ **Authentication Examples**: Bearer token and API key examples
✅ **Rate Limiting Info**: Rate limits documented per endpoint
✅ **Error Responses**: Standardized error response formats
✅ **Code Generation**: Export client SDKs in multiple languages

## API Endpoints

### Health & Monitoring
- `GET /api/health` - Health check with dependency status
- `GET /api/metrics` - Prometheus metrics endpoint
- `GET /api/monitoring/*` - System monitoring endpoints

### Gas & Pricing
- `POST /api/gas-estimate` - Estimate gas for operations
- `POST /api/quote` - Get swap price quotes

### Trading
- `POST /api/limit-orders` - Create limit orders
- `GET /api/limit-orders` - List user's limit orders
- `DELETE /api/limit-orders/:id` - Cancel limit order
- `POST /api/relay-tx` - Submit gasless transactions
- `POST /api/simulate-tx` - Simulate transactions

### Analytics
- `GET /api/analytics/overview` - Protocol overview stats
- `GET /api/analytics/volume` - Trading volume data
- `GET /api/analytics/fees` - Fee statistics
- `GET /api/pools` - List all liquidity pools
- `GET /api/pools/:address` - Get pool details

### User Features
- `GET /api/portfolio/:address` - User portfolio
- `GET /api/trades/:address` - Trade history
- `POST /api/notifications` - Manage notifications
- `POST /api/alerts` - Create price alerts
- `GET /api/referrals/:address` - Referral stats

### Governance
- `GET /api/governance/proposals` - List proposals
- `POST /api/governance/proposals` - Create proposal
- `POST /api/governance/vote` - Vote on proposal

## Authentication

### API Key Authentication
```bash
curl -H "X-API-Key: your-api-key" https://api.onyx.io/api/endpoint
```

### Bearer Token (Future)
```bash
curl -H "Authorization: Bearer your-token" https://api.onyx.io/api/endpoint
```

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint Category | Rate Limit | Window |
|------------------|------------|--------|
| General | 100 requests | 15 minutes |
| Gas Estimates | 30 requests | 1 minute |
| Analytics | 60 requests | 1 minute |
| Relay/Governance | 10 requests | 1 minute |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid request parameters
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `INTERNAL_ERROR`: Server error

## Request/Response Examples

### Gas Estimate
```bash
curl -X POST http://localhost:3001/api/gas-estimate \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "swap",
    "tokenA": "0x...",
    "tokenB": "0x...",
    "amount": "1000000000000000000"
  }'
```

Response:
```json
{
  "success": true,
  "gasEstimate": "150000",
  "gasPrice": "20000000000",
  "maxFeePerGas": "30000000000",
  "maxPriorityFeePerGas": "2000000000",
  "estimatedCost": "0.003"
}
```

### Create Limit Order
```bash
curl -X POST http://localhost:3001/api/limit-orders \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x...",
    "tokenIn": "0x...",
    "tokenOut": "0x...",
    "amountIn": "1000000000000000000",
    "minAmountOut": "900000000000000000",
    "expiresAt": "2024-12-31T23:59:59Z"
  }'
```

## SDK Generation

Generate client SDKs from the OpenAPI spec:

### JavaScript/TypeScript
```bash
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3001/api-docs.json \
  -g typescript-axios \
  -o ./sdk/typescript
```

### Python
```bash
openapi-generator-cli generate \
  -i http://localhost:3001/api-docs.json \
  -g python \
  -o ./sdk/python
```

### Go
```bash
openapi-generator-cli generate \
  -i http://localhost:3001/api-docs.json \
  -g go \
  -o ./sdk/go
```

## Adding Documentation to New Endpoints

When creating new endpoints, add JSDoc comments with Swagger annotations:

```typescript
/**
 * @swagger
 * /api/your-endpoint:
 *   post:
 *     summary: Brief description
 *     description: Detailed description
 *     tags: [Category]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YourSchema'
 */
router.post('/your-endpoint', async (req, res) => {
  // Implementation
});
```

## Testing with Swagger UI

1. Navigate to `/api-docs`
2. Click on an endpoint to expand
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"
6. View response

## Security Considerations

- API documentation is publicly accessible
- Sensitive endpoints require authentication
- Rate limiting applies to all endpoints
- CORS policies are enforced
- Input validation on all endpoints

## Next Steps

1. ✅ Basic documentation structure created
2. ⏳ Document remaining endpoints (in progress)
3. ⏳ Add authentication schemes
4. ⏳ Add example responses for all endpoints
5. ⏳ Generate and publish client SDKs
6. ⏳ Add versioning strategy

## Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [OpenAPI Generator](https://openapi-generator.tech/)
