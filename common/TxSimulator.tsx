import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits, Address } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  ArrowRight,
  Loader2,
  Info,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROUTER_ADDRESS, FLASH_SWAP_ADDRESS } from '@/utils/evmConfig';

interface SimulationResult {
  success: boolean;
  preState: {
    userBalances: Record<string, string>;
    poolReserves?: { token0: string; token1: string };
    poolLPSupply?: string;
  };
  postState: {
    userBalances: Record<string, string>;
    poolReserves?: { token0: string; token1: string };
    poolLPSupply?: string;
  };
  execution: {
    gasUsed: string;
    gasPrice: string;
    totalGasCost: string;
    tokensReceived?: string;
    tokensSpent?: string;
    lpTokensReceived?: string;
    priceImpact?: number;
    effectivePrice?: string;
  };
  errors?: string[];
  warnings?: string[];
}

interface ScenarioComparison {
  name: string;
  slippage?: number;
  gasPrice?: string;
  result: SimulationResult;
}

interface TxSimulatorProps {
  type: 'swap' | 'liquidity' | 'flashloan';
  params: {
    fromToken?: string;
    toToken?: string;
    tokenA?: string;
    tokenB?: string;
    token?: string;
    amountIn?: string;
    amountA?: string;
    amountB?: string;
    amount?: string;
    action?: 'add' | 'remove';
    borrowerContract?: string;
    calldata?: string;
    poolAddress?: string;
  };
  slippage?: number;
  onSimulationComplete?: (result: SimulationResult) => void;
}

