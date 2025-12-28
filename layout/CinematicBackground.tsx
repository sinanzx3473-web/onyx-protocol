export function CinematicBackground() {
  return (
    <div className="fixed inset-0 -z-20 overflow-hidden">
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 w-full h-full -z-20 opacity-40 mix-blend-screen filter sepia-[100%] saturate-[150%] hue-rotate-[10deg] brightness-[0.8] contrast-[1.2]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.3) 0%, rgba(0, 0, 0, 0) 70%)',
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />

      {/* Film Grain Overlay */}
      <div 
        className="absolute inset-0 -z-10 opacity-[0.15] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Stronger Vignette Overlay - Full darkness at edges */}
      <div 
        className="absolute inset-0 -z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#050505_90%)]"
      />

      {/* Additional subtle gradient for depth */}
      <div 
        className="absolute inset-0 -z-10 pointer-events-none opacity-40"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 50%, rgba(0,0,0,0.5) 100%)',
        }}
      />
    </div>
  );
}
