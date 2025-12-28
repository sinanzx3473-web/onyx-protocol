import { useState, useEffect } from 'react';
import { getGPUTier } from 'detect-gpu';

interface HardwareInfo {
  isHighPerformance: boolean;
  tier: number;
  fps?: number;
}

export function useHardware(): HardwareInfo {
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo>({
    isHighPerformance: false, // Fail-safe: default to false
    tier: 0,
  });

  useEffect(() => {
    const detectHardware = async () => {
      try {
        const gpu = await getGPUTier();
        
        // Only set high performance if tier >= 2 AND fps > 30 (if available)
        const isHighPerf = 
          gpu.tier >= 2 && 
          (gpu.fps === undefined || gpu.fps > 30);

        setHardwareInfo({
          isHighPerformance: isHighPerf,
          tier: gpu.tier,
          fps: gpu.fps,
        });
      } catch (error) {
        console.warn('GPU detection failed, using low performance mode:', error);
        // Stay on low performance mode if detection fails
        setHardwareInfo({
          isHighPerformance: false,
          tier: 0,
        });
      }
    };

    detectHardware();
  }, []);

  return hardwareInfo;
}
