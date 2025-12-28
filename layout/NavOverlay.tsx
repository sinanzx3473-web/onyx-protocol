import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface NavOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NavOverlay: React.FC<NavOverlayProps> = ({ isOpen, onClose }) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const menuCategories = [
    {
      title: 'PROTOCOL',
      links: [
        { path: '/swap', label: 'Swap' },
        { path: '/liquidity', label: 'Liquidity' },
        { path: '/pools', label: 'Pools' },
        { path: '/flash-swap', label: 'Flash Swap' },
      ],
    },
    {
      title: 'GOVERNANCE',
      links: [
        { path: '/governance', label: 'DAO Overview' },
        { path: '/governance', label: 'Proposals' },
        { path: '/rewards', label: 'Rewards' },
      ],
    },
    {
      title: 'ACCOUNT',
      links: [
        { path: '/portfolio', label: 'Portfolio' },
        { path: '/my-account', label: 'My Account' },
        { path: '/my-alerts', label: 'Alerts' },
        { path: '/transaction-history', label: 'History' },
      ],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] bg-brand-obsidian/90 backdrop-blur-2xl pointer-events-auto"
          onClick={onClose}
        >
          {/* Massive ONYX Watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
            <h1 className="text-[20vw] text-white/5 font-heading leading-none tracking-tighter">
              ONYX
            </h1>
          </div>

          <div className="container mx-auto px-8 py-16 h-full flex flex-col relative z-10" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <div className="flex justify-end mb-12">
              <button
                onClick={onClose}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-brand-platinum transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Menu Grid with Cascade Animation */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-16 max-w-6xl mx-auto w-full"
            >
              {menuCategories.map((category) => (
                <motion.div 
                  key={category.title} 
                  variants={itemVariants}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  {/* Gold Decor Line */}
                  <div className="h-px w-16 bg-gradient-to-r from-brand-gold to-transparent mb-4" />

                  {/* Category Header with Flash Effect */}
                  <h2
                    className="font-heading text-brand-gold text-2xl tracking-widest cursor-default transition-all duration-75"
                    onMouseEnter={() => setHoveredCategory(category.title)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    style={{
                      color: hoveredCategory === category.title ? '#ffffff' : undefined,
                    }}
                  >
                    {category.title}
                  </h2>

                  {/* Links with Slide & Glow Effect */}
                  <nav className="space-y-4">
                    {category.links.map((link) => (
                      <Link
                        key={link.path + link.label}
                        to={link.path}
                        onClick={onClose}
                        className="block font-mono text-brand-platinum/50 text-2xl tracking-widest transition-all duration-300 cursor-pointer hover:text-brand-gold hover:pl-4 hover:border-l-2 hover:border-brand-gold hover:text-glow"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </motion.div>
              ))}
            </motion.div>

            {/* System Status Bar */}
            <div className="text-center mt-12 pt-8 border-t border-white/5">
              <p className="font-mono text-brand-platinum/30 text-xs tracking-widest">
                SYS.VER.3.0 // CONNECTED TO MAINNET // LATENCY: 12ms
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
