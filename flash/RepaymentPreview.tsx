import { formatUnits } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DollarSign, AlertTriangle, TrendingUp, Info } from 'lucide-react';

interface RepaymentPreviewProps {
  amount: string;
  fee: bigint;
  decimals: number;
  tokenSymbol: string;
  maxLoan: bigint | undefined;
  isBorrowerApproved: boolean;
  className?: string;
}

export function RepaymentPreview({
  amount,
  fee,
  decimals,
  tokenSymbol,
  maxLoan,
  isBorrowerApproved,
  className,
}: RepaymentPreviewProps) {
  const amountNum = parseFloat(amount) || 0;
  const feeFormatted = fee > BigInt(0) ? formatUnits(fee, decimals) : '0';
  const totalRepayment = amountNum > 0 && fee > BigInt(0) 
    ? (parseFloat(amount) + parseFloat(feeFormatted)).toFixed(decimals > 6 ? 6 : decimals)
    : '0';

  const feePercentage = '0.09%';

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          <CardTitle className="text-white text-lg">Repayment Preview</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loan Amount */}
        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
          <span className="text-sm text-gray-400">Loan Amount</span>
          <span className="text-base font-semibold text-white">
            {amountNum > 0 ? `${amount} ${tokenSymbol}` : '—'}
          </span>
        </div>

        {/* Fee */}
        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Flash Loan Fee</span>
            <span className="text-xs text-gray-500">({feePercentage})</span>
          </div>
          <span className="text-base font-semibold text-yellow-400">
            {fee > BigInt(0) ? `${feeFormatted} ${tokenSymbol}` : '—'}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Total Repayment */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg border border-green-500/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-green-300">Total Repayment Required</span>
          </div>
          <span className="text-lg font-bold text-green-400">
            {parseFloat(totalRepayment) > 0 ? `${totalRepayment} ${tokenSymbol}` : '—'}
          </span>
        </div>

        {/* Critical Warning */}
        <Alert className="bg-red-500/10 border-red-500/30">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <AlertDescription className="text-red-300 text-xs">
            <p className="font-semibold mb-1">⚠️ CRITICAL: Same-Transaction Repayment</p>
            <p>
              Your contract MUST transfer exactly <span className="font-bold">{totalRepayment} {tokenSymbol}</span> back
              to the FlashSwap contract within the same transaction, or the entire transaction will revert.
            </p>
          </AlertDescription>
        </Alert>

        {/* Additional Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-300 space-y-1">
              <p>
                <span className="font-semibold">Max Available:</span>{' '}
                {maxLoan ? `${formatUnits(maxLoan, decimals)} ${tokenSymbol}` : 'Loading...'}
              </p>
              <p>
                <span className="font-semibold">Borrower Status:</span>{' '}
                {isBorrowerApproved ? (
                  <span className="text-green-400">✅ Whitelisted</span>
                ) : (
                  <span className="text-red-400">❌ Not Whitelisted</span>
                )}
              </p>
              <p className="text-yellow-400 font-semibold mt-2">
                💡 Fee goes to liquidity providers
              </p>
            </div>
          </div>
        </div>

        {/* Repayment Checklist */}
        <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/10">
          <p className="text-xs font-semibold text-purple-300 mb-2">✅ Repayment Checklist:</p>
          <ul className="text-xs text-purple-400 space-y-1 ml-4 list-disc">
            <li>Contract receives {amount || '0'} {tokenSymbol}</li>
            <li>Execute your strategy (arbitrage/liquidation)</li>
            <li>Approve FlashSwap contract for {totalRepayment} {tokenSymbol}</li>
            <li>Return callback success: keccak256("ERC3156FlashBorrower.onFlashLoan")</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
