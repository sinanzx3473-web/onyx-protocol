import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Target, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatUnits } from 'viem';

interface LimitOrder {
  id: string;
  userAddress: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  targetPrice: string;
  minReceived: string;
  orderType: 'limit' | 'stop';
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  expiryTime: string;
  createdAt: string;
  updatedAt: string;
  filledAt?: string;
  txHash?: string;
  filledAmount?: string;
}

const TOKENS_MAP: Record<string, { symbol: string; decimals: number }> = {
  '0x5FbDB2315678afecb367f032d93F642f64180aa3': { symbol: 'TKA', decimals: 18 },
  '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512': { symbol: 'TKB', decimals: 18 },
};

export function MyOrders() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();

  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'filled' | 'cancelled' | 'expired'>('open');

  useEffect(() => {
    if (isConnected && address) {
      loadOrders();
      // Poll for updates every 10 seconds
      const interval = setInterval(loadOrders, 10000);
      return () => clearInterval(interval);
    } else {
      setOrders([]);
      setLoading(false);
    }
  }, [address, isConnected]);

  const loadOrders = async () => {
    if (!address) return;

    try {
      const response = await fetch(`/api/limit-orders/user/${address}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({
        title: 'Failed to load orders',
        description: 'Could not fetch your limit orders',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!address) return;

    setCancellingId(orderId);

    try {
      // Sign cancellation message
      const message = `Cancel order ${orderId}`;
      const signature = await signMessageAsync({ message });

      // Cancel order via API
      const response = await fetch(`/api/limit-orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          signature,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel order');
      }

      toast({
        title: 'Order cancelled',
        description: 'Your limit order has been cancelled successfully',
      });

      // Reload orders
      await loadOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: 'Failed to cancel order',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Open
          </Badge>
        );
      case 'filled':
        return (
          <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Filled
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-500/20 text-gray-400 hover:bg-gray-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getOrderTypeIcon = (orderType: string) => {
    return orderType === 'limit' ? (
      <TrendingUp className="w-4 h-4 text-green-400" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-400" />
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatTimeRemaining = (expiryTime: string) => {
    const now = new Date();
    const expiry = new Date(expiryTime);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getTokenSymbol = (address: string) => {
    return TOKENS_MAP[address]?.symbol || address.slice(0, 6);
  };

  const formatAmount = (amount: string, tokenAddress: string) => {
    const decimals = TOKENS_MAP[tokenAddress]?.decimals || 18;
    return parseFloat(formatUnits(BigInt(amount), decimals)).toFixed(4);
  };

  const filteredOrders = orders.filter(order => order.status === activeTab);

  if (!isConnected) {
    return (
      <Alert className="bg-blue-500/10 border-blue-500/20">
        <AlertCircle className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-300">
          Connect your wallet to view your limit orders
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          <CardTitle className="text-white">My Limit Orders</CardTitle>
        </div>
        <CardDescription className="text-gray-400">
          Manage your active and historical limit orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-4 bg-white/5 mb-4">
            <TabsTrigger value="open" className="min-h-[44px]">
              Open ({orders.filter(o => o.status === 'open').length})
            </TabsTrigger>
            <TabsTrigger value="filled" className="min-h-[44px]">
              Filled ({orders.filter(o => o.status === 'filled').length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="min-h-[44px]">
              Cancelled ({orders.filter(o => o.status === 'cancelled').length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="min-h-[44px]">
              Expired ({orders.filter(o => o.status === 'expired').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full bg-white/10" />
                ))}
              </div>
            ) : filteredOrders.length > 0 ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getOrderTypeIcon(order.orderType)}
                        <div>
                          <div className="text-white font-semibold">
                            {formatAmount(order.fromAmount, order.fromToken)} {getTokenSymbol(order.fromToken)} → {getTokenSymbol(order.toToken)}
                          </div>
                          <div className="text-xs text-gray-400 capitalize">
                            {order.orderType} Order
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <div className="text-gray-400 text-xs">Target Price</div>
                        <div className="text-white font-medium">
                          {parseFloat(order.targetPrice).toFixed(6)} {getTokenSymbol(order.toToken)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Min Received</div>
                        <div className="text-white font-medium">
                          {formatAmount(order.minReceived, order.toToken)} {getTokenSymbol(order.toToken)}
                        </div>
                      </div>
                      {order.status === 'open' && (
                        <div>
                          <div className="text-gray-400 text-xs">Time Remaining</div>
                          <div className="text-white font-medium">
                            {formatTimeRemaining(order.expiryTime)}
                          </div>
                        </div>
                      )}
                      {order.status === 'filled' && order.filledAmount && (
                        <div>
                          <div className="text-gray-400 text-xs">Filled Amount</div>
                          <div className="text-green-400 font-medium">
                            {formatAmount(order.filledAmount, order.toToken)} {getTokenSymbol(order.toToken)}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-white/10">
                      <div>Created: {formatTimestamp(order.createdAt)}</div>
                      {order.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancellingId === order.id}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 min-h-[36px]"
                        >
                          {cancellingId === order.id ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Cancelling...
                            </>
                          ) : (
                            'Cancel Order'
                          )}
                        </Button>
                      )}
                      {order.txHash && (
                        <a
                          href={`https://etherscan.io/tx/${order.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300"
                        >
                          View TX
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No {activeTab} orders found</p>
                <p className="text-sm mt-1">Create a limit order to get started</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
