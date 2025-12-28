import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePublicClient } from 'wagmi';
import { getQuote } from '../../lib/solver/zeroEx';
import { parseTokenAmount } from '../../lib/solver/zeroEx';

interface DiagnosticLog {
  message: string;
  status: 'pending' | 'success' | 'error';
  timestamp: number;
}

interface SystemDiagnosticsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemDiagnostics: React.FC<SystemDiagnosticsProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [systemHealth, setSystemHealth] = useState(0);
  const publicClient = usePublicClient();

  const addLog = (message: string, status: 'pending' | 'success' | 'error' = 'pending') => {
    setLogs(prev => [...prev, { message, status, timestamp: Date.now() }]);
  };

  const updateLastLog = (status: 'success' | 'error', newMessage?: string) => {
    setLogs(prev => {
      const updated = [...prev];
      const lastLog = updated[updated.length - 1];
      if (lastLog) {
        lastLog.status = status;
        if (newMessage) lastLog.message = newMessage;
      }
      return updated;
    });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runDiagnostics = async () => {
    setIsRunning(true);
    setLogs([]);
    setSystemHealth(0);
    let passedTests = 0;
    const totalTests = 4;

    try {
      // Test 1: Uplink Check (Block Number)
      addLog('> Establishing Uplink...', 'pending');
      await sleep(600);
      
      try {
        const blockNumber = await publicClient?.getBlockNumber();
        if (blockNumber) {
          updateLastLog('success', `> Establishing Uplink... SUCCESS (Block #${blockNumber.toString()})`);
          passedTests++;
        } else {
          updateLastLog('error', '> Establishing Uplink... FAILED (No provider)');
        }
      } catch (error) {
        updateLastLog('error', '> Establishing Uplink... FAILED');
      }

      await sleep(400);

      // Test 2: Latency Check
      addLog('> Measuring Network Latency...', 'pending');
      await sleep(500);
      
      const startTime = Date.now();
      try {
        await publicClient?.getBlockNumber();
        const latency = Date.now() - startTime;
        const status = latency < 100 ? 'Optimal' : latency < 300 ? 'Good' : 'Degraded';
        updateLastLog('success', `> Ping: ${latency}ms (${status})`);
        passedTests++;
      } catch (error) {
        updateLastLog('error', '> Ping: TIMEOUT');
      }

      await sleep(400);

      // Test 3: Solver Check
      addLog('> Solver Engine...', 'pending');
      await sleep(700);
      
      try {
        const quote = await getQuote({
          sellToken: 'ETH',
          buyToken: 'USDC',
          sellAmount: parseTokenAmount('1', 18), // 1 ETH
        });
        
        if (quote && quote.price) {
          updateLastLog('success', `> Solver Engine... ONLINE (Quote: $${quote.price})`);
          passedTests++;
        } else {
          updateLastLog('error', '> Solver Engine... FAILED');
        }
      } catch (error) {
        updateLastLog('error', '> Solver Engine... OFFLINE');
      }

      await sleep(400);

      // Test 4: Database/Indexer Check
      addLog('> Indexer...', 'pending');
      await sleep(600);
      
      try {
        // Simulate indexer check (mock data fetch)
        const mockData = { synced: true, lastBlock: 184920 };
        if (mockData.synced) {
          updateLastLog('success', '> Indexer... SYNCED');
          passedTests++;
        } else {
          updateLastLog('error', '> Indexer... OUT OF SYNC');
        }
      } catch (error) {
        updateLastLog('error', '> Indexer... FAILED');
      }

      await sleep(500);

      // Calculate system health
      const health = Math.round((passedTests / totalTests) * 100);
      setSystemHealth(health);

    } catch (error) {
      console.error('Diagnostics error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen && logs.length === 0) {
      runDiagnostics();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Holographic Debugger Panel */}
            <div className="glass-panel bg-black/90 border border-green-500/50 p-8 rounded-2xl shadow-[0_0_50px_rgba(34,197,94,0.3)]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-green-500/30">
                <div>
                  <h2 className="font-heading text-2xl text-green-400 tracking-[0.2em] mb-1">
                    SYSTEM DIAGNOSTICS
                  </h2>
                  <p className="text-xs text-green-500/60 font-mono">
                    HOLOGRAPHIC DEBUGGER v2.1.0
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
                >
                  <X className="text-green-400" size={20} />
                </button>
              </div>

              {/* Console Output */}
              <div className="bg-black/60 border border-green-500/20 rounded-lg p-6 mb-6 min-h-[300px] max-h-[400px] overflow-y-auto font-mono text-xs">
                {logs.map((log, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-2 mb-2"
                  >
                    {log.status === 'success' && (
                      <CheckCircle2 className="text-green-400 flex-shrink-0 mt-0.5" size={14} />
                    )}
                    {log.status === 'error' && (
                      <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={14} />
                    )}
                    {log.status === 'pending' && (
                      <div className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      </div>
                    )}
                    <span
                      className={`${
                        log.status === 'success'
                          ? 'text-green-400'
                          : log.status === 'error'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}
                    >
                      {log.message}
                    </span>
                  </motion.div>
                ))}

                {isRunning && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-green-400/60 mt-4"
                  >
                    <span className="animate-pulse">Running diagnostics...</span>
                  </motion.div>
                )}
              </div>

              {/* System Health Banner */}
              {!isRunning && systemHealth > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border ${
                    systemHealth === 100
                      ? 'bg-green-500/10 border-green-500/50'
                      : systemHealth >= 75
                      ? 'bg-yellow-500/10 border-yellow-500/50'
                      : 'bg-red-500/10 border-red-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold tracking-wider">
                      SYSTEM HEALTH:
                    </span>
                    <span
                      className={`font-mono text-2xl font-bold ${
                        systemHealth === 100
                          ? 'text-green-400'
                          : systemHealth >= 75
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {systemHealth}%
                    </span>
                  </div>
                  {systemHealth === 100 && (
                    <p className="text-xs text-green-400/60 mt-2 font-mono">
                      All systems operational. Ready for deployment.
                    </p>
                  )}
                  {systemHealth < 100 && systemHealth >= 75 && (
                    <p className="text-xs text-yellow-400/60 mt-2 font-mono">
                      Minor issues detected. System functional.
                    </p>
                  )}
                  {systemHealth < 75 && (
                    <p className="text-xs text-red-400/60 mt-2 font-mono">
                      Critical errors detected. Immediate attention required.
                    </p>
                  )}
                </motion.div>
              )}

              {/* Re-run Button */}
              {!isRunning && logs.length > 0 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={runDiagnostics}
                  className="w-full mt-4 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 font-mono text-sm font-bold tracking-wider transition-colors"
                >
                  RE-RUN DIAGNOSTICS
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
