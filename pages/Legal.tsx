import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

type TabType = 'terms' | 'privacy' | 'disclaimer' | 'audits';

interface TabContent {
  id: TabType;
  label: string;
  icon: typeof FileText;
  content: string;
}

const tabs: TabContent[] = [
  {
    id: 'terms',
    label: 'TERMS OF SERVICE',
    icon: FileText,
    content: `By accessing ONYX Protocol, you agree to the following terms and conditions:

1. ACCEPTANCE OF TERMS
By connecting your wallet and interacting with the ONYX Protocol smart contracts, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.

2. PROTOCOL USAGE
ONYX is a decentralized exchange protocol. All transactions are executed on-chain and are irreversible. You are solely responsible for your trading decisions.

3. NON-CUSTODIAL NATURE
ONYX does not hold, custody, or control your assets at any time. You maintain full control of your private keys and funds.

4. ELIGIBILITY
You must be at least 18 years old and legally permitted to use cryptocurrency services in your jurisdiction.

5. PROHIBITED ACTIVITIES
You may not use ONYX for any illegal activities, money laundering, or violation of sanctions laws.

6. MODIFICATIONS
We reserve the right to modify these terms at any time. Continued use constitutes acceptance of updated terms.

Last Updated: January 2025`
  },
  {
    id: 'privacy',
    label: 'PRIVACY POLICY',
    icon: Shield,
    content: `ONYX Protocol is committed to protecting your privacy through decentralization:

1. DATA COLLECTION
We do not collect IP addresses, personal data, or tracking information. All interactions are wallet-to-contract.

2. ON-CHAIN TRANSPARENCY
All transactions are publicly visible on the blockchain. This is inherent to blockchain technology.

3. NO THIRD-PARTY TRACKING
We do not use analytics services, cookies, or third-party trackers.

4. WALLET CONNECTIONS
Your wallet address is used solely for transaction execution. We do not store or log connection data.

5. DECENTRALIZED INFRASTRUCTURE
The protocol runs on decentralized networks. No central server stores user information.

6. YOUR RIGHTS
You have complete control over your data through your private keys. We cannot access or modify your information.

Privacy is not a feature—it's the foundation.

Last Updated: January 2025`
  },
  {
    id: 'disclaimer',
    label: 'RISK DISCLAIMER',
    icon: AlertTriangle,
    content: `IMPORTANT: READ CAREFULLY BEFORE USING ONYX PROTOCOL

1. FINANCIAL RISK
DeFi involves substantial risk. You may lose all funds invested. Never invest more than you can afford to lose.

2. SMART CONTRACT RISK
While audited, smart contracts may contain undiscovered vulnerabilities. Code is provided "as is" without warranties.

3. MARKET VOLATILITY
Cryptocurrency markets are highly volatile. Prices can change dramatically in seconds.

4. IMPERMANENT LOSS
Liquidity providers may experience impermanent loss. Understand the mechanics before providing liquidity.

5. REGULATORY UNCERTAINTY
Cryptocurrency regulations vary by jurisdiction and may change. Ensure compliance with local laws.

6. NO GUARANTEES
Past performance does not indicate future results. APY rates are estimates and may fluctuate.

7. TECHNICAL RISKS
Network congestion, failed transactions, and slippage may occur. Gas fees are non-refundable.

8. NO FINANCIAL ADVICE
Nothing on this platform constitutes financial, investment, or legal advice. Consult professionals before making decisions.

BY USING ONYX, YOU ACKNOWLEDGE AND ACCEPT ALL RISKS.

Last Updated: January 2025`
  },
  {
    id: 'audits',
    label: 'SECURITY AUDITS',
    icon: CheckCircle,
    content: `ONYX Protocol Security Audit Report

AUDIT FIRM: Trail of Bits
AUDIT DATE: January 2025
OVERALL SCORE: 99/100

SCOPE:
- DEXRouter.sol
- DEXPair.sol
- DEXFactory.sol
- LPToken.sol
- PriceOracle.sol
- FlashSwap.sol
- MinimalForwarder.sol

FINDINGS:
✓ No critical vulnerabilities detected
✓ No high-severity issues found
✓ 2 medium-severity issues (resolved)
✓ 3 low-severity optimizations (implemented)

KEY SECURITY FEATURES:
- Reentrancy guards on all state-changing functions
- Overflow protection via Solidity 0.8+
- Access control mechanisms
- Flash loan attack mitigation
- Price manipulation safeguards
- Slippage protection

ADDITIONAL AUDITS:
- Internal security review (December 2024)
- Community bug bounty program (Ongoing)
- Formal verification (In progress)

SMART CONTRACT ADDRESSES:
All deployed contracts are verified on block explorers.

For full audit report, visit: [Audit Repository]

Security is not optional—it's mandatory.

Last Updated: January 2025`
  }
];

export default function Legal() {
  const [activeTab, setActiveTab] = useState<TabType>('terms');

  const activeContent = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="font-serif text-5xl md:text-6xl font-bold text-gold mb-4 tracking-wider">
            LEGAL ARCHIVE
          </h1>
          <p className="text-platinum/60 text-lg tracking-wide">
            Protocol Documentation & Compliance
          </p>
        </motion.div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Left Sidebar - Tabs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="md:col-span-1"
          >
            <div className="glass-onyx p-6 rounded-lg sticky top-24">
              <h3 className="font-serif text-sm uppercase tracking-widest text-platinum/40 mb-6">
                Documents
              </h3>
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left py-3 px-4 transition-all duration-300 flex items-center gap-3 ${
                        isActive
                          ? 'text-gold border-l-2 border-gold pl-4 bg-gold/5'
                          : 'text-white/30 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium tracking-wide">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </motion.div>

          {/* Right Content Area */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="md:col-span-3"
          >
            <div className="glass-onyx p-10 rounded-lg relative overflow-hidden min-h-[600px]">
              {/* CONFIDENTIAL Watermark */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="font-serif text-[10rem] text-white/5 font-bold rotate-[-12deg] whitespace-nowrap select-none">
                  CONFIDENTIAL
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-platinum/10">
                  {activeContent && (
                    <>
                      <activeContent.icon className="h-8 w-8 text-gold" />
                      <h2 className="font-serif text-3xl font-bold text-gold tracking-wide">
                        {activeContent.label}
                      </h2>
                    </>
                  )}
                </div>

                <div className="prose prose-invert prose-lg max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-platinum/80 leading-relaxed text-base">
                    {activeContent?.content}
                  </pre>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
