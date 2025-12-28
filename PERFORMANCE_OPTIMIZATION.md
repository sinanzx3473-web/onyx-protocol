# Performance Optimization Guide

## Overview
This document outlines the performance optimizations implemented in ONYX Protocol to achieve A+ rating standards.

## Frontend Optimizations

### 1. Build Optimizations

#### Code Splitting
- **Vendor Chunking**: Separated vendor libraries into logical chunks
  - `vendor-react`: React core libraries
  - `vendor-3d`: Three.js and 3D rendering
  - `vendor-web3`: Web3 libraries (viem, wagmi, RainbowKit)
  - `vendor-ui`: UI libraries (Framer Motion, Lucide)
  - `vendor-radix`: Radix UI components
  - `vendor-charts`: Chart libraries
  - `vendor-misc`: Other dependencies

#### Compression
- **Gzip**: Enabled for all text assets (threshold: 1KB)
- **Brotli**: Enabled for better compression ratios
- **Benefits**: 60-80% reduction in bundle size

#### Minification
- **Terser**: Advanced JavaScript minification
  - Drop console logs in production
  - Remove debugger statements
  - Pure function elimination
  - Comment removal
- **Lightning CSS**: Fast CSS minification

#### Build Configuration
```typescript
{
  target: 'es2020',
  minify: 'terser',
  cssMinify: 'lightningcss',
  chunkSizeWarningLimit: 1000,
  reportCompressedSize: true
}
```

### 2. PWA & Caching Strategy

#### Service Worker Caching
- **Google Fonts**: Cache-first (1 year)
- **Images**: Cache-first (30 days, max 60 entries)
- **API Calls**: Network-first with 10s timeout (5 min cache, max 50 entries)
- **Navigation**: Fallback to index.html with API route exclusion

#### Workbox Configuration
- Client claim and skip waiting enabled
- Runtime caching for fonts, images, and API responses
- Offline fallback support

### 3. Asset Optimization

#### Image Optimization
- Use WebP format where possible
- Implement lazy loading
- Responsive images with srcset
- PWA icons optimized (72px to 512px)

#### Font Optimization
- Google Fonts cached aggressively
- Font display: swap for better perceived performance

## Backend Optimizations

### 1. Response Compression

#### Gzip Compression
- Threshold: 1KB minimum
- Level: 6 (balanced)
- Memory level: 8
- Filters: Skip streaming and x-no-compression requests

```typescript
compression({
  threshold: 1024,
  level: 6,
  memLevel: 8,
  filter: customFilter
})
```

### 2. HTTP Caching Strategy

#### Cache Headers by Route Type

**No Cache** (Sensitive/Dynamic)
- User data, authentication endpoints
- Headers: `no-store, no-cache, must-revalidate`

**Short Cache** (5 minutes)
- Frequently changing data (gas prices, pool stats)
- Headers: `max-age=300, stale-while-revalidate=60`

**Medium Cache** (1 hour)
- Semi-static data (analytics, historical data)
- Headers: `max-age=3600, stale-while-revalidate=300`

**Long Cache** (1 day)
- Static data (contract ABIs, chain configs)
- Headers: `max-age=86400, immutable`

**Conditional Cache**
- Checks for auth headers or user-specific params
- Falls back to appropriate cache strategy

### 3. Database Optimization

#### Connection Pooling
- Prisma connection pool configured
- Prepared statements for common queries
- Query result caching where appropriate

#### Query Optimization
- Indexed columns for frequent lookups
- Efficient JOIN operations
- Pagination for large datasets

### 4. Rate Limiting with Redis

#### Redis-backed Rate Limiting
- Distributed rate limiting across instances
- Different limits per endpoint type:
  - General: 100 req/15min
  - Gas: 30 req/min
  - Analytics: 50 req/15min
  - Relay: 10 req/min
  - Governance: 20 req/15min

## Performance Metrics

### Target Metrics

#### Frontend (Lighthouse)
- Performance: 90+
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.8s
- Cumulative Layout Shift: < 0.1
- Total Blocking Time: < 200ms

#### Backend (API)
- Response time (p95): < 200ms
- Response time (p99): < 500ms
- Throughput: 1000+ req/s
- Error rate: < 0.1%

### Monitoring

#### Web Vitals
- Core Web Vitals tracked via `web-vitals` library
- Metrics sent to Sentry for analysis
- INP (Interaction to Next Paint) monitoring

#### Prometheus Metrics
- HTTP request duration histograms
- Request rate counters
- Error rate tracking
- Custom business metrics

## Best Practices

### 1. Code Optimization
- Use React.memo for expensive components
- Implement virtualization for long lists
- Debounce/throttle frequent operations
- Lazy load routes and components

### 2. Network Optimization
- Minimize API calls
- Batch requests where possible
- Use WebSocket for real-time data
- Implement request deduplication

### 3. Asset Loading
- Preload critical resources
- Defer non-critical scripts
- Use resource hints (dns-prefetch, preconnect)
- Implement progressive image loading

### 4. Runtime Performance
- Avoid unnecessary re-renders
- Use production builds
- Enable React Profiler in development
- Monitor memory usage

## Testing Performance

### Tools
- Lighthouse CI for automated audits
- WebPageTest for detailed analysis
- Chrome DevTools Performance tab
- Sentry Performance monitoring

### Load Testing
- k6 for API load testing
- Artillery for complex scenarios
- Stress testing critical endpoints
- Capacity planning based on metrics

## Next Steps

1. ✅ Implement build optimizations
2. ✅ Add compression middleware
3. ✅ Configure cache headers
4. ⏳ Set up CDN for static assets
5. ⏳ Implement database query optimization
6. ⏳ Configure load balancing
7. ⏳ Run comprehensive load tests
8. ⏳ Optimize critical rendering path

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Performance Scoring](https://web.dev/performance-scoring/)
- [HTTP Caching Best Practices](https://web.dev/http-cache/)
- [Vite Performance Guide](https://vitejs.dev/guide/performance.html)
