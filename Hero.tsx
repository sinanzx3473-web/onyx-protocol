import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const Hero = () => {
  return (
    <div className="px-6 relative z-10 pt-40">
      <div className="max-w-6xl mx-auto">
        {/* Luxury Header Container */}
        <div className="relative">
          {/* Decorative top border */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-px bg-gradient-to-r from-transparent via-gold to-transparent mb-16"
          />

          {/* Main Content */}
          <div className="text-center">
            {/* Overline - Luxury Brand Mark */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-8"
            >
              <span className="inline-block font-sans text-xs uppercase tracking-[0.3em] text-gold/60 border border-gold/30 px-6 py-2 rounded-full">
                Liquidity Refined
              </span>
            </motion.div>

            {/* Headline - Unmask Animation */}
            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
              className="font-serif text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-platinum mb-6 tracking-tight leading-[0.95]"
            >
              SILENCE IS
              <br />
              <span className="bg-gradient-to-r from-gold via-gold/90 to-gold/70 bg-clip-text text-transparent">
                LUXURY
              </span>
            </motion.h1>

            {/* Decorative divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
              className="w-24 h-px bg-gold/50 mx-auto mb-8"
            />

            {/* Sub-headline - Fade In */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
              className="font-sans text-lg md:text-xl text-platinum/60 mb-4 leading-relaxed max-w-3xl mx-auto"
            >
              The first AI-native liquidity protocol.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1, ease: "easeOut" }}
              className="flex items-center justify-center gap-6 mb-16 font-sans text-sm uppercase tracking-widest text-gold/70"
            >
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
                Gasless
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
                Instant
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
                Private
              </span>
            </motion.div>

            {/* Buttons - Slide Up */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1.2, ease: "easeOut" }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            >
              <Link to="/swap">
                <button className="group relative px-10 py-5 bg-gold text-black font-sans font-bold text-base uppercase tracking-wider overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-gold/30">
                  <span className="relative z-10">Enter Vault</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-gold/90 to-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>
              </Link>
              
              <Link to="/manifesto">
                <button className="group relative px-10 py-5 bg-transparent border-2 border-gold/50 text-gold font-sans font-bold text-base uppercase tracking-wider hover:border-gold hover:bg-gold/5 transition-all duration-300">
                  <span className="relative z-10">Read Manifesto</span>
                </button>
              </Link>
            </motion.div>
          </div>

          {/* Decorative bottom border */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
            className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent mt-16"
          />
        </div>
      </div>
    </div>
  );
};