export function TxSimulator({ type, params, slippage = 0.5, onSimulationComplete }: TxSimulatorProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { toast } = useToast();

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioComparison[]>([]);
  const [customAddress, setCustomAddress] = useState('');
  const [customGasPrice, setCustomGasPrice] = useState('');

  const runSimulation = async (customParams?: { slippage?: number; gasPrice?: string; userAddress?: string }) => {
    if (!address && !customParams?.userAddress) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet or enter a custom address',
        variant: 'destructive',
      });
      return;
    }

    setIsSimulating(true);

    try {
      const simulationParams = buildSimulationParams(customParams);

      const response = await fetch('/api/simulate-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulationParams),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Simulation failed');
      }

      const result = data.data as SimulationResult;
      setSimulationResult(result);

      if (onSimulationComplete) {
        onSimulationComplete(result);
      }

      if (result.errors && result.errors.length > 0) {
        toast({
          title: 'Simulation Errors',
          description: result.errors.join(', '),
          variant: 'destructive',
        });
      } else if (result.warnings && result.warnings.length > 0) {
        toast({
          title: 'Simulation Warnings',
          description: result.warnings.join(', '),
        });
      } else {
        toast({
          title: 'Simulation Complete',
          description: 'Transaction preview ready',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Simulation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const runComparison = async () => {
    if (!address) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsSimulating(true);

    try {
      const baseSimulation = buildSimulationParams();
      const comparisonScenarios = [
        { name: 'Low Slippage (0.1%)', slippage: 0.1 },
        { name: 'Medium Slippage (0.5%)', slippage: 0.5 },
        { name: 'High Slippage (1%)', slippage: 1.0 },
      ];

      const response = await fetch('/api/simulate-tx/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseSimulation,
          scenarios: comparisonScenarios,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Comparison failed');
      }

      setSimulationResult(data.data.base);
      setScenarios(data.data.scenarios);

      toast({
        title: 'Comparison Complete',
        description: `Analyzed ${comparisonScenarios.length} scenarios`,
      });
    } catch (error: any) {
      toast({
        title: 'Comparison Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const buildSimulationParams = (customParams?: { slippage?: number; gasPrice?: string; userAddress?: string }) => {
    const baseParams = {
      type,
      chainId,
      slippage: customParams?.slippage ?? slippage,
      gasPrice: customParams?.gasPrice || customGasPrice || undefined,
      userAddress: customParams?.userAddress || customAddress || address,
      routerAddress: ROUTER_ADDRESS,
      flashSwapAddress: FLASH_SWAP_ADDRESS,
    };

    if (type === 'swap') {
      return {
        ...baseParams,
        fromToken: params.fromToken!,
        toToken: params.toToken!,
        amountIn: params.amountIn!,
      };
    } else if (type === 'liquidity') {
      return {
        ...baseParams,
        action: params.action!,
        tokenA: params.tokenA!,
        tokenB: params.tokenB!,
        amountA: params.amountA!,
        amountB: params.amountB!,
        poolAddress: params.poolAddress,
      };
    } else {
      return {
        ...baseParams,
        token: params.token!,
        amount: params.amount!,
        borrowerContract: params.borrowerContract!,
        calldata: params.calldata || '0x',
      };
    }
  };

  const formatBalance = (balance: string, decimals: number = 18) => {
    try {
      return Number(formatUnits(BigInt(balance), decimals)).toFixed(6);
    } catch {
      return '0.000000';
    }
  };

  const formatGas = (wei: string) => {
    try {
      return Number(formatUnits(BigInt(wei), 18)).toFixed(6);
    } catch {
      return '0.000000';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Transaction Simulator
        </CardTitle>
        <CardDescription>
          Preview the exact outcome before executing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={compareMode ? 'compare' : 'single'} onValueChange={(v) => setCompareMode(v === 'compare')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Simulation</TabsTrigger>
            <TabsTrigger value="compare">Compare Scenarios</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-address">Custom Address (Optional)</Label>
                <Input
                  id="custom-address"
                  placeholder="0x..."
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-gas">Custom Gas Price (Optional)</Label>
                <Input
                  id="custom-gas"
                  placeholder="Wei"
                  value={customGasPrice}
                  onChange={(e) => setCustomGasPrice(e.target.value)}
                />
              </div>
            </div>

            <Button 
              onClick={() => runSimulation()} 
              disabled={isSimulating}
              className="w-full"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Simulation
                </>
              )}
            </Button>

            {simulationResult && (
              <SimulationResultDisplay result={simulationResult} type={type} />
            )}
          </TabsContent>

          <TabsContent value="compare" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Multi-Scenario Analysis</AlertTitle>
              <AlertDescription>
                Compare outcomes across different slippage settings
              </AlertDescription>
            </Alert>

            <Button 
              onClick={runComparison} 
              disabled={isSimulating}
              className="w-full"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Compare Scenarios
                </>
              )}
            </Button>

            {scenarios.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Scenario Comparison</h3>
                {scenarios.map((scenario, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{scenario.name}</span>
                      <Badge variant={scenario.result.success ? 'default' : 'destructive'}>
                        {scenario.result.success ? 'Success' : 'Failed'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Gas:</span>{' '}
                        {formatGas(scenario.result.execution.totalGasCost)} ETH
                      </div>
                      {scenario.result.execution.tokensReceived && (
                        <div>
                          <span className="text-muted-foreground">Received:</span>{' '}
                          {formatBalance(scenario.result.execution.tokensReceived)}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SimulationResultDisplay({ result, type }: { result: SimulationResult; type: string }) {
  const formatBalance = (balance: string, decimals: number = 18) => {
    try {
      return Number(formatUnits(BigInt(balance), decimals)).toFixed(6);
    } catch {
      return '0.000000';
    }
  };

  const formatGas = (wei: string) => {
    try {
      return Number(formatUnits(BigInt(wei), 18)).toFixed(6);
    } catch {
      return '0.000000';
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant={result.success ? 'default' : 'destructive'}>
        {result.success ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertTitle>
          {result.success ? 'Simulation Successful' : 'Simulation Failed'}
        </AlertTitle>
        <AlertDescription>
          {result.success 
            ? 'Transaction will execute successfully with the following outcome'
            : result.errors?.join(', ')}
        </AlertDescription>
      </Alert>

      {result.warnings && result.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            {result.warnings.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Execution Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gas Used:</span>
              <span className="font-mono">{Number(result.execution.gasUsed).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gas Price:</span>
              <span className="font-mono">{formatGas(result.execution.gasPrice)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Gas Cost:</span>
              <span className="font-mono font-semibold">{formatGas(result.execution.totalGasCost)} ETH</span>
            </div>
            {result.execution.priceImpact !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price Impact:</span>
                <span className={`font-semibold ${result.execution.priceImpact > 5 ? 'text-red-500' : 'text-green-500'}`}>
                  {result.execution.priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
            {result.execution.effectivePrice && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective Price:</span>
                <span className="font-mono">{result.execution.effectivePrice}</span>
              </div>
            )}
          </div>
        </Card>

        {type === 'swap' && result.execution.tokensReceived && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Token Flow
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tokens Spent:</span>
                <span className="font-mono text-red-500">-{formatBalance(result.execution.tokensSpent!)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tokens Received:</span>
                <span className="font-mono text-green-500">+{formatBalance(result.execution.tokensReceived)}</span>
              </div>
            </div>
          </Card>
        )}

        {type === 'liquidity' && result.execution.lpTokensReceived && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">LP Tokens</h3>
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">LP Tokens Received:</span>
                <span className="font-mono text-green-500">+{formatBalance(result.execution.lpTokensReceived)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
