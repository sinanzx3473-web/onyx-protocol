import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { NetworkAlert } from './NetworkAlert';
import { OnyxBadge } from './OnyxBadge';
import { CommandPalette } from './common/CommandPalette';
import { useState } from 'react';

export default function Layout({ splitLayout = false }: { splitLayout?: boolean }) {
  const [slippage, setSlippage] = useState(1);

  return (
    <div className="min-h-screen bg-brand-void">
      <CommandPalette onSlippageChange={setSlippage} />
      
      {/* Floating Dock Navbar */}
      <Navbar />

      <NetworkAlert />
      
      {splitLayout ? (
        <main className="flex min-h-screen relative pt-24">
          {/* Left Side: Typographic Slogan with Rotating Wireframe */}
          <div className="w-1/2 flex items-center justify-center relative overflow-hidden">
            <div className="wireframe-container absolute inset-0 flex items-center justify-center">
              <div className="wireframe-globe" />
            </div>
            <div className="relative z-10 text-center px-8">
              <h1 className="text-8xl font-bold tracking-tighter leading-none font-heading">
                <span className="block bg-clip-text text-transparent bg-gradient-to-b from-[#D4AF37] to-[#8E7216]">ONYX</span>
                <span className="block text-brand-gold mt-4">//</span>
                <span className="block bg-clip-text text-transparent bg-gradient-to-b from-[#D4AF37] to-[#8E7216] mt-4">PROTOCOL</span>
              </h1>
            </div>
          </div>
          
          {/* Right Side: Main Content - Floating in Space */}
          <div className="w-1/2 flex items-center justify-center px-8 py-8 relative z-10">
            <div className="w-full max-w-xl">
              <Outlet />
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-32 relative z-10">
          <Outlet />
        </main>
      )}
      
      {/* Built with ONYX Badge */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center">
          <OnyxBadge version="1.0.0" />
        </div>
      </footer>
    </div>
  );
}
