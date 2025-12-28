import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock Prisma client to avoid database dependency in tests
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}));

// Mock ioredis to avoid Redis dependency in tests
vi.mock('ioredis', () => {
  const RedisMock = vi.fn(() => ({
    connect: vi.fn().mockRejectedValue(new Error('Redis disabled in tests')),
    on: vi.fn(),
    disconnect: vi.fn(),
  }));
  return { default: RedisMock };
});

// Setup test environment
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  // Disable Redis for tests (use in-memory rate limiting)
  delete process.env.REDIS_URL;
  delete process.env.REDIS_HOST;
  delete process.env.REDIS_PORT;
});

// Cleanup after each test
afterEach(() => {
  // Clear any mocks or test data
});

// Cleanup after all tests
afterAll(() => {
  // Close connections, cleanup resources
});
