import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet, ArrowLeftRight, Layers, Zap, Sparkles, LayoutGrid, Globe, TrendingUp, CreditCard } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { NavOverlay } from './layout/NavOverlay';
import { SystemDiagnostics } from './debug/SystemDiagnostics';
import { FiatOnRamp } from './modals/FiatOnRamp';

export const Navbar = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isFiatOnRampOpen, setIsFiatOnRampOpen] = useState(false);
  
  const navItems = [
    { path: '/swap', icon: ArrowLeftRight, label: 'Trade' },
    { path: '/liquidity', icon: Layers, label: 'Pools' },
    { path: '/bridge', icon: Globe, label: 'Bridge' },
    { path: '/futures', icon: TrendingUp, label: 'Futures' },
    { path: '/flash-swap', icon: Zap, label: 'Vaults' },
    { action: () => setIsFiatOnRampOpen(true), icon: CreditCard, label: 'Buy' },
    { path: '/ai', icon: Sparkles, label: 'AI' },
    { action: () => setIsMenuOpen(true), icon: LayoutGrid, label: 'Menu' },
  ];

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "circOut" }}
      className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none"
    >
      <nav className="flex items-center gap-4 px-6 py-3 backdrop-blur-xl bg-black/50 border border-white/10 rounded-full shadow-2xl pointer-events-auto">
        {/* Logo */}
        <Link to="/" className="mr-2 font-heading font-bold text-xl tracking-widest text-brand-gold hover:text-white transition-colors">
          ONYX
        </Link>
        
        {/* Icons Dock */}
        <div className="flex items-center gap-1 bg-white/5 rounded-full px-2 py-1.5 border border-white/5">
          {navItems.map((item, index) => {
            const isActive = item.path && location.pathname === item.path;
            
            if (item.path) {
              return (
                <Link 
                  key={item.path} 
                  to={item.path}
                  className={`relative p-2.5 rounded-full transition-all duration-300 ${
                    isActive ? 'text-brand-void bg-brand-gold' : 'text-gray-400 hover:text-brand-void hover:bg-brand-gold'
                  }`}
                >
                  <item.icon size={18} />
                </Link>
              );
            }
            
            return (
              <button 
                key={`action-${index}`} 
                onClick={item.action}
                className="relative p-2.5 rounded-full transition-all duration-300 text-gray-400 hover:text-brand-void hover:bg-brand-gold"
              >
                <item.icon size={18} />
              </button>
            );
          })}
        </div>
        
        {/* Connect Button */}
        <div className="ml-2">
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted,
            }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div
                  {...(!ready && {
                    'aria-hidden': true,
                    'style': {
                      opacity: 0,
                      pointerEvents: 'none',
                      userSelect: 'none',
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button onClick={openConnectModal} className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold hover:bg-white text-brand-void rounded-full font-bold text-xs tracking-wider transition-all">
                          <Wallet size={14} />
                          <span>CONNECT</span>
                        </button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <button onClick={openChainModal} className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold text-xs tracking-wider transition-all">
                          <span>WRONG NETWORK</span>
                        </button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <button onClick={openAccountModal} className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold hover:bg-white text-brand-void rounded-full font-bold text-xs tracking-wider transition-all">
                          <Wallet size={14} />
                          <span>{account.displayName}</span>
                        </button>
                        <button
                          onClick={() => setIsDiagnosticsOpen(true)}
                          className="px-3 py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-full font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer hover:text-green-300"
                          title="System Diagnostics"
                        >
                          NET: {chain.name?.toUpperCase() || 'MAINNET'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </nav>
      
      {/* Nav Overlay */}
      <NavOverlay isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      {/* System Diagnostics */}
      <SystemDiagnostics isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />
      
      {/* Fiat On-Ramp */}
      <FiatOnRamp isOpen={isFiatOnRampOpen} onClose={() => setIsFiatOnRampOpen(false)} />
    </motion.header>
  );
};
