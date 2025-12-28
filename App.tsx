import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import { useDisconnect, useAccount } from 'wagmi';
import { rainbowKitConfig } from './utils/rainbowkit';
import { Toaster } from './components/ui/toaster';
import { useToast } from './hooks/use-toast';
import ErrorBoundary from './components/ErrorBoundary';
import { RelayerProvider } from './context/RelayerProvider';
import { ReferralProvider } from './context/ReferralProvider';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';
import { Concierge } from './components/ai/Concierge';
import { AuroraBackground } from './components/AuroraBackground';

// Lazy load components to reduce initial bundle size
const Void3D = lazy(() => import('./components/layout/Void3D'));
import { CinematicBackground } from './components/layout/CinematicBackground';
import { Navbar } from './components/Navbar';
import { LoadingScreen } from './components/ui/LoadingScreen';

// Lazy load all pages for code splitting
const HomePage = lazy(() => import('./pages/Home'));
const SwapPage = lazy(() => import('./pages/Swap'));
const LiquidityPage = lazy(() => import('./pages/Liquidity'));
const PoolsPage = lazy(() => import('./pages/Pools'));
const BridgePage = lazy(() => import('./pages/Bridge'));
const FuturesPage = lazy(() => import('./pages/Futures'));
const FlashSwapPage = lazy(() => import('./pages/FlashSwap'));
const TransactionHistoryPage = lazy(() => import('./pages/TransactionHistory'));
const MyAccountPage = lazy(() => import('./pages/MyAccount'));
const RewardsPage = lazy(() => import('./pages/Rewards'));
const PortfolioPage = lazy(() => import('./pages/Portfolio'));
const MyAlertsPage = lazy(() => import('./pages/MyAlerts'));
const GovernancePage = lazy(() => import('./pages/Governance'));
const ProposalDetailPage = lazy(() => import('./pages/ProposalDetail'));
const AITerminal = lazy(() => import('./pages/AITerminal'));
const HistoryPage = lazy(() => import('./pages/History'));
const ManifestoPage = lazy(() => import('./pages/Manifesto'));
const LegalPage = lazy(() => import('./pages/Legal'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // Keep unused data in garbage collector for 30 minutes
      refetchOnWindowFocus: false, // Don't refetch just because I clicked away
      retry: 1, // Fail fast, don't keep spinning
    },
  },
});

function WalletDisconnectHandler() {
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { toast } = useToast();

  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // Wallet disconnected
        disconnect();
        toast({
          title: 'Wallet Disconnected',
          description: 'Your wallet has been disconnected.',
          variant: 'default',
        });
      }
    };

    const handleChainChanged = () => {
      // Reload page on chain change to ensure clean state
      window.location.reload();
    };

    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [disconnect, toast]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={rainbowKitConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <RelayerProvider>
              <ReferralProvider>
                <WalletDisconnectHandler />
                <BrowserRouter>
                  {/* Global Background */}
                  <div className="fixed inset-0 z-0">
                    <CinematicBackground />
                  </div>
                  
                  {/* Floating Navbar */}
                  <Navbar />
                  
                  {/* Main Content */}
                  <main className="relative z-10 flex flex-col items-center justify-center min-h-screen pt-24 px-4">
                    <Suspense fallback={<LoadingScreen />}>
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/swap" element={<SwapPage />} />
                        <Route path="/liquidity" element={<LiquidityPage />} />
                        <Route path="/pools" element={<PoolsPage />} />
                        <Route path="/bridge" element={<BridgePage />} />
                        <Route path="/futures" element={<FuturesPage />} />
                        <Route path="/flash-swap" element={<FlashSwapPage />} />
                        <Route path="/my-account" element={<MyAccountPage />} />
                        <Route path="/my-alerts" element={<MyAlertsPage />} />
                        <Route path="/governance" element={<GovernancePage />} />
                        <Route path="/governance/:id" element={<ProposalDetailPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/transaction-history" element={<TransactionHistoryPage />} />
                        <Route path="/rewards" element={<RewardsPage />} />
                        <Route path="/portfolio" element={<PortfolioPage />} />
                        <Route path="/ai" element={<AITerminal />} />
                        <Route path="/manifesto" element={<ManifestoPage />} />
                        <Route path="/legal" element={<LegalPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </main>
                  
                  <Toaster />
                  <PWAInstallPrompt />
                </BrowserRouter>
              </ReferralProvider>
            </RelayerProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}

export default App;
