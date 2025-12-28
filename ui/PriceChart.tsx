import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface PriceChartProps {
  className?: string;
}

export function PriceChart({ className = '' }: PriceChartProps) {
  const [points, setPoints] = useState<string>('');
  const [breathingPath, setBreathingPath] = useState<string>('');

  // Generate volatile crypto-like chart path
  useEffect(() => {
    const generatePath = () => {
      const width = 600;
      const height = 300;
      const segments = 50;
      const volatility = 60;
      
      let path = `M 0,${height / 2}`;
      let currentY = height / 2;
      
      for (let i = 1; i <= segments; i++) {
        const x = (width / segments) * i;
        const randomChange = (Math.random() - 0.5) * volatility;
        currentY = Math.max(50, Math.min(height - 50, currentY + randomChange));
        
        // Use quadratic curves for smooth transitions
        const prevX = (width / segments) * (i - 1);
        const controlX = (prevX + x) / 2;
        path += ` Q ${controlX},${currentY} ${x},${currentY}`;
      }
      
      setPoints(path);
    };

    generatePath();
    const interval = setInterval(generatePath, 8000); // Regenerate every 8s for subtle animation
    
    return () => clearInterval(interval);
  }, []);

  // Create breathing animation by slightly morphing the path
  useEffect(() => {
    if (!points) return;

    const breathe = () => {
      // Create a slightly varied version of the current path
      const width = 600;
      const height = 300;
      const segments = 50;
      const microVariance = 8; // Small variance for breathing effect
      
      let path = `M 0,${height / 2}`;
      let currentY = height / 2;
      
      for (let i = 1; i <= segments; i++) {
        const x = (width / segments) * i;
        const randomChange = (Math.random() - 0.5) * microVariance;
        currentY = Math.max(50, Math.min(height - 50, currentY + randomChange));
        
        const prevX = (width / segments) * (i - 1);
        const controlX = (prevX + x) / 2;
        path += ` Q ${controlX},${currentY} ${x},${currentY}`;
      }
      
      setBreathingPath(path);
    };

    breathe();
    const interval = setInterval(breathe, 2000); // Breathe every 2s
    
    return () => clearInterval(interval);
  }, [points]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <svg
        className="w-full h-full"
        viewBox="0 0 600 300"
        preserveAspectRatio="none"
      >
        {/* Gradient fill below the line */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
          
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Fill area */}
        {points && (
          <motion.path
            d={`${points} L 600,300 L 0,300 Z`}
            fill="url(#chartGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          />
        )}

        {/* Glowing line with breathing animation */}
        {points && (
          <motion.path
            d={points}
            stroke="#D4AF37"
            strokeWidth="3"
            fill="none"
            filter="url(#glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              d: breathingPath || points,
              pathLength: 1, 
              opacity: [0.8, 1, 0.8],
            }}
            transition={{ 
              d: { duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" },
              pathLength: { duration: 2, ease: "easeInOut" },
              opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }}
          />
        )}

        {/* Grid lines for depth */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="0"
            y1={(300 / 4) * i}
            x2="600"
            y2={(300 / 4) * i}
            stroke="#D4AF37"
            strokeWidth="0.5"
            opacity="0.1"
          />
        ))}
      </svg>
    </div>
  );
}
