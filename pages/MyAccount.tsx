import { useState } from 'react';
import { useAccount } from 'wagmi';
import { User, Fingerprint, Shield, Award, Star, Zap } from 'lucide-react';

export default function MyAccountPage() {
  const { isConnected } = useAccount();
  const [settings, setSettings] = useState({
    ghostMode: true,
    mevProtection: true,
    notifications: false
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Layer A: The Passport Dashboard (Background) */}
      <div
        className={`relative transition-all duration-700 ${
          !isConnected ? 'blur-md opacity-40 pointer-events-none' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: The ID Card */}
            <div className="glass-panel p-8 rounded-2xl border border-brand-gold/30 relative overflow-hidden">
              {/* Scanning Bar Animation */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent animate-[scanVertical_3s_ease-in-out_infinite]" />
              </div>

              {/* Avatar with Hexagon */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative w-32 h-32 mb-6">
                  {/* Hexagon shape with scanning animation */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border-2 border-brand-gold animate-pulse flex items-center justify-center"
                      style={{
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                      }}
                    >
                      <User className="w-16 h-16 text-brand-gold" strokeWidth={1.5} />
                    </div>
                  </div>
                  {/* Rotating border effect */}
                  <div className="absolute inset-0 animate-spin-slow opacity-50"
                    style={{
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                      background: 'conic-gradient(from 0deg, transparent, #D4AF37, transparent)'
                    }}
                  />
                </div>

                {/* Rank */}
                <div className="text-center mb-2">
                  <h2 className="text-2xl font-heading text-brand-gold tracking-widest">
                    LEVEL 99 // ELITE TRADER
                  </h2>
                </div>

                {/* Reputation */}
                <div className="text-center mb-6">
                  <div className="text-sm font-mono text-brand-platinum/60 mb-1">REPUTATION SCORE</div>
                  <div className="text-3xl font-bold text-green-400">98/100</div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-4">
                  <div className="group relative">
                    <div className="w-12 h-12 rounded-full bg-brand-gold/20 border border-brand-gold flex items-center justify-center hover:bg-brand-gold/30 transition-all cursor-pointer">
                      <Star className="w-6 h-6 text-brand-gold" fill="currentColor" />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <div className="text-xs font-mono text-brand-gold">Early Adopter</div>
                    </div>
                  </div>
                  <div className="group relative">
                    <div className="w-12 h-12 rounded-full bg-brand-gold/20 border border-brand-gold flex items-center justify-center hover:bg-brand-gold/30 transition-all cursor-pointer">
                      <Zap className="w-6 h-6 text-brand-gold" fill="currentColor" />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <div className="text-xs font-mono text-brand-gold">Whale</div>
                    </div>
                  </div>
                  <div className="group relative">
                    <div className="w-12 h-12 rounded-full bg-brand-gold/20 border border-brand-gold flex items-center justify-center hover:bg-brand-gold/30 transition-all cursor-pointer">
                      <Award className="w-6 h-6 text-brand-gold" fill="currentColor" />
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <div className="text-xs font-mono text-brand-gold">Voter</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional ID Info */}
              <div className="space-y-4 mt-12">
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-sm font-mono text-brand-platinum/60">MEMBER SINCE</span>
                  <span className="text-sm font-mono text-brand-platinum">JAN 2024</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-sm font-mono text-brand-platinum/60">TOTAL VOLUME</span>
                  <span className="text-sm font-mono text-brand-gold">$2,450,000</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-sm font-mono text-brand-platinum/60">TRADES EXECUTED</span>
                  <span className="text-sm font-mono text-brand-platinum">1,247</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-mono text-brand-platinum/60">SUCCESS RATE</span>
                  <span className="text-sm font-mono text-green-400">94.2%</span>
                </div>
              </div>
            </div>

            {/* Right Column: The Control Panel */}
            <div className="glass-panel p-8 rounded-2xl border border-white/10">
              <h2 className="font-heading text-2xl text-brand-platinum tracking-[0.15em] mb-8">
                SYSTEM PREFERENCES
              </h2>

              <div className="space-y-6">
                {/* Ghost Mode Toggle */}
                <div className="flex items-center justify-between p-4 bg-brand-obsidian/50 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-gold" />
                    <div>
                      <div className="text-sm font-mono text-brand-platinum">Ghost Mode (Gasless)</div>
                      <div className="text-xs text-brand-platinum/50">Execute transactions without gas fees</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSetting('ghostMode')}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                      settings.ghostMode ? 'bg-brand-gold' : 'bg-gray-600'
                    }`}
                    aria-label="Toggle Ghost Mode"
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                        settings.ghostMode ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* MEV Protection Toggle */}
                <div className="flex items-center justify-between p-4 bg-brand-obsidian/50 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-gold" />
                    <div>
                      <div className="text-sm font-mono text-brand-platinum">MEV Protection</div>
                      <div className="text-xs text-brand-platinum/50">Protect against front-running attacks</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSetting('mevProtection')}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                      settings.mevProtection ? 'bg-brand-gold' : 'bg-gray-600'
                    }`}
                    aria-label="Toggle MEV Protection"
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                        settings.mevProtection ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Notifications Toggle */}
                <div className="flex items-center justify-between p-4 bg-brand-obsidian/50 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-mono text-brand-platinum">Notifications</div>
                      <div className="text-xs text-brand-platinum/50">Receive alerts for important events</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSetting('notifications')}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                      settings.notifications ? 'bg-brand-gold' : 'bg-gray-600'
                    }`}
                    aria-label="Toggle Notifications"
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${
                        settings.notifications ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Security Status */}
              <div className="mt-8 p-6 bg-gradient-to-br from-brand-gold/10 to-transparent rounded-lg border border-brand-gold/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm font-mono text-brand-platinum">SECURITY STATUS: OPTIMAL</span>
                </div>
                <p className="text-xs text-brand-platinum/60 font-mono leading-relaxed">
                  All systems operational. Your identity is encrypted and protected by military-grade security protocols.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="mt-8 space-y-3">
                <button className="w-full py-3 border border-brand-gold/30 text-brand-gold font-mono text-sm hover:bg-brand-gold/10 transition-all rounded uppercase tracking-wider">
                  Export Activity Log
                </button>
                <button className="w-full py-3 border border-white/20 text-brand-platinum font-mono text-sm hover:bg-white/5 transition-all rounded uppercase tracking-wider">
                  View Full History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layer B: Biometric Lock (Overlay) */}
      {!isConnected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
          <div className="glass-panel p-10 flex flex-col items-center border-t border-brand-gold/50 max-w-md w-full">
            {/* Pulsing Fingerprint Icon */}
            <div className="mb-6">
              <Fingerprint className="w-24 h-24 text-brand-gold animate-pulse" strokeWidth={1.5} />
            </div>

            {/* Title */}
            <h2 className="font-mono text-lg text-brand-platinum tracking-wider text-center mb-2">
              BIOMETRIC AUTHENTICATION
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-brand-platinum/50 text-center mb-6 font-mono">
              Identity verification required to access secure data
            </p>

            {/* Verify Identity Button */}
            <button className="w-full py-4 bg-brand-gold text-brand-void font-bold hover:bg-white transition-all duration-300 uppercase tracking-widest rounded">
              Verify Identity
            </button>

            {/* Security Indicators */}
            <div className="mt-8 flex items-center gap-6 text-xs font-mono text-brand-platinum/40">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                <span>ENCRYPTED</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                <span>SECURE</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                <span>PRIVATE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanning Animation Keyframes */}
      <style>{`
        @keyframes scanVertical {
          0%, 100% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          50% {
            top: 100%;
            opacity: 0.5;
          }
          90% {
            opacity: 0.5;
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
