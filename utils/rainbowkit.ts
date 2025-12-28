import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { customChain } from './wagmiConfig';

export const rainbowKitConfig = getDefaultConfig({
  appName: 'DEX - Decentralized Exchange',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [customChain],
  ssr: false
});
