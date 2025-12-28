import { Gem } from 'lucide-react';

interface OnyxBadgeProps {
  version?: string;
  className?: string;
}

export function OnyxBadge({ version = '1.0.0', className = '' }: OnyxBadgeProps) {
  return (
    <a
      href="#"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-yellow-600/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors group ${className}`}
      aria-label={`ONYX version ${version}`}
    >
      <Gem 
        className="w-4 h-4 text-amber-500 group-hover:text-amber-400 transition-colors" 
        aria-hidden="true"
      />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" style={{fontFamily: 'Cinzel, serif'}}>
        <span className="font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">ONYX</span>
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
        v{version}
      </span>
    </a>
  );
}
