import { useState } from 'react';
import { usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle2, XCircle, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { FLASH_SWAP_ADDRESS, FLASH_SWAP_ABI } from '@/utils/evmConfig';

interface DryRunSimulatorProps {
  tokenAddress: string;
  amount: string;
  borrowerContract: string;
  calldata: string;
  decimals: number;
  tokenSymbol: string;
  isFormValid: boolean;
  className?: string;
}

interface SimulationResult {
  success: boolean;
  gasUsed?: bigint;
  error?: string;
  errorType?: 'UNAUTHORIZED' | 'INSUFFICIENT_REPAYMENT' | 'INVALID_CALLBACK' | 'INVALID_AMOUNT' | 'UNKNOWN';
}

export function DryRunSimulator({
  tokenAddress,
  amount,
  borrowerContract,
  calldata,
  decimals,
  tokenSymbol,
  isFormValid,
  className,
}: DryRunSimulatorProps) {
  const publicClient = usePublicClient();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const handleSimulate = async () => {
    if (!isFormValid || !publicClient) return;

    setIsSimulating(true);
    setSimulationResult(null);

    try {
      const amountWei = parseUnits(amount, decimals);

      // Simulate the transaction using eth_call
      const result = await publicClient.simulateContract({
        address: FLASH_SWAP_ADDRESS as `0x${string}`,
        abi: FLASH_SWAP_ABI,
        functionName: 'flashLoan',
        args: [
          borrowerContract as `0x${string}`,
          tokenAddress as `0x${string}`,
          amountWei,
          calldata as `0x${string}`,
        ],
        account: borrowerContract as `0x${string}`, // Simulate from borrower's perspective
      });

      // Estimate gas
      const gasEstimate = await publicClient.estimateGas({
        to: FLASH_SWAP_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: FLASH_SWAP_ABI,
          functionName: 'flashLoan',
          args: [
            borrowerContract as `0x${string}`,
            tokenAddress as `0x${string}`,
            amountWei,
            calldata as `0x${string}`,
          ],
        }),
        account: borrowerContract as `0x${string}`,
      });

      setSimulationResult({
        success: true,
        gasUsed: gasEstimate,
      });
    } catch (error: any) {
      console.error('Simulation error:', error);

      // Parse error to provide user-friendly messages
      let errorType: SimulationResult['errorType'] = 'UNKNOWN';
      let errorMessage = error.message || 'Unknown error occurred';

      if (errorMessage.includes('UnauthorizedBorrower') || errorMessage.includes('not approved')) {
        errorType = 'UNAUTHORIZED';
        errorMessage = 'You are not an approved borrower';
      } else if (errorMessage.includes('InsufficientRepayment') || errorMessage.includes('repayment')) {
        errorType = 'INSUFFICIENT_REPAYMENT';
        errorMessage = 'Repayment failed - your contract did not return enough tokens';
      } else if (errorMessage.includes('InvalidCallback') || errorMessage.includes('callback')) {
        errorType = 'INVALID_CALLBACK';
        errorMessage = 'Callback failed - your contract did not return the correct success value';
      } else if (errorMessage.includes('InvalidAmount') || errorMessage.includes('amount')) {
        errorType = 'INVALID_AMOUNT';
        errorMessage = 'Invalid amount - exceeds maximum or insufficient liquidity';
      }

      setSimulationResult({
        success: false,
        error: errorMessage,
        errorType,
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const getErrorExplanation = (errorType: SimulationResult['errorType']) => {
    switch (errorType) {
      case 'UNAUTHORIZED':
        return {
          title: 'Borrower Not Whitelisted',
          description: 'Your contract address is not approved for flash loans. Contact governance to get whitelisted.',
          action: 'Request approval from protocol governance',
        };
      case 'INSUFFICIENT_REPAYMENT':
        return {
          title: 'Repayment Failed',
          description: 'Your contract did not transfer the full loan amount + fee back to the FlashSwap contract.',
          action: 'Ensure your contract approves and transfers the exact repayment amount',
        };
      case 'INVALID_CALLBACK':
        return {
          title: 'Callback Error',
          description: 'Your contract\'s onFlashLoan function did not return the correct success value.',
          action: 'Return keccak256("ERC3156FlashBorrower.onFlashLoan") from your callback',
        };
      case 'INVALID_AMOUNT':
        return {
          title: 'Invalid Loan Amount',
          description: 'The requested amount exceeds available liquidity or maximum flash loan limit.',
          action: 'Reduce the loan amount or wait for more liquidity',
        };
      default:
        return {
          title: 'Simulation Failed',
          description: 'An unexpected error occurred during simulation.',
          action: 'Check your contract code and parameters',
        };
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-white text-lg">Dry Run Simulator</CardTitle>
          </div>
          <Badge variant="outline" className="text-blue-400 border-blue-400/30">
            Test Mode
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <AlertDescription className="text-blue-300 text-sm">
            <p className="font-semibold mb-1">🧪 Safe Testing</p>
            <p className="text-xs">
              Simulate your flash loan without spending gas or risking funds. This will show you exactly what would happen
              if you execute the transaction.
            </p>
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleSimulate}
          disabled={!isFormValid || isSimulating}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
          aria-busy={isSimulating}
        >
          {isSimulating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Simulating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Simulation
            </>
          )}
        </Button>

        {simulationResult && (
          <div className="space-y-3">
            {simulationResult.success ? (
              <Alert className="bg-green-500/10 border-green-500/30">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <AlertTitle className="text-green-300 font-semibold mb-2">
                  ✅ Simulation Successful
                </AlertTitle>
                <AlertDescription className="text-green-400 text-sm space-y-2">
                  <p>Your flash loan would execute successfully!</p>
                  <div className="p-3 bg-green-500/10 rounded-lg space-y-1 text-xs">
                    <p>
                      <span className="font-semibold">Estimated Gas:</span>{' '}
                      {simulationResult.gasUsed ? simulationResult.gasUsed.toLocaleString() : 'N/A'} units
                    </p>
                    <p>
                      <span className="font-semibold">Loan Amount:</span> {amount} {tokenSymbol}
                    </p>
                    <p className="text-green-300 font-semibold mt-2">
                      ✓ Borrower contract is whitelisted
                    </p>
                    <p className="text-green-300 font-semibold">
                      ✓ Repayment logic works correctly
                    </p>
                    <p className="text-green-300 font-semibold">
                      ✓ Callback returns correct value
                    </p>
                  </div>
                  <p className="text-yellow-400 text-xs mt-2">
                    ⚠️ Note: Actual execution may still fail if on-chain conditions change
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-red-500/10 border-red-500/30">
                <XCircle className="w-5 h-5 text-red-400" />
                <AlertTitle className="text-red-300 font-semibold mb-2">
                  ❌ Simulation Failed
                </AlertTitle>
                <AlertDescription className="text-red-400 text-sm space-y-3">
                  {simulationResult.errorType && (
                    <div className="p-3 bg-red-500/10 rounded-lg space-y-2">
                      <p className="font-semibold text-red-300">
                        {getErrorExplanation(simulationResult.errorType).title}
                      </p>
                      <p className="text-xs text-red-400">
                        {getErrorExplanation(simulationResult.errorType).description}
                      </p>
                      <div className="pt-2 border-t border-red-500/20">
                        <p className="text-xs font-semibold text-red-300 mb-1">
                          💡 How to fix:
                        </p>
                        <p className="text-xs text-red-400">
                          {getErrorExplanation(simulationResult.errorType).action}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-xs font-mono text-red-300 break-all">
                      {simulationResult.error}
                    </p>
                  </div>
                  <Alert className="bg-orange-500/10 border-orange-500/20">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <AlertDescription className="text-orange-300 text-xs">
                      <p className="font-semibold mb-1">⚠️ What happens on failure:</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-2">
                        <li>Transaction reverts (no state changes)</li>
                        <li>You lose gas fees (~{simulationResult.gasUsed ? formatUnits(simulationResult.gasUsed, 9) : '0.001'} ETH)</li>
                        <li>No tokens are transferred</li>
                        <li>Your wallet/contract is safe</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!simulationResult && !isSimulating && (
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <p className="text-sm text-gray-400 text-center">
              Click "Run Simulation" to test your flash loan parameters
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
