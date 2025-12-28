# ONYX - User Onboarding Guide

## Welcome to ONYX

ONYX is a decentralized exchange built with accessibility, security, and user experience as core principles. This guide will help you get started trading, providing liquidity, and managing your assets.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Connecting Your Wallet](#connecting-your-wallet)
3. [Network Selection](#network-selection)
4. [Trading Tokens](#trading-tokens)
5. [Providing Liquidity](#providing-liquidity)
6. [Flash Loans](#flash-loans)
7. [Managing Your Account](#managing-your-account)
8. [Accessibility Features](#accessibility-features)
9. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites
- A Web3 wallet (MetaMask, Rainbow, Coinbase Wallet, etc.)
- Some ETH or test tokens for gas fees
- A modern web browser (Chrome, Firefox, Safari, Edge)

### First Visit
1. Navigate to the ONYX application
2. The app will detect your system theme (light/dark mode)
3. You'll see the main navigation with Swap, Liquidity, Pools, Flash, and My Account

## Connecting Your Wallet

### Step 1: Click Connect Wallet
- Located in the top-right corner of every page
- Accessible via keyboard (Tab to navigate, Enter to activate)
- Clearly labeled with "Connect Wallet" text

### Step 2: Select Your Wallet
- Choose from popular wallet options
- Each wallet option has clear icons and names
- Use arrow keys to navigate if using keyboard

### Step 3: Approve Connection
- Your wallet will prompt you to approve the connection
- Review the permissions requested
- Approve to continue

### Network Verification
- After connecting, the app checks your wallet's network
- If on wrong network, you'll see a warning banner
- Click "Switch Network" to change to the correct chain
- All transactions are disabled until on correct network

## Network Selection

### Choosing Your Network
1. Click the **Network Settings** button (gear icon) in the top navigation
2. Select from available networks:
   - **Development Network** (Devnet): For testing, tokens have no value
   - **Test Network** (Testnet): Public testnet for final testing
   - **Mainnet**: Production network with real assets ⚠️

### Network Indicators
- **Blue dot**: Development Network
- **Yellow dot**: Test Network  
- **Green dot**: Mainnet

### Switching Networks
1. Open Network Settings dialog
2. Select desired network from dropdown
3. Read the network description and warnings
4. Click "Apply & Reload" to switch
5. Page will reload with new network configuration

⚠️ **Mainnet Warning**: When selecting Mainnet, you'll see a red warning banner. Mainnet uses real assets - always double-check transactions!

## Trading Tokens

### Swap Page Overview
The Swap page allows you to exchange one token for another instantly.

### Making a Swap
1. **Select "From" Token**
   - Click the token selector button
   - Search for token by name or paste address
   - Select from the list

2. **Enter Amount**
   - Type the amount you want to swap
   - Click "Max" to use your full balance
   - Amount must be greater than 0

3. **Select "To" Token**
   - Choose the token you want to receive
   - Cannot be the same as "From" token
   - App will prevent invalid selections

4. **Review Details**
   - Check the exchange rate
   - Review slippage tolerance (default 0.5%)
   - See estimated gas fees
   - Verify minimum received amount

5. **Adjust Settings (Optional)**
   - Click Settings icon (⚙️)
   - Adjust slippage tolerance (0.1% - 5%)
   - Set transaction deadline (1-60 minutes)
   - Press Escape or click outside to close

6. **Execute Swap**
   - Click "Swap" button
   - Review transaction in modal
   - Confirm in your wallet
   - Wait for confirmation

### Swap Status
- **Pending**: Transaction submitted to blockchain
- **Success**: Swap completed successfully
- **Failed**: Transaction reverted (you'll see why)

### Common Swap Errors
- **Insufficient Balance**: You don't have enough tokens
- **Slippage Too High**: Price moved beyond your tolerance
- **Insufficient Liquidity**: Not enough tokens in pool
- **Network Error**: Connection issue, try again

## Providing Liquidity

### Why Provide Liquidity?
- Earn trading fees from swaps
- Support the DEX ecosystem
- Receive LP tokens representing your share

### Adding Liquidity
1. Navigate to **Liquidity** page
2. Click **Add Liquidity** tab
3. Select token pair (e.g., ETH/USDC)
4. Enter amount for first token
5. Second token amount auto-calculates to maintain ratio
6. Review pool share percentage
7. Click "Add Liquidity"
8. Approve token spending (first time only)
9. Confirm transaction in wallet

### Removing Liquidity
1. Go to **Liquidity** page
2. Click **Remove Liquidity** tab
3. Select the pool
4. Choose percentage to remove (25%, 50%, 75%, 100%)
5. See estimated tokens you'll receive
6. Click "Remove Liquidity"
7. Confirm in wallet

### LP Positions
- View all your positions on **My Account** page
- See current value and earned fees
- Track pool share percentage
- Access quick remove actions

## Flash Loans

### What are Flash Loans?
Flash loans allow you to borrow tokens without collateral, as long as you repay within the same transaction.

### Using Flash Loans (Advanced)
⚠️ **Warning**: Flash loans are for advanced users and developers only.

1. Navigate to **Flash** page
2. Read the documentation and warnings
3. Ensure your address is whitelisted as a borrower
4. Select token to borrow
5. Enter loan amount
6. Provide borrower contract address
7. Add calldata for your contract (optional)
8. Review repayment amount (loan + fee)
9. Use **Dry Run** to simulate transaction
10. Execute flash loan if simulation succeeds

### Flash Loan Requirements
- Must be whitelisted borrower
- Borrower contract must implement `onFlashLoan`
- Must repay loan + fee in same transaction
- Sufficient gas for complex operations

### Safety Features
- Dry run simulation before execution
- Clear repayment preview
- Borrower validation
- Maximum loan size limits
- Detailed error messages

## Managing Your Account

### My Account Page
Access your account overview at **My Account** in navigation.

### Recent Transactions
- View all your DEX transactions
- Filter by type: All, Swaps, Liquidity, Flash Loans
- See transaction status and timestamps
- Click transaction hash to view on block explorer
- Accessible table with keyboard navigation

### LP Positions
- See all liquidity positions
- View current value and pool share
- Track earned fees
- Quick access to remove liquidity

### Transaction History Features
- **Search**: Find specific transactions
- **Filter**: By transaction type
- **Sort**: By date, amount, or status
- **Export**: Download transaction history (coming soon)

## Accessibility Features

ONYX is built to be accessible to everyone.

### Keyboard Navigation
- **Tab**: Move forward through interactive elements
- **Shift + Tab**: Move backward
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and dialogs
- **Arrow Keys**: Navigate within menus and tabs

### Screen Reader Support
- All images have descriptive alt text
- Form inputs have clear labels
- Status updates are announced
- Error messages are descriptive
- Proper heading hierarchy

### Visual Accessibility
- High contrast text (WCAG AA compliant)
- Clear focus indicators (purple ring)
- Dark mode support
- Resizable text up to 200%
- No information conveyed by color alone

### Touch Targets
- All buttons minimum 44×44 pixels
- Adequate spacing between elements
- Works on screens as small as 320px
- Optimized for mobile devices

### Customization
- **Dark Mode**: Toggle in top navigation
- **System Theme**: Auto-detects your preference
- **Text Size**: Use browser zoom (Ctrl/Cmd +)
- **Reduced Motion**: Respects system preferences

## Troubleshooting

### Wallet Won't Connect
1. Ensure wallet extension is installed and unlocked
2. Refresh the page
3. Try a different browser
4. Clear browser cache and cookies
5. Check wallet is on supported network

### Transaction Failing
1. Check you have enough tokens
2. Verify sufficient ETH for gas
3. Increase slippage tolerance if needed
4. Ensure on correct network
5. Try again with higher gas price

### Wrong Network Warning
1. Click "Switch Network" in warning banner
2. Approve network switch in wallet
3. If network not in wallet, add it manually
4. Refresh page after switching

### Tokens Not Showing
1. Ensure wallet is connected
2. Check you're on correct network
3. Verify token contract address
4. Import token manually in wallet
5. Wait for blockchain confirmation

### Page Not Loading
1. Check internet connection
2. Disable browser extensions temporarily
3. Try different browser
4. Clear cache and hard refresh (Ctrl+Shift+R)
5. Check if blockchain RPC is operational

### Accessibility Issues
1. Try keyboard navigation (Tab key)
2. Enable screen reader if needed
3. Increase browser zoom if text too small
4. Toggle dark mode for better contrast
5. Report issues to accessibility@codenut.dev

## Safety Tips

### General Security
- ✅ Always verify transaction details before confirming
- ✅ Double-check token addresses
- ✅ Start with small amounts when testing
- ✅ Keep your wallet seed phrase secure
- ✅ Use hardware wallet for large amounts

### Red Flags
- ❌ Unexpected wallet connection requests
- ❌ Tokens with suspicious names or symbols
- ❌ Unusually high slippage requirements
- ❌ Pressure to act quickly
- ❌ Requests for seed phrase or private keys

### Best Practices
1. **Test First**: Use testnet before mainnet
2. **Verify**: Check all transaction details
3. **Research**: Understand tokens before trading
4. **Backup**: Keep wallet backup secure
5. **Update**: Keep wallet software updated

## Getting Help

### Resources
- **Documentation**: Read detailed guides in docs/
- **FAQ**: Common questions answered
- **Discord**: Join community for support
- **GitHub**: Report bugs and issues
- **Email**: support@codenut.dev

### Reporting Issues
When reporting issues, include:
- Browser and version
- Wallet type and version
- Network you're using
- Steps to reproduce
- Screenshots if applicable
- Error messages

### Feature Requests
We welcome feedback! Submit feature requests via:
- GitHub Issues
- Discord community channel
- Email to feedback@codenut.dev

## Next Steps

Now that you're familiar with ONYX:

1. **Connect your wallet** and explore the interface
2. **Try a small swap** on testnet to learn the flow
3. **Provide liquidity** to earn fees
4. **Monitor your positions** on My Account page
5. **Join the community** to stay updated

Welcome to decentralized trading! 🚀

---

**Built with CodeNut** | Version 1.0.0 | [Accessibility Statement](./ACCESSIBILITY.md)
