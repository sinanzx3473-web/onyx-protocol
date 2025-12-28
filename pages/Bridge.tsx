import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Info, CheckCircle2, ExternalLink, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBridge } from '@/hooks/useBridge';
import { Progress } from '@/components/ui/progress';

// Supported chains for bridging
const CHAINS = [
  { id: 'eth', name: 'ETHEREUM', symbol: 'ETH', color: 'from-blue-500 to-blue-600' },
  { id: 'base', name: 'BASE', symbol: 'BASE', color: 'from-blue-400 to-indigo-500' },
  { id: 'arb', name: 'ARBITRUM', symbol: 'ARB', color: 'from-blue-600 to-cyan-500' },
];

// Supported assets
const ASSETS = [
  { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', decimals: 6 },
];

export default function BridgePage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const { status, progress, currentStep, txHash, bridgeAssets, reset } = useBridge();

  // Bridge state
  const [sourceChain, setSourceChain] = useState(CHAINS[0]);
  const [targetChain, setTargetChain] = useState(CHAINS[2]);
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [sendAmount, setSendAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [bridgeFee] = useState('0.001');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Calculate receive amount (with bridge fee)
  useEffect(() => {
    if (sendAmount && !isNaN(parseFloat(sendAmount))) {
      const amount = parseFloat(sendAmount);
      const fee = parseFloat(bridgeFee);
      const received = amount - fee;
      setReceiveAmount(received > 0 ? received.toFixed(6) : '0');
    } else {
      setReceiveAmount('');
    }
  }, [sendAmount, bridgeFee]);

  // Watch for completion
  useEffect(() => {
    if (status === 'COMPLETED') {
      setShowSuccessModal(true);
    }
  }, [status]);

  // Handle warp (bridge transaction)
  const handleWarp = async () => {
    if (!isConnected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to use the bridge.',
        variant: 'destructive',
      });
      return;
    }

    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount to bridge.',
        variant: 'destructive',
      });
      return;
    }

    await bridgeAssets(sendAmount, selectedAsset.symbol, sourceChain.name, targetChain.name);
  };

  // Handle modal close and reset
  const handleCloseModal = () => {
    setShowSuccessModal(false);
    setSendAmount('');
    setReceiveAmount('');
    reset();
  };

  // Copy transaction hash
  const copyTxHash = () => {
    navigator.clipboard.writeText(txHash);
    toast({
      title: 'Copied!',
      description: 'Transaction hash copied to clipboard',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
      {/* Breathing Wormhole Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-void via-obsidian to-void"
          animate={{
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 mt-20"
      >
        <h1 
          className="text-4xl md:text-5xl font-heading font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          QUANTUM BRIDGE
        </h1>
        <p className="text-gray-400 text-lg">
          Teleport your assets across the multiverse
        </p>
      </motion.div>

      {/* Portal Frame Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <Card className="bg-black/60 backdrop-blur-xl border-blue-500/30 shadow-2xl overflow-hidden">
          <CardContent className="p-8">
            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* LEFT COLUMN - SOURCE */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-blue-400 mb-3 tracking-wider">FROM:</h3>
                  
                  {/* Network Selector Pills */}
                  <div className="flex gap-2 mb-4">
                    {CHAINS.filter(c => c.id !== targetChain.id).map((chain) => (
                      <button
                        key={chain.id}
                        onClick={() => setSourceChain(chain)}
                        className={`px-4 py-2 rounded-full text-xs font-bold tracking-wider transition-all ${
                          sourceChain.id === chain.id
                            ? `bg-gradient-to-r ${chain.color} text-white shadow-lg shadow-blue-500/50 scale-105`
                            : 'bg-black/40 text-gray-400 hover:bg-black/60 border border-white/10'
                        }`}
                      >
                        {chain.symbol}
                      </button>
                    ))}
                  </div>

                  <div className="text-2xl font-bold text-white mb-6">
                    {sourceChain.name}
                  </div>
                </div>

                {/* Asset Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Asset</label>
                  <div className="flex gap-2">
                    {ASSETS.map((asset) => (
                      <button
                        key={asset.symbol}
                        onClick={() => setSelectedAsset(asset)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                          selectedAsset.symbol === asset.symbol
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                            : 'bg-black/40 text-gray-400 hover:bg-black/60 border border-white/10'
                        }`}
                      >
                        {asset.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Amount</label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="bg-black/50 backdrop-blur-sm border-white/20 text-white text-3xl font-bold h-16 text-center focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="text-xs text-gray-500 text-center">
                    Balance: 0.00 {selectedAsset.symbol}
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN - TARGET */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-purple-400 mb-3 tracking-wider">TO:</h3>
                  
                  {/* Network Selector Pills */}
                  <div className="flex gap-2 mb-4">
                    {CHAINS.filter(c => c.id !== sourceChain.id).map((chain) => (
                      <button
                        key={chain.id}
                        onClick={() => setTargetChain(chain)}
                        className={`px-4 py-2 rounded-full text-xs font-bold tracking-wider transition-all ${
                          targetChain.id === chain.id
                            ? `bg-gradient-to-r ${chain.color} text-white shadow-lg shadow-purple-500/50 scale-105`
                            : 'bg-black/40 text-gray-400 hover:bg-black/60 border border-white/10'
                        }`}
                      >
                        {chain.symbol}
                      </button>
                    ))}
                  </div>

                  <div className="text-2xl font-bold text-white mb-6">
                    {targetChain.name}
                  </div>
                </div>

                {/* Receive Asset Display */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">Receive Asset</label>
                  <div className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 text-white font-semibold">
                    {selectedAsset.symbol}
                  </div>
                </div>

                {/* Receive Amount Display */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">You Receive</label>
                  <div className="bg-black/50 backdrop-blur-sm border border-white/20 rounded-lg text-white text-3xl font-bold h-16 flex items-center justify-center">
                    {receiveAmount || '0.0'}
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Est. arrival: ~5 min
                  </p>
                </div>
              </div>
            </div>

            {/* Middle Arrow Icon */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
              <motion.div
                animate={{
                  x: [0, 10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-full shadow-lg shadow-blue-500/50"
              >
                <ArrowRight className="text-white" size={24} />
              </motion.div>
            </div>

            {/* Bridge Fee Info */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 w-fit mx-auto">
              <Info size={14} />
              <span>Bridge Fee: {bridgeFee} {selectedAsset.symbol}</span>
            </div>

            {/* INITIATE WARP Button or Progress Bar */}
            {status === 'WARPING' ? (
              <div className="mt-8 space-y-4">
                {/* Progress Bar */}
                <div className="relative">
                  <div className="bg-black/60 backdrop-blur-sm border border-blue-500/30 rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-400 font-semibold">{currentStep}</span>
                      <span className="text-white font-bold">{progress}%</span>
                    </div>
                    
                    {/* Glowing Progress Bar */}
                    <div className="relative h-3 bg-black/80 rounded-full overflow-hidden border border-blue-500/20">
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full shadow-lg shadow-blue-500/50"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      >
                        {/* Shimmer effect on progress bar */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          animate={{
                            x: ['-100%', '200%'],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                        />
                      </motion.div>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                      <Loader2 className="animate-spin" size={14} />
                      <span>Quantum entanglement in progress...</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-8"
              >
                <Button
                  onClick={handleWarp}
                  disabled={status !== 'IDLE' || !isConnected || !sendAmount}
                  className="w-full py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold tracking-[0.5em] text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-blue-500/30 relative overflow-hidden"
                >
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{
                      x: ['-100%', '200%'],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                  
                  INITIATE WARP
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Info Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 text-center text-xs text-gray-500"
      >
        Cross-chain bridging powered by quantum entanglement technology
      </motion.div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-black/90 to-blue-950/50 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-blue-500/20"
            >
              {/* Success Icon */}
              <div className="flex justify-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="bg-gradient-to-br from-blue-500 to-purple-500 rounded-full p-4"
                >
                  <CheckCircle2 className="text-white" size={48} />
                </motion.div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-heading font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Transfer Complete!
              </h2>
              <p className="text-gray-400 text-center mb-6">
                Your assets have successfully crossed the quantum bridge
              </p>

              {/* Transaction Details */}
              <div className="space-y-4 mb-6">
                <div className="bg-black/60 backdrop-blur-sm border border-blue-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-1">Amount</div>
                  <div className="text-lg font-bold text-white">
                    {sendAmount} {selectedAsset.symbol}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/60 backdrop-blur-sm border border-blue-500/20 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">From</div>
                    <div className="text-sm font-semibold text-blue-400">
                      {sourceChain.name}
                    </div>
                  </div>
                  <div className="bg-black/60 backdrop-blur-sm border border-blue-500/20 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">To</div>
                    <div className="text-sm font-semibold text-purple-400">
                      {targetChain.name}
                    </div>
                  </div>
                </div>

                {/* Transaction Hash */}
                <div className="bg-black/60 backdrop-blur-sm border border-blue-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 mb-2">Transaction Hash</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-blue-400 font-mono flex-1 truncate">
                      {txHash}
                    </code>
                    <button
                      onClick={copyTxHash}
                      className="p-1.5 hover:bg-blue-500/20 rounded transition-colors"
                      title="Copy"
                    >
                      <Copy size={14} className="text-gray-400" />
                    </button>
                    <a
                      href={`https://etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-blue-500/20 rounded transition-colors"
                      title="View on Explorer"
                    >
                      <ExternalLink size={14} className="text-gray-400" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <Button
                onClick={handleCloseModal}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold"
              >
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
