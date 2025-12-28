#!/bin/bash
# Automated verification script for ONYX Protocol A+ rating

set -e

echo "🔍 ONYX Protocol - Final Verification"
echo "======================================"
echo ""

BACKEND_URL="http://localhost:3001"
ERRORS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Backend Health Check
echo "1️⃣  Checking Backend Health..."
if curl -f -s "$BACKEND_URL/api/health" > /dev/null 2>&1; then
    HEALTH=$(curl -s "$BACKEND_URL/api/health" | jq -r '.status' 2>/dev/null)
    if [ "$HEALTH" = "healthy" ]; then
        check_pass "Backend is healthy"
    else
        check_fail "Backend health check failed"
    fi
else
    check_fail "Backend not responding at $BACKEND_URL"
fi
echo ""

# 2. Prometheus Metrics
echo "2️⃣  Checking Prometheus Metrics..."
if curl -f -s "$BACKEND_URL/metrics" > /dev/null 2>&1; then
    METRICS=$(curl -s "$BACKEND_URL/metrics" | grep -c "^http_" || true)
    if [ "$METRICS" -gt 0 ]; then
        check_pass "Prometheus metrics endpoint working ($METRICS metrics found)"
    else
        check_warn "Metrics endpoint accessible but no HTTP metrics found"
    fi
else
    check_fail "Prometheus metrics endpoint not accessible"
fi
echo ""

# 3. API Documentation
echo "3️⃣  Checking API Documentation..."
if curl -f -s "$BACKEND_URL/api-docs/" > /dev/null 2>&1; then
    check_pass "Swagger UI accessible"
else
    check_fail "Swagger UI not accessible"
fi

if curl -f -s "$BACKEND_URL/api-docs/swagger.json" > /dev/null 2>&1; then
    ENDPOINTS=$(curl -s "$BACKEND_URL/api-docs/swagger.json" | jq '.paths | length' 2>/dev/null)
    check_pass "Swagger JSON available ($ENDPOINTS endpoints documented)"
else
    check_fail "Swagger JSON not accessible"
fi
echo ""

# 4. Security Headers
echo "4️⃣  Checking Security Headers..."
HEADERS=$(curl -I -s "$BACKEND_URL/api/health")

if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
    check_pass "X-Content-Type-Options header present"
else
    check_fail "X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    check_pass "X-Frame-Options header present"
else
    check_fail "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
    check_pass "HSTS header present"
else
    check_warn "HSTS header missing (expected in production)"
fi

if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
    check_pass "CSP header present"
else
    check_fail "CSP header missing"
fi
echo ""

# 5. CORS Configuration
echo "5️⃣  Checking CORS Configuration..."
CORS_RESPONSE=$(curl -I -s -H "Origin: http://malicious-site.com" \
    -H "Access-Control-Request-Method: POST" \
    -X OPTIONS "$BACKEND_URL/api/orders" 2>/dev/null)

if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    check_warn "CORS headers present - verify whitelist is enforced"
else
    check_pass "CORS properly restricting unauthorized origins"
fi
echo ""

# 6. Frontend Build
echo "6️⃣  Checking Frontend Build..."
if [ -d "dist" ]; then
    check_pass "Build directory exists"
    
    # Check for compressed assets
    if ls dist/assets/*.js.gz > /dev/null 2>&1 || ls dist/assets/*.js.br > /dev/null 2>&1; then
        check_pass "Compressed assets found"
    else
        check_warn "No compressed assets found (gzip/brotli)"
    fi
    
    # Check bundle sizes
    LARGEST_JS=$(find dist/assets -name "*.js" -type f -exec ls -lh {} \; | sort -k5 -hr | head -1 | awk '{print $5, $9}')
    check_pass "Largest JS bundle: $LARGEST_JS"
else
    check_warn "Build directory not found - run 'pnpm run build'"
fi
echo ""

# 7. Environment Validation
echo "7️⃣  Checking Environment Configuration..."
if grep -q "validateEnv\|requiredEnvVars" api/src/index.ts 2>/dev/null; then
    check_pass "Environment validation configured"
else
    check_fail "Environment validation not found"
fi

if [ -f ".env.example" ]; then
    check_pass ".env.example file exists"
else
    check_warn ".env.example file missing"
fi
echo ""

# 8. Database & Migrations
echo "8️⃣  Checking Database..."
if [ -f "api/prisma/schema.prisma" ]; then
    check_pass "Prisma schema exists"
    
    # Check if migrations directory exists
    if [ -d "api/prisma/migrations" ]; then
        MIGRATION_COUNT=$(find api/prisma/migrations -type d -mindepth 1 | wc -l)
        check_pass "Migrations directory exists ($MIGRATION_COUNT migrations)"
    else
        check_warn "No migrations directory found"
    fi
else
    check_warn "Prisma schema not found"
fi
echo ""

# 9. CI/CD Configuration
echo "9️⃣  Checking CI/CD Pipeline..."
if [ -f ".github/workflows/ci.yml" ]; then
    check_pass "CI workflow configured"
else
    check_fail "CI workflow missing"
fi

if [ -f ".github/workflows/contract-deploy.yml" ]; then
    check_pass "Contract deployment workflow configured"
else
    check_warn "Contract deployment workflow missing"
fi

if [ -f ".lighthouserc.json" ]; then
    check_pass "Lighthouse CI configured"
else
    check_warn "Lighthouse CI not configured"
fi
echo ""

# 10. Load Testing
echo "🔟 Checking Load Testing..."
if [ -d "load-tests" ]; then
    check_pass "Load tests directory exists"
    
    TEST_FILES=$(find load-tests -name "*.js" -type f | wc -l)
    check_pass "Found $TEST_FILES load test scripts"
else
    check_fail "Load tests directory missing"
fi
echo ""

# 11. Documentation
echo "1️⃣1️⃣  Checking Documentation..."
if [ -f "README.md" ]; then
    README_SIZE=$(wc -l < README.md)
    check_pass "README.md exists ($README_SIZE lines)"
else
    check_fail "README.md missing"
fi

if [ -f "A_PLUS_ROADMAP.md" ]; then
    check_pass "A+ Roadmap documented"
else
    check_warn "A+ Roadmap documentation missing"
fi

if [ -f "FINAL_VERIFICATION.md" ]; then
    check_pass "Final verification checklist exists"
else
    check_warn "Final verification checklist missing"
fi
echo ""

# 12. Monitoring Configuration
echo "1️⃣2️⃣  Checking Monitoring Setup..."
if grep -r "Sentry.init" src/ > /dev/null 2>&1; then
    check_pass "Frontend Sentry configured"
else
    check_warn "Frontend Sentry not configured"
fi

if grep -r "@sentry/node" api/src/ > /dev/null 2>&1; then
    check_pass "Backend Sentry configured"
else
    check_warn "Backend Sentry not configured"
fi

if [ -d "api/logs" ]; then
    check_pass "Logging directory exists"
else
    check_warn "Logging directory not found"
fi
echo ""

# Summary
echo "======================================"
echo "📊 Verification Summary"
echo "======================================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
    echo -e "${GREEN}✨ ONYX Protocol is ready for A+ rating${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS critical issues${NC}"
    echo -e "${YELLOW}⚠️  Please address the issues above before deployment${NC}"
    exit 1
fi
