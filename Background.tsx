import React from 'react';

export const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black">
      {/* Floating orbs */}
      <div className="orb orb-gold" />
      <div className="orb orb-bronze" />
      <div className="orb orb-dark" />
      
      {/* Film grain noise overlay */}
      <div className="noise-overlay" />
      
      <style>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.3;
          will-change: transform;
        }
        
        .orb-gold {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, #D4AF37 0%, transparent 70%);
          top: -200px;
          left: -200px;
          animation: float-gold 25s ease-in-out infinite;
        }
        
        .orb-bronze {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, #8E7216 0%, transparent 70%);
          bottom: -150px;
          right: -150px;
          animation: float-bronze 30s ease-in-out infinite;
        }
        
        .orb-dark {
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, #1A1A1A 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: float-dark 35s ease-in-out infinite;
        }
        
        @keyframes float-gold {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30vw, 20vh) scale(1.1);
          }
          66% {
            transform: translate(-10vw, 30vh) scale(0.9);
          }
        }
        
        @keyframes float-bronze {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(-25vw, -15vh) scale(0.95);
          }
          66% {
            transform: translate(15vw, -25vh) scale(1.05);
          }
        }
        
        @keyframes float-dark {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
          }
          33% {
            transform: translate(-40%, -60%) scale(1.15);
          }
          66% {
            transform: translate(-60%, -40%) scale(0.85);
          }
        }
        
        .noise-overlay {
          position: absolute;
          inset: 0;
          opacity: 0.05;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          pointer-events: none;
          animation: grain 8s steps(10) infinite;
        }
        
        @keyframes grain {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -10%); }
          20% { transform: translate(-15%, 5%); }
          30% { transform: translate(7%, -25%); }
          40% { transform: translate(-5%, 25%); }
          50% { transform: translate(-15%, 10%); }
          60% { transform: translate(15%, 0%); }
          70% { transform: translate(0%, 15%); }
          80% { transform: translate(3%, 35%); }
          90% { transform: translate(-10%, 10%); }
        }
      `}</style>
    </div>
  );
};
