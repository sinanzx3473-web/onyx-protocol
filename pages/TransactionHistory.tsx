import { useAccount } from 'wagmi';
import { Database, ExternalLink } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// Mock transaction data
const mockTransactions = [
  {
    hash: '0x7f2c4e8a9b3d1f5e6c8a2b4d7e9f1a3c5b7d9e1f3a5c7b9d1e3f5a7c9b1d3e5f',
    block: '18234567',
    method: 'SWAP',
    value: '2.45 ETH',
    gas: '0.0023',
    status: 'success',
  },
  {
    hash: '0x3a5c7b9d1e3f5a7c9b1d3e5f7a9c1b3d5e7f9a1c3b5d7e9f1a3c5b7d9e1f3a5c',
    block: '18234512',
    method: 'APPROVE',
    value: '∞ USDC',
    gas: '0.0012',
    status: 'success',
  },
  {
    hash: '0x9b1d3e5f7a9c1b3d5e7f9a1c3b5d7e9f1a3c5b7d9e1f3a5c7b9d1e3f5a7c9b1d',
    block: '18234489',
    method: 'ADD_LIQUIDITY',
    value: '1.2 ETH',
    gas: '0.0045',
    status: 'success',
  },
  {
    hash: '0x5e7f9a1c3b5d7e9f1a3c5b7d9e1f3a5c7b9d1e3f5a7c9b1d3e5f7a9c1b3d5e7f',
    block: '18234401',
    method: 'SWAP',
    value: '500 USDC',
    gas: '0.0019',
    status: 'pending',
  },
  {
    hash: '0x1a3c5b7d9e1f3a5c7b9d1e3f5a7c9b1d3e5f7a9c1b3d5e7f9a1c3b5d7e9f1a3c',
    block: '18234378',
    method: 'REMOVE_LIQUIDITY',
    value: '0.8 ETH',
    gas: '0.0038',
    status: 'success',
  },
  {
    hash: '0x7c9b1d3e5f7a9c1b3d5e7f9a1c3b5d7e9f1a3c5b7d9e1f3a5c7b9d1e3f5a7c9b',
    block: '18234312',
    method: 'MINT',
    value: '1000 ONYX',
    gas: '0.0028',
    status: 'success',
  },
  {
    hash: '0x3d5e7f9a1c3b5d7e9f1a3c5b7d9e1f3a5c7b9d1e3f5a7c9b1d3e5f7a9c1b3d5e',
    block: '18234289',
    method: 'SWAP',
    value: '3.1 ETH',
    gas: '0.0021',
    status: 'success',
  },
  {
    hash: '0x9f1a3c5b7d9e1f3a5c7b9d1e3f5a7c9b1d3e5f7a9c1b3d5e7f9a1c3b5d7e9f1a',
    block: '18234201',
    method: 'APPROVE',
    value: '∞ DAI',
    gas: '0.0011',
    status: 'success',
  },
];

export default function TransactionHistoryPage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-void pt-24 pb-20 relative overflow-hidden">
      {/* Laser Scan Animation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-gold to-transparent animate-scan" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Layer A: Ghost Ledger (Background) */}
        <div className={`transition-all duration-500 ${!isConnected ? 'blur-md opacity-30' : ''}`}>
          {/* Header */}
          <h1 className="font-['Cinzel'] text-3xl text-gold text-center mb-8 tracking-wider">
            IMMUTABLE ARCHIVE
          </h1>

          {/* Table Container */}
          <div className="bg-void/40 backdrop-blur-xl border-t border-gold/30 rounded-lg overflow-hidden w-full">
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 font-mono text-xs text-gold/50 tracking-[0.2em] py-4 px-6 border-b border-white/5 uppercase">
              <div>TX Hash</div>
              <div>Block</div>
              <div>Method</div>
              <div>Value</div>
              <div>Gas</div>
              <div>Status</div>
            </div>

            {/* Table Body */}
            <div>
              {mockTransactions.map((tx, index) => (
                <div
                  key={index}
                  className="grid grid-cols-6 gap-4 font-mono text-sm text-platinum py-4 px-6 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {/* Hash */}
                  <div className="flex items-center gap-2 opacity-50">
                    <span className="truncate">
                      {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                    </span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </div>

                  {/* Block */}
                  <div className="opacity-70">{tx.block}</div>

                  {/* Method */}
                  <div className="font-bold text-gold">{tx.method}</div>

                  {/* Value */}
                  <div className="opacity-80">{tx.value}</div>

                  {/* Gas */}
                  <div className="opacity-60">{tx.gas} ETH</div>

                  {/* Status */}
                  <div>
                    {tx.status === 'success' ? (
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-[10px] uppercase tracking-wider">
                        SUCCESS
                      </span>
                    ) : (
                      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-[10px] uppercase tracking-wider">
                        PENDING
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Layer B: Decryption Key (Overlay) */}
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center z-50 px-6">
            <div className="bg-void/90 backdrop-blur-xl border border-gold/30 rounded-lg p-12 flex flex-col items-center max-w-md w-full shadow-[0_0_80px_rgba(212,175,55,0.15)]">
              {/* Icon */}
              <Database className="w-20 h-20 text-gold animate-pulse mb-6" />

              {/* Title */}
              <h2 className="font-['Cinzel'] text-2xl text-gold tracking-widest mb-3 text-center">
                LEDGER ENCRYPTED
              </h2>

              {/* Subtitle */}
              <p className="font-mono text-platinum/50 text-sm text-center mb-8">
                Connect wallet to decrypt transaction history.
              </p>

              {/* Button */}
              <div className="w-full">
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="w-full py-4 border border-gold text-gold font-bold hover:bg-gold hover:text-void uppercase tracking-[0.2em] transition-all duration-300 rounded"
                    >
                      DECRYPT LOGS
                    </button>
                  )}
                </ConnectButton.Custom>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% {
            top: 0;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        .animate-scan {
          animation: scan 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
