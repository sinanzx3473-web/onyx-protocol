import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  transactionPreview?: TransactionPreview;
}

interface TransactionPreview {
  type: 'swap' | 'liquidity' | 'transfer';
  fromToken: string;
  toToken?: string;
  amount: string;
  estimatedOutput?: string;
  slippage?: string;
  fee?: string;
}

export function Concierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'ONYX ready.',
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

  const parseSwapCommand = (text: string): TransactionPreview | null => {
    // Match patterns like "Swap 100 ETH for USDC" or "swap 50 TKA to TKB"
    const swapPattern = /swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to)\s+(\w+)/i;
    const match = text.match(swapPattern);

    if (match) {
      const [, amount, fromToken, toToken] = match;
      return {
        type: 'swap',
        fromToken: fromToken.toUpperCase(),
        toToken: toToken.toUpperCase(),
        amount,
        estimatedOutput: (parseFloat(amount) * 0.98).toFixed(2), // Mock 2% slippage
        slippage: '0.5%',
        fee: '0.3%',
      };
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
    setInput('');
    setIsTyping(true);

    // Simulate AI processing
    setTimeout(() => {
      const transactionPreview = parseSwapCommand(input);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: transactionPreview
          ? 'Analyzing liquidity routes... Route found via Uniswap V3. Gasless execution ready.'
          : 'Command unclear. Format: "Swap [Amount] [Token] for [Token]"',
        timestamp: new Date(),
        transactionPreview: transactionPreview || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-brand-gold hover:bg-brand-gold/90 shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 group"
          aria-label="Open ONYX Concierge"
        >
          <Sparkles className="w-7 h-7 text-brand-black group-hover:rotate-12 transition-transform" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-platinum rounded-full animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] glass-onyx rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-black via-brand-surface to-brand-black border-b border-brand-gold/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-brand-black" />
              </div>
              <div>
                <h2 className="font-cinzel text-lg font-bold text-brand-gold tracking-wide">
                  ONYX CONCIERGE
                </h2>
                <p className="text-xs text-brand-platinum/60 font-manrope">
                  AI-Powered Transaction Assistant
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-brand-platinum/60 hover:text-brand-gold hover:bg-brand-gold/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-manrope">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    message.role === 'user'
                      ? 'bg-transparent border border-brand-platinum/20 text-white'
                      : 'bg-gradient-to-br from-brand-gold/20 via-brand-black to-brand-black border border-brand-gold/30 text-white'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>

                  {/* Transaction Preview Card */}
                  {message.transactionPreview && (
                    <Card className="mt-3 bg-brand-black/40 border-brand-gold/30">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-cinzel text-brand-gold">
                          Transaction Preview
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-brand-platinum/60">Type:</span>
                          <span className="text-brand-platinum font-medium uppercase">
                            {message.transactionPreview.type}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-brand-platinum/60">From:</span>
                          <span className="text-brand-platinum font-medium">
                            {message.transactionPreview.amount} {message.transactionPreview.fromToken}
                          </span>
                        </div>
                        {message.transactionPreview.toToken && (
                          <div className="flex justify-between">
                            <span className="text-brand-platinum/60">To:</span>
                            <span className="text-brand-platinum font-medium">
                              ~{message.transactionPreview.estimatedOutput} {message.transactionPreview.toToken}
                            </span>
                          </div>
                        )}
                        {message.transactionPreview.slippage && (
                          <div className="flex justify-between">
                            <span className="text-brand-platinum/60">Slippage:</span>
                            <span className="text-brand-platinum">{message.transactionPreview.slippage}</span>
                          </div>
                        )}
                        {message.transactionPreview.fee && (
                          <div className="flex justify-between">
                            <span className="text-brand-platinum/60">Fee:</span>
                            <span className="text-brand-platinum">{message.transactionPreview.fee}</span>
                          </div>
                        )}
                        <Button
                          className="w-full mt-3 bg-brand-gold hover:bg-brand-gold/90 text-brand-black font-bold uppercase tracking-wider"
                          size="sm"
                        >
                          Execute Swap
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  <p className="text-[10px] mt-1 opacity-50">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-brand-surface/80 text-brand-platinum border border-brand-gold/10 rounded-2xl p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-brand-gold/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-brand-gold/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-brand-gold/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-brand-gold/20 p-4 bg-brand-black/40">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your request..."
                className="flex-1 bg-brand-surface/60 border-brand-gold/20 text-brand-platinum placeholder:text-brand-platinum/40 focus:border-brand-gold font-manrope"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="bg-brand-gold hover:bg-brand-gold/90 text-brand-black"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
