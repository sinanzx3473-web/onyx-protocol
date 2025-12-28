import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/rainbowkit-custom.css'
import App from './App.tsx'
import { withErrorOverlay } from './components/with-error-overlay'
import { validateEnvironment } from './utils/env-check'
import { initializeMonitoring } from './lib/monitoring'

// Initialize monitoring and error tracking
initializeMonitoring();

// Validate environment variables on startup - CRITICAL CHECK
const isEnvValid = validateEnvironment();

if (!isEnvValid) {
  // Render error screen if critical env vars are missing
  createRoot(document.getElementById('root')!).render(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Configuration Error</h1>
      <p style={{ marginBottom: '1rem' }}>Critical environment variables are missing.</p>
      <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Check the browser console for details.</p>
    </div>
  );
} else {
  // Proceed with normal app rendering
  const AppWithErrorOverlay = withErrorOverlay(App);
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppWithErrorOverlay />
    </StrictMode>,
  );
}
