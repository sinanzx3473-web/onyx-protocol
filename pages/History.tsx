import { ExternalLink } from 'lucide-react';

interface Transaction {
  hash: string;
  method: string;
  value: string;
  age: string;
  status: 'success' | 'pending' | 'failed';
}

export default function History() {
  // Mock transaction data
  const mockTransactions: Transaction[] = [
    {
      hash: '0x3a7f9e2b1c4d8a5f6e9b2c1d4a7f8e5b3c6d9a2f',
      method: 'Swap 10 ETH → USDC',
      value: '$32,450.00',
      age: '2m ago',
      status: 'success'
    },
    {
      hash: '0x8b4e1f7a9c2d5e8f3b6a9c2d5e8f1a4b7c9d2e5f',
      method: 'Add Liquidity ETH/USDT',
      value: '$15,000.00',
      age: '15m ago',
      status: 'success'
    },
    {
      hash: '0x2c5d8e1f4a7b9c2d5e8f1a4b7c9d2e5f8a1b4c7d',
      method: 'Remove Liquidity WBTC/ETH',
      value: '$8,750.50',
      age: '1h ago',
      status: 'pending'
    },
    {
      hash: '0x9f3e6b2a5c8d1e4f7a9b2c5d8e1f4a7b9c2d5e8f',
      method: 'Swap 500 USDC → DAI',
      value: '$500.00',
      age: '3h ago',
      status: 'success'
    },
    {
      hash: '0x1a4b7c9d2e5f8a1b4c7d9e2f5a8b1c4d7e9f2a5b',
      method: 'Flash Loan 1000 ETH',
      value: '$3,245,000.00',
      age: '6h ago',
      status: 'success'
    },
    {
      hash: '0x7e9f2a5b8c1d4e7f9a2b5c8d1e4f7a9b2c5d8e1f',
      method: 'Swap 2.5 BTC → ETH',
      value: '$162,500.00',
      age: '12h ago',
      status: 'success'
    }
  ];

  const getStatusPill = (status: Transaction['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-3 py-1 rounded-full bg-success/20 text-success text-xs font-bold tracking-wider border border-success/30">
            SUCCESS
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 rounded-full bg-gold/20 text-gold text-xs font-bold tracking-wider border border-gold/30 animate-pulse">
            PENDING
          </span>
        );
      case 'failed':
        return (
          <span className="px-3 py-1 rounded-full bg-danger/20 text-danger text-xs font-bold tracking-wider border border-danger/30">
            FAILED
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-void text-platinum p-8">
      {/* Header */}
      <h1 className="font-['Cinzel'] text-4xl text-gold tracking-widest text-center mb-12">
        IMMUTABLE ARCHIVE
      </h1>

      {/* Holographic Ledger Table */}
      <div className="max-w-6xl mx-auto bg-black/40 backdrop-blur-md border border-gold/30 rounded-lg p-8 shadow-[0_0_50px_rgba(212,175,55,0.1)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gold/20">
                <th className="font-mono text-xs text-gold/50 tracking-widest uppercase text-left py-4 px-4">
                  Hash
                </th>
                <th className="font-mono text-xs text-gold/50 tracking-widest uppercase text-left py-4 px-4">
                  Method
                </th>
                <th className="font-mono text-xs text-gold/50 tracking-widest uppercase text-right py-4 px-4">
                  Value
                </th>
                <th className="font-mono text-xs text-gold/50 tracking-widest uppercase text-right py-4 px-4">
                  Age
                </th>
                <th className="font-mono text-xs text-gold/50 tracking-widest uppercase text-center py-4 px-4">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {mockTransactions.map((tx, idx) => (
                <tr
                  key={idx}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/30 group-hover:text-gold transition-colors truncate max-w-[200px]">
                        {tx.hash}
                      </span>
                      <a
                        href={`https://etherscan.io/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3 text-gold/50 hover:text-gold" />
                      </a>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-platinum group-hover:text-gold transition-colors">
                      {tx.method}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono text-sm text-platinum/70 group-hover:text-platinum transition-colors">
                      {tx.value}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono text-xs text-platinum/50 group-hover:text-platinum/70 transition-colors">
                      {tx.age}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {getStatusPill(tx.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="mt-6 pt-6 border-t border-gold/10">
          <p className="font-mono text-xs text-platinum/30 text-center tracking-wide">
            All transactions are permanently recorded on the blockchain
          </p>
        </div>
      </div>
    </div>
  );
}
