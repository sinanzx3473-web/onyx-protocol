# CI/CD Pipeline Documentation

## Overview
Comprehensive CI/CD pipeline for ONYX Protocol ensuring code quality, security, and automated deployments.

## Pipeline Architecture

### 1. Continuous Integration (CI)

#### Frontend Tests
- **Type Checking**: TypeScript compilation validation
- **Linting**: ESLint code quality checks
- **Build**: Production build verification
- **Artifacts**: Build output stored for deployment

#### Backend Tests
- **Type Checking**: TypeScript validation
- **Unit Tests**: API endpoint testing
- **Integration Tests**: Database and Redis integration
- **Services**: Redis container for testing

#### Smart Contract Tests
- **Forge Tests**: Comprehensive Solidity test suite
- **Coverage**: Code coverage reporting (target: >90%)
- **Gas Optimization**: Gas usage analysis
- **Security**: Static analysis with Slither

#### E2E Tests
- **Playwright**: Browser automation testing
- **Critical Flows**: Swap, liquidity, governance
- **Cross-browser**: Chromium testing
- **Visual Regression**: Screenshot comparison

### 2. Security Scanning

#### Trivy Vulnerability Scanner
- **Filesystem Scan**: Dependency vulnerabilities
- **SARIF Output**: GitHub Security integration
- **Severity Levels**: Critical, High, Medium

#### NPM Audit
- **Dependency Audit**: Known vulnerabilities
- **Audit Level**: Moderate and above
- **Auto-fix**: Automated security patches

#### Dependency Review
- **License Compliance**: GPL/AGPL blocking
- **Severity Gating**: Moderate+ failures
- **PR Comments**: Automated review summaries

### 3. Performance Monitoring

#### Lighthouse CI
- **Performance**: 90+ score target
- **Accessibility**: 90+ score target
- **Best Practices**: 90+ score target
- **SEO**: 90+ score target

#### Core Web Vitals
- **FCP**: < 1.8s (First Contentful Paint)
- **LCP**: < 2.5s (Largest Contentful Paint)
- **CLS**: < 0.1 (Cumulative Layout Shift)
- **TBT**: < 200ms (Total Blocking Time)

### 4. Deployment Strategy

#### Preview Deployments (PRs)
- **Trigger**: Pull request creation/update
- **Platform**: Netlify preview
- **URL**: Unique preview URL per PR
- **Comments**: Automated PR comments with preview link

#### Production Deployments (Main)
- **Trigger**: Push to main branch
- **Gating**: All tests must pass
- **Platform**: Netlify production
- **Sentry**: Release tracking and monitoring

#### Smart Contract Deployments
- **Trigger**: Manual workflow dispatch
- **Networks**: Testnet and mainnet support
- **Verification**: Etherscan contract verification
- **Artifacts**: Deployment records stored

## GitHub Actions Workflows

### Main CI Pipeline (`.github/workflows/ci.yml`)
```yaml
Triggers:
  - Push to main/develop
  - Pull requests to main/develop

Jobs:
  1. frontend-test
  2. backend-test
  3. contract-test
  4. e2e-test
  5. security-scan
  6. lighthouse
  7. deploy-preview (PR only)
  8. deploy-production (main only)
```

### Contract Deployment (`.github/workflows/contract-deploy.yml`)
```yaml
Trigger: Manual workflow dispatch

Inputs:
  - network: Target blockchain network
  - verify: Enable Etherscan verification

Steps:
  1. Run tests
  2. Deploy contracts
  3. Verify on Etherscan
  4. Upload artifacts
```

### Dependency Review (`.github/workflows/dependency-review.yml`)
```yaml
Trigger: Pull requests

Checks:
  - Vulnerability severity
  - License compliance
  - Breaking changes
```

## Required Secrets

### GitHub Secrets Configuration

#### Frontend
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WALLETCONNECT_PROJECT_ID
```

#### Deployment
```
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID
```

#### Monitoring
```
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
LHCI_GITHUB_APP_TOKEN
```

#### Smart Contracts
```
DEPLOYER_PRIVATE_KEY
ETHERSCAN_API_KEY
```

#### Code Coverage
```
CODECOV_TOKEN
```

## Dependabot Configuration

### Update Schedule
- **Frequency**: Weekly (Mondays)
- **Scope**: Frontend, Backend, GitHub Actions
- **Limits**: 10 open PRs per ecosystem
- **Auto-merge**: Patch and minor updates

### Security Updates
- **Priority**: Critical and High severity
- **Auto-merge**: Security patches
- **Notifications**: Slack/Email alerts

## Branch Protection Rules

### Main Branch
```yaml
Required:
  - Status checks must pass
  - Require pull request reviews (2 approvals)
  - Require conversation resolution
  - Require linear history
  - Include administrators

