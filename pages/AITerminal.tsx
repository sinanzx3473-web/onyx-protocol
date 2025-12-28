import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Sparkles, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPrice, formatTokenAmount, parseTokenAmount } from '@/lib/solver/zeroEx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  transactionPreview?: TransactionPreview;
  isTyping?: boolean;
}

interface TransactionPreview {
  type: 'swap' | 'liquidity' | 'transfer';
  fromToken: string;
  toToken?: string;
  amount: string;
  estimatedOutput?: string;
  slippage?: string;
  fee?: string;
  route?: string;
  gasEstimate?: string;
}

const TypewriterText = ({ text, onComplete }: { text: string; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 20);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  return <span>{displayedText}</span>;
};

export default function AITerminal() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'ONYX INTELLIGENCE ONLINE. Neural command deck initialized. Ready for instructions.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const parseSwapCommand = async (text: string): Promise<TransactionPreview | null> => {
    const swapPattern = /swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to)\s+(\w+)/i;
    const match = text.match(swapPattern);

    if (match) {
      const [, amount, fromToken, toToken] = match;
      
      try {
        const sellAmount = parseTokenAmount(amount, 18);
        const quote = await getPrice({
          sellToken: fromToken.toUpperCase(),
          buyToken: toToken.toUpperCase(),
          sellAmount,
        });

        const estimatedOutput = formatTokenAmount(quote.buyAmount, 18);
        const primarySource = quote.sources?.[0]?.name || 'Multiple DEXs';

        return {
          type: 'swap',
          fromToken: fromToken.toUpperCase(),
          toToken: toToken.toUpperCase(),
          amount,
          estimatedOutput,
          slippage: '0.5%',
          fee: '0.3%',
          route: primarySource,
          gasEstimate: `~${formatTokenAmount(quote.gas || '0', 9)} GWEI`,
        };
      } catch (error) {
        console.error('Failed to fetch quote:', error);
        return {
          type: 'swap',
          fromToken: fromToken.toUpperCase(),
          toToken: toToken.toUpperCase(),
          amount,
          estimatedOutput: (parseFloat(amount) * 0.98).toFixed(2),
          slippage: '0.5%',
          fee: '0.3%',
          route: 'API Unavailable - Mock Data',
          gasEstimate: '~$2.50',
        };
      }
    }

    return null;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsTyping(true);

    try {
      const transactionPreview = await parseSwapCommand(userInput);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: transactionPreview
          ? `Route analysis complete. Found: ${transactionPreview.fromToken} → ${transactionPreview.toToken} @ ${transactionPreview.estimatedOutput} via ${transactionPreview.route}. Gasless execution available.`
          : 'Command format: "Swap [Amount] [Token] for [Token]". Example: "Swap 1 ETH for USDC"',
        timestamp: new Date(),
        transactionPreview: transactionPreview || undefined,
        isTyping: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error processing command. Please try again or check your input format.',
        timestamp: new Date(),
        isTyping: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentTransaction = messages
    .slice()
    .reverse()
    .find((m) => m.transactionPreview)?.transactionPreview;

  return (
    <div className="w-full min-h-screen pt-24 pb-32 px-4 relative overflow-hidden">
      {/* Neural Ring Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-brand-gold/5 rounded-full animate-spin-slow pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-brand-gold/5 rounded-full animate-spin-slow pointer-events-none" style={{ animationDuration: '45s' }} />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-brand-gold tracking-widest mb-2">
            NEURAL COMMAND DECK
          </h1>
          <p className="font-mono text-sm text-brand-platinum/60 tracking-wider">
            // ONYX INTELLIGENCE v3.0
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chat Interface */}
          <div className="lg:col-span-2 relative">
            {/* Messages Container */}
            <div className="h-[500px] overflow-y-auto space-y-6 mb-6 px-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'user' ? (
                    <div className="bg-brand-gold/10 border border-brand-gold/20 text-brand-gold rounded-none px-6 py-4 font-mono max-w-[80%]">
                      {message.content}
                    </div>
                  ) : (
                    <div className="bg-transparent border-l-2 border-brand-gold pl-6 py-2 text-platinum font-sans leading-relaxed max-w-[80%]">
                      {message.isTyping ? (
                        <TypewriterText text={message.content} />
                      ) : (
                        message.content
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-center items-center gap-2 py-8">
                  <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-brand-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="ml-3 font-mono text-sm text-brand-gold/60">Processing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Holographic Input */}
            <div className="w-full max-w-3xl mx-auto">
              <div className="glass-panel rounded-full px-8 py-4 flex items-center gap-4">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter neural command..."
                  className="bg-transparent w-full text-lg text-white font-mono outline-none placeholder-white/20"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className={`transition-all duration-300 ${
                    input.trim() && !isTyping
                      ? 'text-brand-gold drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]'
                      : 'text-white/20'
                  }`}
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Flight Plan */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status Card */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-brand-gold">
                    STATUS
                  </h3>
                  <p className="font-mono text-xs text-brand-platinum/60">
                    NEURAL ONLINE
                  </p>
                </div>
              </div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-brand-platinum/60">Network:</span>
                  <span className="text-green-400">CONNECTED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-platinum/60">Gas Price:</span>
                  <span className="text-brand-platinum">12 GWEI</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-platinum/60">Relayer:</span>
                  <span className="text-green-400">ACTIVE</span>
                </div>
              </div>
            </div>

            {/* Flight Plan Card */}
            {currentTransaction ? (
              <Card className="glass-panel border-brand-gold/30 rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-brand-gold/10 to-transparent border-b border-brand-gold/20">
                  <CardTitle className="font-heading text-brand-gold flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    FLIGHT PLAN
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3 font-mono text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-brand-platinum/60">Type:</span>
                      <span className="text-brand-gold font-bold uppercase tracking-wider">
                        {currentTransaction.type}
                      </span>
                    </div>
                    <div className="h-px bg-brand-gold/10" />
                    <div className="flex justify-between items-center">
                      <span className="text-brand-platinum/60">From:</span>
                      <span className="text-brand-platinum font-bold">
                        {currentTransaction.amount} {currentTransaction.fromToken}
                      </span>
                    </div>
                    {currentTransaction.toToken && (
                      <div className="flex justify-between items-center">
                        <span className="text-brand-platinum/60">To:</span>
                        <span className="text-brand-gold font-bold">
                          ~{currentTransaction.estimatedOutput} {currentTransaction.toToken}
                        </span>
                      </div>
                    )}
                    <div className="h-px bg-brand-gold/10" />
                    {currentTransaction.route && (
                      <div className="space-y-1">
                        <span className="text-brand-platinum/60 text-xs">Route:</span>
                        <div className="text-brand-platinum text-xs bg-brand-black/40 p-2 rounded">
                          {currentTransaction.route}
                        </div>
                      </div>
                    )}
                    {currentTransaction.slippage && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-brand-platinum/60">Slippage:</span>
                        <span className="text-brand-platinum">{currentTransaction.slippage}</span>
                      </div>
                    )}
                    {currentTransaction.fee && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-brand-platinum/60">Protocol Fee:</span>
                        <span className="text-brand-platinum">{currentTransaction.fee}</span>
                      </div>
                    )}
                    {currentTransaction.gasEstimate && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-brand-platinum/60">Gas Estimate:</span>
                        <span className="text-green-400">{currentTransaction.gasEstimate}</span>
                      </div>
                    )}
                  </div>

                  <Button className="w-full bg-brand-gold hover:bg-brand-gold/90 text-brand-black font-bold uppercase tracking-wider mt-4">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Execute Transaction
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="glass-panel rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-brand-gold/40" />
                </div>
                <p className="font-mono text-sm text-brand-platinum/40">
                  Awaiting transaction command...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
