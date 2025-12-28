import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface PoolSelectorProps {
  tokens: Token[];
  tokenA: Token;
  tokenB: Token;
  onTokenAChange: (token: Token) => void;
  onTokenBChange: (token: Token) => void;
}

export function PoolSelector({ tokens, tokenA, tokenB, onTokenAChange, onTokenBChange }: PoolSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="token-a-select" className="text-white">
          Token A
        </Label>
        <Select 
          value={tokenA.address} 
          onValueChange={(val) => {
            const token = tokens.find(t => t.address === val);
            if (token) onTokenAChange(token);
          }}
        >
          <SelectTrigger 
            id="token-a-select"
            className="bg-white/5 border-white/10 text-white focus:ring-purple-500"
            aria-label="Select Token A"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tokens.map((token) => (
              <SelectItem 
                key={token.address} 
                value={token.address}
                disabled={token.address === tokenB.address}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-sm text-gray-400">{token.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="token-b-select" className="text-white">
          Token B
        </Label>
        <Select 
          value={tokenB.address} 
          onValueChange={(val) => {
            const token = tokens.find(t => t.address === val);
            if (token) onTokenBChange(token);
          }}
        >
          <SelectTrigger 
            id="token-b-select"
            className="bg-white/5 border-white/10 text-white focus:ring-purple-500"
            aria-label="Select Token B"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tokens.map((token) => (
              <SelectItem 
                key={token.address} 
                value={token.address}
                disabled={token.address === tokenA.address}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-sm text-gray-400">{token.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
