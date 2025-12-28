import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Lock } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface Proposal {
  id: string;
  title: string;
  status: 'active' | 'queued' | 'executed' | 'defeated' | 'cancelled';
  votesFor: number;
  votesAgainst: number;
}

export default function Governance() {
  const { isConnected } = useAccount();

  // Mock data for background display
  const mockStats = {
    treasury: '$14,203,000',
    activeVotes: '3',
    quorum: '4.5%',
  };

  const mockProposals: Proposal[] = [
    {
      id: '1',
      title: 'OIP-12: Increase Liquidity Mining Rewards',
      status: 'active',
      votesFor: 75,
      votesAgainst: 25,
    },
    {
      id: '2',
      title: 'OIP-11: Protocol Fee Adjustment',
      status: 'active',
      votesFor: 62,
      votesAgainst: 38,
    },
  ];

  return (
    <div className="container mx-auto py-8 space-y-12 relative min-h-screen">
      {/* Background Dashboard - Blurred when not connected */}
      <div className={`space-y-12 ${!isConnected ? 'filter blur-md opacity-30 pointer-events-none' : ''}`}>
        {/* Hero Header */}
        <div className="text-center space-y-4">
          <h1 className="font-heading text-4xl text-white tracking-wider">ONYX DAO</h1>
          <p className="font-mono text-brand-gold/60 tracking-wide">Decentralized Control</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Treasury */}
          <div className="relative p-8 border border-white/10 bg-brand-obsidian/30 backdrop-blur-xl rounded-lg">
            <p className="text-xs font-mono text-brand-platinum/50 uppercase tracking-widest mb-2">TREASURY</p>
            <p className="text-3xl font-mono text-brand-gold">{mockStats.treasury}</p>
          </div>

          {/* Active Votes */}
          <div className="relative p-8 border border-white/10 bg-brand-obsidian/30 backdrop-blur-xl rounded-lg">
            <p className="text-xs font-mono text-brand-platinum/50 uppercase tracking-widest mb-2">ACTIVE VOTES</p>
            <p className="text-3xl font-mono text-white">{mockStats.activeVotes}</p>
          </div>

          {/* Quorum */}
          <div className="relative p-8 border border-white/10 bg-brand-obsidian/30 backdrop-blur-xl rounded-lg">
            <p className="text-xs font-mono text-brand-platinum/50 uppercase tracking-widest mb-2">QUORUM</p>
            <p className="text-3xl font-mono text-brand-success">{mockStats.quorum}</p>
          </div>
        </div>

        {/* Proposals List */}
        <div className="space-y-6">
          <h2 className="font-heading text-2xl text-brand-platinum tracking-widest">ACTIVE PROPOSALS</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mockProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="relative p-8 border border-white/10 bg-brand-obsidian/30 backdrop-blur-xl rounded-lg space-y-4"
              >
                {/* Title and Status */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-success animate-pulse" />
                    <span className="text-xs font-mono text-brand-success uppercase tracking-widest">
                      {proposal.status}
                    </span>
                  </div>
                  <h3 className="font-mono text-lg text-brand-platinum">{proposal.title}</h3>
                </div>

                {/* Vote Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-mono">
                    <span className="text-brand-success">YES: {proposal.votesFor}%</span>
                    <span className="text-red-400">NO: {proposal.votesAgainst}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-brand-success h-full transition-all duration-300"
                      style={{ width: `${proposal.votesFor}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lock Screen Overlay - Only shown when not connected */}
      {!isConnected && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
          {/* Pulsing Lock Icon */}
          <Lock className="w-24 h-24 text-brand-gold/50 mb-6 animate-pulse" style={{ animationDuration: '2s' }} />
          
          {/* Authentication Required Text */}
          <p className="font-mono text-brand-platinum/70 tracking-widest text-lg mb-2">
            AUTHENTICATION REQUIRED
          </p>
          <p className="font-mono text-brand-platinum/50 tracking-wide text-sm mb-8">
            Connect your wallet to access the boardroom
          </p>

          {/* Connect Identity Button */}
          <div className="border border-brand-gold rounded-lg overflow-hidden hover:bg-brand-gold hover:text-black transition-all">
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  className="px-8 py-3 font-mono text-brand-gold hover:text-black uppercase tracking-widest transition-colors"
                >
                  Connect Identity
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        </div>
      )}
    </div>
  );
}
