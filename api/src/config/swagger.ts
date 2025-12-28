import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ONYX Protocol DEX Analytics API',
      version: '1.0.0',
      description: 'Comprehensive REST API for ONYX Protocol DEX analytics, trading, and gasless transactions',
      contact: {
        name: 'ONYX Protocol',
        url: 'https://onyx.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.onyx.io',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            uptime: {
              type: 'number',
              example: 12345,
            },
          },
        },
        GasEstimate: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            gasPrice: {
              type: 'string',
              example: '20000000000',
            },
            maxFeePerGas: {
              type: 'string',
              example: '30000000000',
            },
            maxPriorityFeePerGas: {
              type: 'string',
              example: '2000000000',
            },
          },
        },
        SwapQuote: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            amountOut: {
              type: 'string',
              example: '1000000000000000000',
            },
            priceImpact: {
              type: 'string',
              example: '0.5',
            },
            route: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['0x...', '0x...'],
            },
          },
        },
        LimitOrder: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            userAddress: {
              type: 'string',
              example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            },
            tokenIn: {
              type: 'string',
              example: '0x...',
            },
            tokenOut: {
              type: 'string',
              example: '0x...',
            },
            amountIn: {
              type: 'string',
              example: '1000000000000000000',
            },
            minAmountOut: {
              type: 'string',
              example: '900000000000000000',
            },
            status: {
              type: 'string',
              enum: ['pending', 'filled', 'cancelled', 'expired'],
              example: 'pending',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Pool: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              example: '0x...',
            },
            token0: {
              type: 'string',
              example: '0x...',
            },
            token1: {
              type: 'string',
              example: '0x...',
            },
            reserve0: {
              type: 'string',
              example: '1000000000000000000',
            },
            reserve1: {
              type: 'string',
              example: '2000000000000000000',
            },
            totalSupply: {
              type: 'string',
              example: '1414213562373095048',
            },
            tvl: {
              type: 'string',
              example: '3000.00',
            },
            volume24h: {
              type: 'string',
              example: '150000.00',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Gas',
        description: 'Gas price estimation',
      },
      {
        name: 'Analytics',
        description: 'DEX analytics and statistics',
      },
      {
        name: 'Pools',
        description: 'Liquidity pool information',
      },
      {
        name: 'Quote',
        description: 'Swap price quotes',
      },
      {
        name: 'Limit Orders',
        description: 'Limit order management',
      },
      {
        name: 'Relay',
        description: 'Gasless transaction relay',
      },
      {
        name: 'Referrals',
        description: 'Referral tracking',
      },
      {
        name: 'Portfolio',
        description: 'User portfolio tracking',
      },
      {
        name: 'Trades',
        description: 'Trade history',
      },
      {
        name: 'Simulation',
        description: 'Transaction simulation',
      },
      {
        name: 'Notifications',
        description: 'User notifications',
      },
      {
        name: 'Alerts',
        description: 'Price alerts',
      },
      {
        name: 'Governance',
        description: 'Governance proposals and voting',
      },
      {
        name: 'Monitoring',
        description: 'System monitoring and metrics',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to API route files
};

export const swaggerSpec = swaggerJsdoc(options);
