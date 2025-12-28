import { motion } from 'framer-motion';

export const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-void">
      {/* Animated Glowing Orbs */}
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full blur-3xl opacity-20"
        style={{
          background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)',
          top: '-20%',
          left: '-10%',
        }}
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -80, 120, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-15"
        style={{
          background: 'radial-gradient(circle, #8E7216 0%, transparent 70%)',
          bottom: '-15%',
          right: '-5%',
        }}
        animate={{
          x: [0, -120, 80, 0],
          y: [0, 100, -60, 0],
          scale: [1, 0.85, 1.15, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full blur-3xl opacity-10"
        style={{
          background: 'radial-gradient(circle, #4A5568 0%, transparent 70%)',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        animate={{
          x: [0, 60, -40, 0],
          y: [0, -50, 70, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Tactical Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212, 175, 55, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212, 175, 55, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Subtle Noise Texture */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};
