import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, TrendingUp, MessageSquare, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';

export default function Home() {
  return (
    <div className="relative w-full">
      {/* Hero Section - 100vh, centered */}
      <div className="h-screen flex items-center justify-center -mt-24">
        <Hero />
      </div>

      {/* Features Section */}
      <Features />

      {/* Ecosystem Marquee */}
      <section className="relative py-20 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-serif text-3xl md:text-4xl font-bold text-center mb-12 tracking-wider"
          >
            POWERED BY THE TITANS
          </motion.h2>
        </div>
          
        <div className="relative overflow-hidden">
          <div className="flex gap-16 animate-marquee">
            {['ARBITRUM', '0x API', 'GELATO', 'ETHEREUM', 'OPTIMISM', 'POLYGON', 'BASE', 'UNISWAP'].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="text-2xl md:text-3xl font-sans font-bold opacity-50 hover:opacity-100 hover:text-gold transition-all duration-300 whitespace-nowrap cursor-default"
              >
                {name}
              </div>
            ))}
            {['ARBITRUM', '0x API', 'GELATO', 'ETHEREUM', 'OPTIMISM', 'POLYGON', 'BASE', 'UNISWAP'].map((name, i) => (
              <div
                key={`${name}-duplicate-${i}`}
                className="text-2xl md:text-3xl font-sans font-bold opacity-50 hover:opacity-100 hover:text-gold transition-all duration-300 whitespace-nowrap cursor-default"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-serif text-5xl md:text-6xl font-bold text-center mb-20"
          >
            The Mechanics
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: MessageSquare,
                step: '01',
                title: 'Signal Intent',
                description: 'Simply tell the Concierge what you want. No complex routing required.'
              },
              {
                icon: Cpu,
                step: '02',
                title: 'AI Solver',
                description: 'Off-chain agents hunt for the best liquidity across 50+ DEXs.'
              },
              {
                icon: Zap,
                step: '03',
                title: 'Gasless Execution',
                description: 'The protocol verifies your trade and pays the gas fees instantly.'
              }
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="glass-onyx p-8 rounded-lg relative overflow-hidden group hover:scale-105 transition-transform duration-300"
              >
                <div className="absolute top-4 right-4 text-6xl font-serif font-bold text-gold/10 group-hover:text-gold/20 transition-colors">
                  {item.step}
                </div>
                <item.icon className="h-12 w-12 text-gold mb-6 relative z-10" />
                <h3 className="font-serif text-2xl font-semibold mb-4 relative z-10">
                  {item.title}
                </h3>
                <p className="text-platinum/70 leading-relaxed relative z-10">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Original Features Section */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-serif text-5xl md:text-6xl font-bold text-center mb-20"
          >
            Engineered for Excellence
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: 'Lightning Fast',
                description: 'Execute trades in milliseconds with our optimized smart contracts and gasless transactions.'
              },
              {
                icon: Shield,
                title: 'Fortress Security',
                description: 'Audited contracts, non-custodial architecture, and battle-tested protocols protect your assets.'
              },
              {
                icon: TrendingUp,
                title: 'Maximum Yield',
                description: 'Earn competitive returns through liquidity provision and governance participation.'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="glass-onyx p-8 rounded-lg group hover:scale-105 transition-transform duration-300"
              >
                <feature.icon className="h-12 w-12 text-gold mb-6" />
                <h3 className="font-serif text-2xl font-semibold mb-4">
                  {feature.title}
                </h3>
                <p className="text-platinum/70 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            {[
              { value: '$2.4B+', label: 'Total Volume' },
              { value: '150K+', label: 'Active Users' },
              { value: '99.9%', label: 'Uptime' }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
              >
                <div className="font-sans text-5xl md:text-6xl font-bold text-gold mb-3 tabular-nums">
                  {stat.value}
                </div>
                <div className="text-platinum/60 uppercase tracking-[0.2em] text-sm">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-5xl md:text-6xl font-bold mb-8">
              Ready to Begin?
            </h2>
            <p className="text-platinum/70 text-lg mb-12 leading-relaxed">
              Join thousands of traders experiencing the pinnacle of DeFi.
            </p>
            <Link to="/swap" className="inline-block">
              <button className="bg-gold text-void font-bold hover:bg-white hover:text-black transition-all px-8 py-4 uppercase tracking-widest rounded-none group">
                Start Trading
                <ArrowRight className="ml-2 h-5 w-5 inline group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-platinum/10 py-16 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Protocol */}
            <div>
              <h4 className="font-serif text-lg font-semibold mb-4 text-gold">Protocol</h4>
              <ul className="space-y-2">
                <li><Link to="/swap" className="text-platinum/60 hover:text-gold transition-colors">Swap</Link></li>
                <li><Link to="/liquidity" className="text-platinum/60 hover:text-gold transition-colors">Liquidity</Link></li>
                <li><Link to="/liquidity" className="text-platinum/60 hover:text-gold transition-colors">Pools</Link></li>
                <li><Link to="/ai" className="text-platinum/60 hover:text-gold transition-colors">AI Terminal</Link></li>
              </ul>
            </div>

            {/* Governance */}
            <div>
              <h4 className="font-serif text-lg font-semibold mb-4 text-gold">Governance</h4>
              <ul className="space-y-2">
                <li><Link to="/governance" className="text-platinum/60 hover:text-gold transition-colors">Proposals</Link></li>
                <li><Link to="/history" className="text-platinum/60 hover:text-gold transition-colors">Rewards</Link></li>
                <li><a href="https://forum.onyx.org" target="_blank" rel="noopener noreferrer" className="text-platinum/60 hover:text-gold transition-colors">Forum</a></li>
              </ul>
            </div>

            {/* Socials */}
            <div>
              <h4 className="font-serif text-lg font-semibold mb-4 text-gold">Community</h4>
              <ul className="space-y-2">
                <li><a href="https://twitter.com/OnyxProtocol" target="_blank" rel="noopener noreferrer" className="text-platinum/60 hover:text-gold transition-colors">Twitter</a></li>
                <li><a href="https://discord.gg" target="_blank" rel="noopener noreferrer" className="text-platinum/60 hover:text-gold transition-colors">Discord</a></li>
                <li><a href="https://t.me" target="_blank" rel="noopener noreferrer" className="text-platinum/60 hover:text-gold transition-colors">Telegram</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-platinum/60 hover:text-gold transition-colors">GitHub</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-serif text-lg font-semibold mb-4 text-gold">Legal</h4>
              <ul className="space-y-2">
                <li><Link to="/legal" className="text-platinum/60 hover:text-gold transition-colors">Terms</Link></li>
                <li><Link to="/legal" className="text-platinum/60 hover:text-gold transition-colors">Privacy</Link></li>
                <li><Link to="/legal" className="text-platinum/60 hover:text-gold transition-colors">Disclaimer</Link></li>
                <li><Link to="/legal" className="text-platinum/60 hover:text-gold transition-colors">Audits</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-platinum/10 pt-8 text-center">
            <p className="text-platinum/40 text-sm tracking-[0.2em]">
              © 2050 ONYX PROTOCOL. SILENCE IS LUXURY.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
