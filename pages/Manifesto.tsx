import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Manifesto() {
  return (
    <div className="min-h-screen bg-void pt-24 pb-20">
      <div className="max-w-2xl mx-auto px-6">
        <div className="bg-void/40 backdrop-blur-xl border border-gold/20 rounded-lg p-12 md:p-20">
          {/* Title */}
          <h1 className="font-['Cinzel'] text-4xl text-gold text-center mb-4">
            THE ONYX DOCTRINE
          </h1>
          
          {/* Subtitle */}
          <p className="font-mono text-platinum/50 text-center mb-12">
            Silence is the ultimate luxury.
          </p>

          {/* Body Text */}
          <div className="space-y-6 text-lg text-platinum/80 leading-relaxed">
            <p>
              <strong className="text-gold">Sovereignty.</strong> In a world of surveillance and extraction, 
              ONYX stands as a fortress of financial autonomy. We believe that your transactions are yours alone—
              invisible to intermediaries, immune to censorship, and executed with the precision of shadow operations. 
              Every swap, every trade, every movement of value happens in the dark, where it belongs.
            </p>

            <p>
              <strong className="text-gold">Privacy.</strong> The blockchain is transparent by design, but your 
              identity need not be. ONYX employs cutting-edge cryptographic protocols to ensure that while the 
              ledger remains immutable, your fingerprint does not. We do not ask who you are. We do not track 
              where you go. We simply execute—flawlessly, silently, and without compromise.
            </p>

            <p>
              <strong className="text-gold">Speed.</strong> Time is the only resource you cannot reclaim. ONYX 
              operates at the velocity of thought—gasless transactions, instant settlements, and zero friction. 
              Our infrastructure is built for those who move fast and leave no trace. In the age of algorithmic 
              warfare, hesitation is defeat. ONYX ensures you are always one step ahead.
            </p>
          </div>

          {/* Signature */}
          <p className="text-gold italic text-right mt-12 text-lg">
            — The Architect
          </p>

          {/* Return Button */}
          <div className="mt-16 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-3 border border-gold text-gold hover:bg-gold hover:text-void uppercase tracking-widest px-8 py-4 transition-all duration-300 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
              Return to Terminal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
