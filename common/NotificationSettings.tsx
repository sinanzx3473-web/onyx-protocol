import { useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';

export function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences
  } = useNotifications();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const success = await subscribe();
      if (success) {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications for important events.',
        });
      } else {
        toast({
          title: 'Failed to Enable Notifications',
          description: 'Please check your browser permissions and try again.',
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const success = await unsubscribe();
      if (success) {
        toast({
          title: 'Notifications Disabled',
          description: 'You will no longer receive push notifications.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferenceChange = async (key: string, value: boolean) => {
    const success = await updatePreferences({ [key]: value });
    if (success) {
      toast({
        title: 'Preferences Updated',
        description: 'Your notification preferences have been saved.',
      });
    }
  };

  if (!isSupported) {
    return (
      <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            Notifications Not Supported
          </CardTitle>
          <CardDescription className="text-white/60">
            Your browser does not support push notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 border-white/10 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
        </CardTitle>
        <CardDescription className="text-white/60">
          Get notified about important events and transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Notifications */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-white font-medium">
              {isSubscribed ? 'Notifications Enabled' : 'Enable Notifications'}
            </Label>
            <p className="text-sm text-white/60">
              {permission === 'denied' 
                ? 'Notifications are blocked. Please enable them in your browser settings.'
                : isSubscribed 
                  ? 'You are receiving push notifications'
                  : 'Subscribe to receive push notifications'
              }
            </p>
          </div>
          <Button
            onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
            disabled={isLoading || permission === 'denied'}
            variant={isSubscribed ? 'outline' : 'default'}
            className={isSubscribed ? 'border-white/20 text-white' : ''}
          >
            {isLoading ? (
              'Loading...'
            ) : isSubscribed ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Enabled
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Enable
              </>
            )}
          </Button>
        </div>

        {/* Notification Preferences */}
        {isSubscribed && preferences && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h4 className="text-white font-medium text-sm">Notification Types</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="transactions" className="text-white text-sm">
                    Transaction Updates
                  </Label>
                  <p className="text-xs text-white/60">
                    Get notified when your transactions complete
                  </p>
                </div>
                <Switch
                  id="transactions"
                  checked={preferences.transactions}
                  onCheckedChange={(checked) => handlePreferenceChange('transactions', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="poolChanges" className="text-white text-sm">
                    Pool Changes
                  </Label>
                  <p className="text-xs text-white/60">
                    Notifications for liquidity pool updates
                  </p>
                </div>
                <Switch
                  id="poolChanges"
                  checked={preferences.poolChanges}
                  onCheckedChange={(checked) => handlePreferenceChange('poolChanges', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="volumeSpikes" className="text-white text-sm">
                    Volume Spikes
                  </Label>
                  <p className="text-xs text-white/60">
                    Alerts for significant trading volume increases
                  </p>
                </div>
                <Switch
                  id="volumeSpikes"
                  checked={preferences.volumeSpikes}
                  onCheckedChange={(checked) => handlePreferenceChange('volumeSpikes', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="priceAlerts" className="text-white text-sm">
                    Price Alerts
                  </Label>
                  <p className="text-xs text-white/60">
                    Get notified about significant price movements
                  </p>
                </div>
                <Switch
                  id="priceAlerts"
                  checked={preferences.priceAlerts}
                  onCheckedChange={(checked) => handlePreferenceChange('priceAlerts', checked)}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
