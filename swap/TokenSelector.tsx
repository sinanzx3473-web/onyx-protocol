import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface TokenSelectorProps {
  tokens: Token[];
  selectedToken: Token;
  onSelectToken: (token: Token) => void;
  excludeToken?: Token;
  label?: string;
}

export function TokenSelector({ 
  tokens, 
  selectedToken, 
  onSelectToken, 
  excludeToken,
  label = 'Select Token'
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTokens = tokens.filter(token => {
    if (excludeToken && token.address === excludeToken.address) return false;
    if (!search) return true;
    
    const searchLower = search.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(searchLower) ||
      token.name.toLowerCase().includes(searchLower) ||
      token.address.toLowerCase().includes(searchLower)
    );
  });

  const handleSelect = (token: Token) => {
    onSelectToken(token);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-32 bg-white/10 border-white/20 text-white hover:bg-white/15 transition-colors justify-between"
      >
        <span className="font-semibold">{selectedToken.symbol}</span>
        <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gradient-to-br from-black/95 to-black/90 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{label}</DialogTitle>
          </DialogHeader>

          <Command className="bg-transparent">
            <div className="flex items-center border-b border-white/10 px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder="Search by name, symbol, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty className="py-6 text-center text-sm text-gray-400">
                No tokens found.
              </CommandEmpty>
              
              <CommandGroup>
                {filteredTokens.map((token) => (
                  <CommandItem
                    key={token.address}
                    value={token.address}
                    onSelect={() => handleSelect(token)}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                        {token.symbol.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{token.symbol}</div>
                        <div className="text-xs text-gray-400">{token.name}</div>
                      </div>
                    </div>
                    
                    {selectedToken.address === token.address && (
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
