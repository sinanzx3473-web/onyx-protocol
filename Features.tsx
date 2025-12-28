import { motion } from 'framer-motion';
import { Sparkles, Ghost, Zap } from 'lucide-react';

export const Features = () => {
  const features = [
    {
      id: 'concierge',
      title: 'The Concierge',
      icon: Sparkles,
      description: 'Chat with your portfolio. Execute complex strategies with natural language.',
      size: 'large',
    },
    {
      id: 'ghost',
      title: 'Ghost Mode',
      icon: Ghost,
      description: 'Relayer-powered gasless transactions. No ETH required.',
      size: 'small',
    },
    {
      id: 'flash',
      title: 'Flash Vaults',
      icon: Zap,
      description: 'Institutional arbitrage tools. Simplified.',
      size: 'small',
    },
  ];

  return (
    <section className="relative py-32 px-6 z-10">
      <div className="max-w-7xl mx-auto">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
          {/* Card 1 - Large (Left) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            whileHover={{ scale: 1.02 }}
            className="md:row-span-2 bg-obsidian/40 backdrop-blur-xl border border-gold/20 p-10 rounded-lg hover:border-gold/60 hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-300 flex flex-col justify-between min-h-[400px]"
          >
            <div>
              <Sparkles className="h-16 w-16 text-gold mb-6" />
              <h3 className="font-serif text-4xl font-bold text-platinum mb-4">
                {features[0].title}
              </h3>
              <p className="font-sans text-lg text-platinum/70 leading-relaxed">
                {features[0].description}
              </p>
            </div>
          </motion.div>

          {/* Card 2 - Small (Top Right) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            className="bg-obsidian/40 backdrop-blur-xl border border-gold/20 p-8 rounded-lg hover:border-gold/60 hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-300 flex flex-col justify-between min-h-[190px]"
          >
            <div>
              <Ghost className="h-12 w-12 text-gold mb-4" />
              <h3 className="font-serif text-2xl font-bold text-platinum mb-3">
                {features[1].title}
              </h3>
              <p className="font-sans text-base text-platinum/70 leading-relaxed">
                {features[1].description}
              </p>
            </div>
          </motion.div>

          {/* Card 3 - Small (Bottom Right) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            className="bg-obsidian/40 backdrop-blur-xl border border-gold/20 p-8 rounded-lg hover:border-gold/60 hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all duration-300 flex flex-col justify-between min-h-[190px]"
          >
            <div>
              <Zap className="h-12 w-12 text-gold mb-4" />
              <h3 className="font-serif text-2xl font-bold text-platinum mb-3">
                {features[2].title}
              </h3>
              <p className="font-sans text-base text-platinum/70 leading-relaxed">
                {features[2].description}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
