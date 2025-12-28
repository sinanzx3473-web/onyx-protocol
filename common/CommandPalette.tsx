import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  ArrowLeftRight,
  Droplet,
  BarChart3,
  Zap,
  History,
  Settings,
  User,
  Award,
  Wallet,
  Copy,
  Network,
  Percent,
  TrendingUp,
  DollarSign,
  Code,
  ExternalLink,
  Plus,
  Minus,
  Search,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DEX_CORE_ADDRESS,
  ROUTER_ADDRESS,
  FACTORY_ADDRESS,
  FLASH_SWAP_ADDRESS,
  MOCK_TOKEN_A_ADDRESS,
  MOCK_TOKEN_B_ADDRESS,
  selectedChain,
} from '@/utils/evmConfig';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: any;
  action: () => void;
  keywords?: string[];
  group: string;
}

interface CommandPaletteProps {
  onSlippageChange?: (value: number) => void;
  onNetworkSwitch?: () => void;
}

export function CommandPalette({ onSlippageChange, onNetworkSwitch }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  // Global keyboard shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: `${label} copied successfully`,
    });
    setOpen(false);
  };

  // Navigate helper
  const navigateTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  // Define all commands
  const commands: Command[] = useMemo(() => [
    // Navigation commands
    {
      id: 'nav-swap',
      label: 'Swap Tokens',
      description: 'Exchange tokens instantly',
      icon: ArrowLeftRight,
      action: () => navigateTo('/swap'),
      keywords: ['trade', 'exchange', 'convert'],
      group: 'Navigation',
    },
    {
      id: 'nav-liquidity',
      label: 'Add Liquidity',
      description: 'Provide liquidity to pools',
      icon: Plus,
      action: () => navigateTo('/liquidity'),
      keywords: ['lp', 'pool', 'provide', 'deposit'],
      group: 'Navigation',
    },
    {
      id: 'nav-remove-liquidity',
      label: 'Remove Liquidity',
      description: 'Withdraw from liquidity pools',
      icon: Minus,
      action: () => navigateTo('/liquidity'),
      keywords: ['lp', 'pool', 'withdraw', 'exit'],
      group: 'Navigation',
    },
    {
      id: 'nav-pools',
      label: 'View Pools',
      description: 'Browse all liquidity pools',
      icon: BarChart3,
      action: () => navigateTo('/pools'),
      keywords: ['tvl', 'analytics', 'stats'],
      group: 'Navigation',
    },
    {
      id: 'nav-flash',
      label: 'Flash Loan',
      description: 'Execute flash swap arbitrage',
      icon: Zap,
      action: () => navigateTo('/flash-swap'),
      keywords: ['arbitrage', 'flash', 'loan', 'borrow'],
      group: 'Navigation',
    },
    {
      id: 'nav-history',
      label: 'Transaction History',
      description: 'View your transaction history',
      icon: History,
      action: () => navigateTo('/history'),
      keywords: ['txs', 'transactions', 'past'],
      group: 'Navigation',
    },
    {
      id: 'nav-account',
      label: 'My Account',
      description: 'View account and referrals',
      icon: User,
      action: () => navigateTo('/my-account'),
      keywords: ['profile', 'referral', 'settings'],
      group: 'Navigation',
    },
    {
      id: 'nav-rewards',
      label: 'Rewards',
      description: 'View and claim rewards',
      icon: Award,
      action: () => navigateTo('/rewards'),
      keywords: ['claim', 'earnings', 'referral'],
      group: 'Navigation',
    },
    {
      id: 'nav-portfolio',
      label: 'Portfolio Dashboard',
      description: 'View earnings and P&L',
      icon: Wallet,
      action: () => navigateTo('/portfolio'),
      keywords: ['earnings', 'pnl', 'profit', 'loss', 'dashboard'],
      group: 'Navigation',
    },

    // Contract addresses
    {
      id: 'copy-dex-core',
      label: 'Copy DEX Core Address',
      description: DEX_CORE_ADDRESS,
      icon: Copy,
      action: () => copyToClipboard(DEX_CORE_ADDRESS, 'DEX Core address'),
      keywords: ['contract', 'address', 'core'],
      group: 'Contracts',
    },
    {
      id: 'copy-router',
      label: 'Copy Router Address',
      description: ROUTER_ADDRESS,
      icon: Copy,
      action: () => copyToClipboard(ROUTER_ADDRESS, 'Router address'),
      keywords: ['contract', 'address', 'router'],
      group: 'Contracts',
    },
    {
      id: 'copy-factory',
      label: 'Copy Factory Address',
      description: FACTORY_ADDRESS,
      icon: Copy,
      action: () => copyToClipboard(FACTORY_ADDRESS, 'Factory address'),
      keywords: ['contract', 'address', 'factory'],
      group: 'Contracts',
    },
    {
      id: 'copy-flash',
      label: 'Copy Flash Swap Address',
      description: FLASH_SWAP_ADDRESS,
      icon: Copy,
      action: () => copyToClipboard(FLASH_SWAP_ADDRESS, 'Flash Swap address'),
      keywords: ['contract', 'address', 'flash'],
      group: 'Contracts',
    },
    {
      id: 'copy-token-a',
      label: 'Copy Token A Address',
      description: MOCK_TOKEN_A_ADDRESS,
      icon: Copy,
      action: () => copyToClipboard(MOCK_TOKEN_A_ADDRESS, 'Token A address'),
      keywords: ['contract', 'address', 'token', 'tka'],
      group: 'Contracts',
    },
    {
      id: 'copy-token-b',
      label: 'Copy Token B Address',
      description: MOCK_TOKEN_B_ADDRESS,
      icon: Copy,
      action: () => copyToClipboard(MOCK_TOKEN_B_ADDRESS, 'Token B address'),
      keywords: ['contract', 'address', 'token', 'tkb'],
      group: 'Contracts',
    },

    // Settings & Actions
    {
      id: 'set-slippage-05',
      label: 'Set Slippage to 0.5%',
      description: 'Low slippage tolerance',
      icon: Percent,
      action: () => {
        onSlippageChange?.(0.5);
        toast({
          title: 'Slippage Updated',
          description: 'Slippage tolerance set to 0.5%',
        });
        setOpen(false);
      },
      keywords: ['slippage', 'tolerance', 'settings'],
      group: 'Settings',
    },
    {
      id: 'set-slippage-1',
      label: 'Set Slippage to 1%',
      description: 'Medium slippage tolerance',
      icon: Percent,
      action: () => {
        onSlippageChange?.(1);
        toast({
          title: 'Slippage Updated',
          description: 'Slippage tolerance set to 1%',
        });
        setOpen(false);
      },
      keywords: ['slippage', 'tolerance', 'settings'],
      group: 'Settings',
    },
    {
      id: 'set-slippage-3',
      label: 'Set Slippage to 3%',
      description: 'High slippage tolerance',
      icon: Percent,
      action: () => {
        onSlippageChange?.(3);
        toast({
          title: 'Slippage Updated',
          description: 'Slippage tolerance set to 3%',
        });
        setOpen(false);
      },
      keywords: ['slippage', 'tolerance', 'settings'],
      group: 'Settings',
    },
    {
      id: 'switch-network',
      label: 'Switch Network',
      description: `Current: ${selectedChain.network}`,
      icon: Network,
      action: () => {
        onNetworkSwitch?.();
        setOpen(false);
      },
      keywords: ['chain', 'network', 'switch'],
      group: 'Settings',
    },

    // Info & Analytics
    {
      id: 'show-tvl',
      label: 'Show Total Value Locked',
      description: 'View protocol TVL',
      icon: DollarSign,
      action: () => navigateTo('/pools'),
      keywords: ['tvl', 'total', 'value', 'locked', 'stats'],
      group: 'Analytics',
    },
    {
      id: 'view-explorer',
      label: 'View on Block Explorer',
      description: 'Open current network explorer',
      icon: ExternalLink,
      action: () => {
        // Open Etherscan-like explorer based on chain ID
        const explorerUrls: Record<string, string> = {
          '1': 'https://etherscan.io',
          '11155111': 'https://sepolia.etherscan.io',
          '137': 'https://polygonscan.com',
          '80001': 'https://mumbai.polygonscan.com',
          '56': 'https://bscscan.com',
          '97': 'https://testnet.bscscan.com',
        };
        const explorerUrl = explorerUrls[selectedChain.chainId];
        if (explorerUrl) {
          window.open(explorerUrl, '_blank');
          setOpen(false);
        } else {
          toast({
            title: 'Explorer not available',
            description: 'No explorer URL configured for this network',
            variant: 'destructive',
          });
          setOpen(false);
        }
      },
      keywords: ['explorer', 'etherscan', 'blockchain', 'scan'],
      group: 'Analytics',
    },

    // Developer tools
    {
      id: 'copy-wallet',
      label: 'Copy Wallet Address',
      description: address || 'Not connected',
      icon: Wallet,
      action: () => {
        if (address) {
          copyToClipboard(address, 'Wallet address');
        } else {
          toast({
            title: 'Wallet not connected',
            description: 'Please connect your wallet first',
            variant: 'destructive',
          });
          setOpen(false);
        }
      },
      keywords: ['wallet', 'address', 'account'],
      group: 'Developer',
    },
    {
      id: 'copy-chain-id',
      label: 'Copy Chain ID',
      description: `Chain ID: ${selectedChain.chainId}`,
      icon: Code,
      action: () => copyToClipboard(selectedChain.chainId, 'Chain ID'),
      keywords: ['chain', 'id', 'network'],
      group: 'Developer',
    },
  ], [address, isConnected, navigate, toast, onSlippageChange, onNetworkSwitch]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some((kw) => kw.toLowerCase().includes(searchLower));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [commands, search]);

  // Group filtered commands
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        {Object.entries(groupedCommands).map(([group, cmds], idx) => (
          <div key={group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {cmds.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    value={cmd.id}
                    onSelect={() => cmd.action()}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col flex-1">
                      <span>{cmd.label}</span>
                      {cmd.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {cmd.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
