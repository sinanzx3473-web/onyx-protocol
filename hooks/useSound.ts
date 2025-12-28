import { useCallback, useRef, useEffect } from 'react';

// Base64 encoded minimal sound files (placeholder - can be replaced with actual audio)
const SOUNDS = {
  hover: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
  success: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
  error: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
};

type SoundType = keyof typeof SOUNDS;

interface UseSoundOptions {
  enabled?: boolean;
  volume?: number;
}

export function useSound(options: UseSoundOptions = {}) {
  const { enabled = true, volume = 0.3 } = options;
  const audioRefs = useRef<Map<SoundType, HTMLAudioElement>>(new Map());

  useEffect(() => {
    // Initialize audio elements
    Object.entries(SOUNDS).forEach(([type, src]) => {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.preload = 'auto';
      audioRefs.current.set(type as SoundType, audio);
    });

    return () => {
      // Cleanup
      audioRefs.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioRefs.current.clear();
    };
  }, [volume]);

  const play = useCallback(
    (type: SoundType) => {
      if (!enabled) return;

      const audio = audioRefs.current.get(type);
      if (audio) {
        // Reset to start and play
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Silently fail if autoplay is blocked
        });
      }
    },
    [enabled]
  );

  const playHover = useCallback(() => play('hover'), [play]);
  const playSuccess = useCallback(() => play('success'), [play]);
  const playError = useCallback(() => play('error'), [play]);

  return {
    play,
    playHover,
    playSuccess,
    playError,
  };
}
