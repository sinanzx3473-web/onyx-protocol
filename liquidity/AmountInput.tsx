import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatUnits } from 'viem';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface AmountInputProps {
  label: string;
  token: Token;
  amount: string;
  balance?: bigint;
  onAmountChange: (amount: string) => void;
  disabled?: boolean;
  showMaxButton?: boolean;
}

export function AmountInput({ 
  label, 
  token, 
  amount, 
  balance, 
  onAmountChange, 
  disabled = false,
  showMaxButton = true 
}: AmountInputProps) {
  const handleMaxClick = () => {
    if (balance !== undefined) {
      onAmountChange(formatUnits(balance, token.decimals));
    }
  };

  return (
    <div className="space-y-2">
      {balance !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-brand-platinum/40 font-mono">
            Balance: {parseFloat(formatUnits(balance, token.decimals)).toFixed(4)}
          </span>
          {showMaxButton && balance > 0n && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMaxClick}
              disabled={disabled}
              className="text-xs text-brand-gold/60 hover:text-brand-gold h-auto p-0 font-mono"
              aria-label="Set maximum amount"
            >
              MAX
            </Button>
          )}
        </div>
      )}
      <div className="relative">
        <Input
          id={`amount-${token.symbol}`}
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          disabled={disabled}
          className="bg-transparent border-b border-white/10 text-4xl font-mono text-brand-platinum focus:border-brand-gold outline-none py-4 px-0 rounded-none border-t-0 border-l-0 border-r-0 focus:ring-0 focus:ring-offset-0 placeholder:text-white/10"
          aria-label={`${label} amount`}
          min="0"
          step="any"
        />
      </div>
    </div>
  );
}
