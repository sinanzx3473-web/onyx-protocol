import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Don't show prompt if user dismissed it recently
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS prompt if applicable
    if (iOS && !standalone) {
      const dismissed = localStorage.getItem('pwa-install-dismissed-ios');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    } else {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('pwa-install-dismissed-ios', Date.now().toString());
    } else {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
  };

  // Don't show if already installed or dismissed
  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <Card className="bg-gradient-to-br from-blue-600 to-purple-600 border-0 shadow-2xl">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-sm mb-1">
                Install DEX App
              </h3>
              <p className="text-white/90 text-xs mb-3">
                {isIOS 
                  ? 'Add to your home screen for a better experience. Tap the share button and select "Add to Home Screen".'
                  : 'Install our app for faster access, offline support, and a native app experience.'
                }
              </p>
              
              {!isIOS && (
                <Button
                  onClick={handleInstallClick}
                  size="sm"
                  className="bg-white text-blue-600 hover:bg-white/90 font-medium"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Install Now
                </Button>
              )}
            </div>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