Restrictions:
  - Restrict force pushes
  - Restrict deletions
```

### Develop Branch
```yaml
Required:
  - Status checks must pass
  - Require pull request reviews (1 approval)
  - Require conversation resolution
```

## Deployment Environments

### Preview Environment
- **URL Pattern**: `https://deploy-preview-{PR#}--onyx.netlify.app`
- **Lifetime**: Until PR is closed
- **Purpose**: Testing and review

### Staging Environment
- **Branch**: develop
- **URL**: `https://staging.onyx.io`
- **Purpose**: Pre-production testing

### Production Environment
- **Branch**: main
- **URL**: `https://app.onyx.io`
- **Purpose**: Live application

## Monitoring and Alerts

### Build Notifications
- **Slack**: Build status updates
- **Email**: Failure notifications
- **GitHub**: Status checks on PRs

### Performance Alerts
- **Lighthouse**: Score degradation alerts
- **Sentry**: Error rate monitoring
- **Prometheus**: API performance metrics

## Best Practices

### 1. Commit Messages
```
feat: Add new feature
fix: Bug fix
chore: Maintenance tasks
docs: Documentation updates
test: Test additions/updates
refactor: Code refactoring
perf: Performance improvements
ci: CI/CD changes
```

### 2. Pull Request Process
1. Create feature branch from develop
2. Implement changes with tests
3. Push and create PR
4. Wait for CI checks to pass
5. Request reviews
6. Address feedback
7. Merge when approved

### 3. Release Process
1. Merge develop to main
2. Tag release (v1.0.0)
3. Automated deployment to production
4. Monitor Sentry for errors
5. Verify Lighthouse scores

### 4. Hotfix Process
1. Create hotfix branch from main
2. Implement fix with tests
3. Fast-track review
4. Merge to main and develop
5. Deploy immediately

## Rollback Procedures

### Frontend Rollback
```bash
# Netlify CLI
netlify rollback

# Or via dashboard
# Navigate to Deploys → Select previous deploy → Publish
```

### Backend Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or redeploy previous version
git checkout <previous-commit>
git push origin main --force
```

### Smart Contract Rollback
- **Not Possible**: Contracts are immutable
- **Mitigation**: Deploy new version with fixes
- **Governance**: Use timelock for upgrades

## Performance Optimization

### Build Optimization
- **Caching**: Node modules, build artifacts
- **Parallelization**: Run jobs concurrently
- **Artifacts**: Reuse between jobs

### Test Optimization
- **Selective Testing**: Run only affected tests
- **Test Sharding**: Split E2E tests across runners
- **Caching**: Cache Playwright browsers

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clear cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Test Failures
```bash
# Run tests locally
pnpm test

# Debug E2E tests
pnpm exec playwright test --debug
```

#### Deployment Failures
```bash
# Check Netlify logs
netlify deploy --prod --debug

# Verify environment variables
netlify env:list
```

## Metrics and KPIs

### CI/CD Metrics
- **Build Time**: < 10 minutes
- **Test Coverage**: > 80%
- **Deployment Frequency**: Multiple per day
- **Mean Time to Recovery**: < 1 hour
- **Change Failure Rate**: < 5%

### Quality Metrics
- **Lighthouse Performance**: > 90
- **Security Vulnerabilities**: 0 critical/high
- **Code Coverage**: > 80%
- **E2E Test Pass Rate**: > 95%

## Next Steps

1. ✅ Configure GitHub Actions workflows
2. ✅ Set up Lighthouse CI
3. ✅ Configure Dependabot
4. ⏳ Add required secrets to GitHub
5. ⏳ Configure branch protection rules
6. ⏳ Set up Slack notifications
7. ⏳ Configure Sentry releases
8. ⏳ Test full deployment pipeline

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Netlify Deploy Documentation](https://docs.netlify.com/site-deploys/overview/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
