import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, DollarSign, ArrowRight, Loader2, Shield, CheckCircle2, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FiatOnRampProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentStatus = 'IDLE' | 'PROCESSING' | 'VERIFYING_BANK' | 'DISPENSING' | 'COMPLETED';

export const FiatOnRamp: React.FC<FiatOnRampProps> = ({ isOpen, onClose }) => {
  const [fiatAmount, setFiatAmount] = useState('100');
  const [cryptoAmount, setCryptoAmount] = useState('0.0285');
  const [status, setStatus] = useState<PaymentStatus>('IDLE');
  const { toast } = useToast();

  const handleFiatChange = (value: string) => {
    setFiatAmount(value);
    const numValue = parseFloat(value) || 0;
    // Mock conversion rate: 1 ETH = ~$3500
    setCryptoAmount((numValue / 3500).toFixed(4));
  };

  const handlePurchase = async () => {
    // Step 1: Processing payment
    setStatus('PROCESSING');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Verifying with bank
    setStatus('VERIFYING_BANK');
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Step 3: Dispensing assets
    setStatus('DISPENSING');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Completed
    setStatus('COMPLETED');
    
    // Show success toast
    toast({
      title: '✅ Purchase Successful',
      description: `+${cryptoAmount} ETH deposited to your wallet`,
      duration: 5000,
    });
    
    // Reset and close after showing success
    setTimeout(() => {
      setStatus('IDLE');
      onClose();
    }, 2000);
  };

  // Reset status when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStatus('IDLE');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[101]"
          >
            <div className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-brand-gold/30 rounded-3xl shadow-2xl overflow-hidden">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 via-transparent to-purple-500/5 pointer-events-none" />
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all z-10"
              >
                <X size={20} />
              </button>

              {/* Content */}
              <div className="relative p-8 space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                  <h2 className="font-heading text-3xl font-bold text-brand-gold tracking-wider">
                    BUY CRYPTO
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Purchase cryptocurrency with your credit card
                  </p>
                </div>

                {/* Amount Inputs */}
                <div className="space-y-4">
                  {/* You Pay */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-400 mb-2 tracking-wider">
                      YOU PAY
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                        <DollarSign size={20} />
                        <span className="font-bold">USD</span>
                      </div>
                      <input
                        type="number"
                        value={fiatAmount}
                        onChange={(e) => handleFiatChange(e.target.value)}
                        className="w-full pl-24 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-2xl font-bold focus:outline-none focus:border-brand-gold/50 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <div className="p-2 bg-brand-gold/10 rounded-full">
                      <ArrowRight className="text-brand-gold" size={20} />
                    </div>
                  </div>

                  {/* You Receive */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-gray-400 mb-2 tracking-wider">
                      YOU RECEIVE
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-500" />
                        <span className="font-bold">ETH</span>
                      </div>
                      <input
                        type="text"
                        value={cryptoAmount}
                        readOnly
                        className="w-full pl-24 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-2xl font-bold cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Holographic Card Preview */}
                <div className="relative">
                  <label className="block text-xs font-bold text-gray-400 mb-3 tracking-wider">
                    PAYMENT METHOD
                  </label>
                  <div className={`relative h-48 rounded-2xl overflow-hidden group cursor-pointer transition-all duration-500 ${
                    status === 'PROCESSING' || status === 'VERIFYING_BANK' ? 'scale-105 shadow-2xl shadow-purple-500/50' : ''
                  }`}>
                    {/* Holographic gradient background */}
                    <div className={`absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 opacity-80 transition-all duration-500 ${
                      status === 'PROCESSING' || status === 'VERIFYING_BANK' ? 'animate-pulse' : ''
                    }`} />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
                    
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    
                    {/* Card content */}
                    <div className="relative h-full p-6 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-10 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded opacity-80" />
                        <CreditCard className="text-white/80" size={32} />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="font-mono text-white text-xl tracking-[0.3em]">
                          •••• •••• •••• 4242
                        </div>
                        <div className="flex justify-between items-end">
                          <div>
                            <div className="text-white/60 text-xs mb-1">CARDHOLDER</div>
                            <div className="text-white font-bold">ONYX USER</div>
                          </div>
                          <div>
                            <div className="text-white/60 text-xs mb-1">EXPIRES</div>
                            <div className="text-white font-bold">12/25</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Providers */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-400 tracking-wider">
                    ACCEPTED PAYMENT METHODS
                  </label>
                  <div className="flex items-center justify-center gap-6 p-4 bg-white/5 rounded-xl border border-white/10">
                    {/* Visa */}
                    <div className="px-4 py-2 bg-white rounded text-blue-900 font-bold text-lg">
                      VISA
                    </div>
                    {/* Mastercard */}
                    <div className="flex gap-[-8px]">
                      <div className="w-8 h-8 rounded-full bg-red-500 opacity-80" />
                      <div className="w-8 h-8 rounded-full bg-orange-400 opacity-80 -ml-3" />
                    </div>
                    {/* Apple Pay */}
                    <div className="px-4 py-2 bg-black rounded flex items-center gap-1">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <span className="text-white font-bold text-sm">Pay</span>
                    </div>
                  </div>
                </div>

                {/* Processing Status Overlay */}
                <AnimatePresence>
                  {status !== 'IDLE' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/90 backdrop-blur-sm z-10 flex items-center justify-center"
                    >
                      <div className="text-center space-y-6">
                        {status === 'PROCESSING' && (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              <Loader2 className="w-16 h-16 text-brand-gold mx-auto" />
                            </motion.div>
                            <div>
                              <h3 className="text-xl font-bold text-white mb-2">Contacting Bank...</h3>
                              <p className="text-gray-400 text-sm">Securely processing your payment</p>
                            </div>
                          </>
                        )}
                        
                        {status === 'VERIFYING_BANK' && (
                          <>
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <Fingerprint className="w-16 h-16 text-blue-400 mx-auto" />
                            </motion.div>
                            <div>
                              <h3 className="text-xl font-bold text-white mb-2">Verifying Identity...</h3>
                              <p className="text-gray-400 text-sm">Biometric authentication in progress</p>
                            </div>
                          </>
                        )}
                        
                        {status === 'DISPENSING' && (
                          <>
                            <motion.div
                              animate={{ y: [0, -10, 0] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              <Shield className="w-16 h-16 text-green-400 mx-auto" />
                            </motion.div>
                            <div>
                              <h3 className="text-xl font-bold text-white mb-2">Dispensing Assets...</h3>
                              <p className="text-gray-400 text-sm">Blockchain confirmation in progress</p>
                            </div>
                          </>
                        )}
                        
                        {status === 'COMPLETED' && (
                          <>
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', damping: 10 }}
                            >
                              <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto" />
                            </motion.div>
                            <div>
                              <h3 className="text-2xl font-bold text-green-400 mb-2">Success!</h3>
                              <p className="text-white text-lg font-bold">+{cryptoAmount} ETH</p>
                              <p className="text-gray-400 text-sm mt-2">Assets deposited to your wallet</p>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Purchase Button */}
                <button
                  onClick={handlePurchase}
                  disabled={status !== 'IDLE'}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 tracking-wider"
                >
                  {status === 'IDLE' ? 'PURCHASE ASSETS' : 'PROCESSING...'}
                </button>

                {/* Disclaimer */}
                <p className="text-center text-xs text-gray-500">
                  Powered by secure payment providers. Your card details are encrypted and never stored.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
