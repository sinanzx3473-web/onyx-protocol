# Contributing to DexCore

Thank you for your interest in contributing to DexCore! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Security Vulnerabilities](#security-vulnerabilities)
- [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, background, or identity.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, trolling, or discriminatory comments
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18+ and pnpm installed
- Foundry installed for smart contract development
- Git for version control
- A GitHub account

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/dexcore.git
cd dexcore
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/dexcore.git
```

4. Install dependencies:

```bash
pnpm install
cd contracts && forge install
```

## Development Workflow

### Branch Naming Convention

Use descriptive branch names following this pattern:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `test/description` - Test additions or modifications
- `refactor/description` - Code refactoring
- `chore/description` - Maintenance tasks

**Examples:**
```
feature/add-staking-rewards
fix/liquidity-calculation-overflow
docs/update-api-reference
test/add-flashswap-edge-cases
```

### Development Process

1. **Create a new branch:**

```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes:**
   - Write clean, well-documented code
   - Follow the coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes:**

```bash
# Run smart contract tests
cd contracts
forge test

# Run frontend tests
cd frontend
pnpm test

# Run backend tests
cd backend
pnpm test
```

4. **Commit your changes:**

```bash
git add .
git commit -m "feat: add staking rewards functionality"
```

### Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(contracts): add flash loan fee configuration

Implement configurable flash loan fees with governance controls.
Includes events for fee updates and validation checks.

Closes #123
```

```
fix(frontend): resolve wallet connection race condition

Fix issue where rapid wallet connections could cause state
inconsistency in the swap interface.

Fixes #456
```

## Coding Standards

### Solidity Contracts

#### Style Guide

Follow the [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MyContract
 * @notice Brief description of contract purpose
 * @dev Detailed implementation notes
 */
contract MyContract {
    // State variables
    uint256 public constant MAX_FEE = 1000;
    mapping(address => uint256) private balances;
    
    // Events
    event BalanceUpdated(address indexed user, uint256 newBalance);
    
    // Errors
    error InvalidAmount();
    error Unauthorized();
    
    // Modifiers
    modifier onlyPositive(uint256 amount) {
        if (amount == 0) revert InvalidAmount();
        _;
    }
    
    // Functions (ordered: constructor, external, public, internal, private)
    
    /**
     * @notice Updates user balance
     * @param user The user address
     * @param amount The amount to add
     */
    function updateBalance(address user, uint256 amount) 
        external 
        onlyPositive(amount) 
    {
        balances[user] += amount;
        emit BalanceUpdated(user, balances[user]);
    }
}
```

#### Best Practices

- **Use custom errors** instead of require strings for gas efficiency
- **Emit events** for all state changes
- **Add NatSpec comments** to all public/external functions
- **Use checks-effects-interactions** pattern to prevent reentrancy
- **Validate inputs** thoroughly
- **Use SafeERC20** for token transfers
- **Avoid floating pragmas** - pin to specific version

#### Security Checklist

- [ ] Reentrancy guards on external calls
- [ ] Integer overflow/underflow protection
- [ ] Access control on sensitive functions
- [ ] Input validation on all parameters
- [ ] Safe math operations
- [ ] Proper event emission
- [ ] Gas optimization without sacrificing security

### TypeScript/React (Frontend)

#### Style Guide

```typescript
// Use functional components with TypeScript
interface SwapFormProps {
  onSwap: (tokenA: string, tokenB: string, amount: bigint) => Promise<void>;
  disabled?: boolean;
}

export const SwapForm: React.FC<SwapFormProps> = ({ onSwap, disabled = false }) => {
  const [amount, setAmount] = useState<string>('');
  const [tokenA, setTokenA] = useState<string>('');
  
  const handleSwap = async () => {
    try {
      await onSwap(tokenA, tokenB, parseEther(amount));
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };
  
  return (
    <form onSubmit={handleSwap}>
      {/* Form content */}
    </form>
  );
};
```

#### Best Practices

- Use TypeScript strict mode
- Prefer functional components and hooks
- Use proper error boundaries
- Implement loading and error states
- Follow React best practices for performance
- Use wagmi hooks for blockchain interactions
- Implement proper wallet connection handling

### Node.js/Express (Backend)

#### Style Guide

```typescript
// Use async/await with proper error handling
import { Request, Response, NextFunction } from 'express';

export const getPoolStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { poolId } = req.params;
    
    const stats = await prisma.pool.findUnique({
      where: { id: poolId },
      include: { swaps: true }
    });
    
    if (!stats) {
      res.status(404).json({ error: 'Pool not found' });
      return;
    }
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
};
```

#### Best Practices

- Use TypeScript for type safety
- Implement proper error handling middleware
- Validate inputs with Zod or similar
- Use environment variables for configuration
- Implement rate limiting
- Add request logging
- Use Prisma for database operations

## Testing Guidelines

### Smart Contract Tests

All smart contracts must have comprehensive test coverage:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MyContract} from "../src/MyContract.sol";

contract MyContractTest is Test {
    MyContract public myContract;
    address public user = address(0x1);
    
    function setUp() public {
        myContract = new MyContract();
    }
    
    function test_UpdateBalance() public {
        vm.prank(user);
        myContract.updateBalance(user, 100);
        assertEq(myContract.balances(user), 100);
    }
    
    function testFuzz_UpdateBalance(uint256 amount) public {
        vm.assume(amount > 0 && amount < type(uint128).max);
        vm.prank(user);
        myContract.updateBalance(user, amount);
        assertEq(myContract.balances(user), amount);
    }
    
    function test_RevertWhen_AmountIsZero() public {
        vm.expectRevert(MyContract.InvalidAmount.selector);
        myContract.updateBalance(user, 0);
    }
}
```

**Requirements:**
- Minimum 95% code coverage
- Test all edge cases
- Include fuzz tests for numeric inputs
- Test revert conditions
- Verify event emissions
- Test access control

### Frontend Tests

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SwapForm } from './SwapForm';

describe('SwapForm', () => {
  it('should call onSwap with correct parameters', async () => {
    const mockOnSwap = jest.fn();
    render(<SwapForm onSwap={mockOnSwap} />);
    
    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '100' }
    });
    
    fireEvent.click(screen.getByText('Swap'));
    
    expect(mockOnSwap).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      parseEther('100')
    );
  });
});
```

### Backend Tests

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('GET /api/pools/:poolId', () => {
  it('should return pool stats', async () => {
    const response = await request(app)
      .get('/api/pools/pool-123')
      .expect(200);
    
    expect(response.body).toHaveProperty('id', 'pool-123');
    expect(response.body).toHaveProperty('swaps');
  });
  
  it('should return 404 for non-existent pool', async () => {
    await request(app)
      .get('/api/pools/invalid')
      .expect(404);
  });
});
```

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass:**

```bash
# Smart contracts
cd contracts && forge test

# Frontend
cd frontend && pnpm test

# Backend
cd backend && pnpm test
```

2. **Check code coverage:**

```bash
cd contracts && forge coverage
```

3. **Run linters:**

```bash
cd frontend && pnpm lint
cd backend && pnpm lint
```

4. **Update documentation** if needed

5. **Rebase on latest main:**

```bash
git fetch upstream
git rebase upstream/main
```

### Submitting a Pull Request

1. **Push your branch:**

```bash
git push origin feature/your-feature-name
```

2. **Create a pull request** on GitHub with:
   - Clear title following commit convention
   - Detailed description of changes
   - Reference to related issues
   - Screenshots for UI changes
   - Test results

3. **PR Template:**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing
- [ ] Code coverage maintained/improved

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added for new functionality
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by at least one maintainer
3. **Address feedback** and push updates
4. **Approval** from maintainer(s)
5. **Merge** by maintainer

### After Merge

1. Delete your feature branch
2. Pull latest main
3. Celebrate! 🎉

## Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Instead, please email security@dexcore.example.com with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

See [SECURITY.md](./SECURITY.md) for our security policy and responsible disclosure process.

## Community

### Communication Channels

- **GitHub Discussions**: For general questions and discussions
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: For real-time chat and community support
- **Twitter**: For announcements and updates

### Getting Help

- Check existing issues and discussions
- Read the documentation
- Ask in Discord #dev-help channel
- Open a GitHub discussion for complex questions

### Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Community highlights

## License

By contributing to DexCore, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to DexCore! Your efforts help make decentralized finance more accessible and secure for everyone.
