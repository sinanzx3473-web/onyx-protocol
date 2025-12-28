import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { notificationService, NotificationPayload, NotificationService } from '@/utils/notifications';

interface NotificationPreferences {
  transactions: boolean;
  poolChanges: boolean;
  volumeSpikes: boolean;
  priceAlerts: boolean;
}

interface UseNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  preferences: NotificationPreferences | null;
  requestPermission: () => Promise<NotificationPermission>;
  subscribe: (prefs?: Partial<NotificationPreferences>) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
  sendNotification: (payload: NotificationPayload) => Promise<void>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  transactions: true,
  poolChanges: true,
  volumeSpikes: true,
  priceAlerts: false
};

export function useNotifications(): UseNotificationsReturn {
  const { address } = useAccount();
  const [isSupported] = useState(() => NotificationService.isSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() => 
    isSupported ? Notification.permission : 'denied'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  // Check subscription status on mount and address change
  useEffect(() => {
    if (!address || !isSupported) return;

    const checkSubscription = async () => {
      try {
        const response = await fetch(`/api/notifications/subscription/${address}`);
        const data = await response.json();
        
        setIsSubscribed(data.subscribed);
        if (data.subscribed && data.preferences) {
          setPreferences(data.preferences);
        }
      } catch (error) {
        console.error('Failed to check subscription status:', error);
      }
    };

    checkSubscription();
  }, [address, isSupported]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'denied';

    const perm = await notificationService.requestPermission();
    setPermission(perm);
    return perm;
  }, [isSupported]);

  const subscribe = useCallback(async (prefs?: Partial<NotificationPreferences>): Promise<boolean> => {
    if (!address || !isSupported) return false;

    try {
      // Request permission first
      const perm = await requestPermission();
      if (perm !== 'granted') return false;

      // Initialize notification service
      await notificationService.initialize();

      // Get push subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.VITE_VAPID_PUBLIC_KEY || ''
        )
      });

      // Send subscription to backend
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth'))
          },
          userAddress: address,
          preferences: { ...DEFAULT_PREFERENCES, ...prefs }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsSubscribed(true);
        setPreferences({ ...DEFAULT_PREFERENCES, ...prefs });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      return false;
    }
  }, [address, isSupported, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    try {
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsSubscribed(false);
        setPreferences(null);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to unsubscribe from notifications:', error);
      return false;
    }
  }, [address]);

  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>): Promise<boolean> => {
    if (!address || !isSubscribed) return false;

    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          preferences: prefs
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPreferences(data.preferences);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }, [address, isSubscribed]);

  const sendNotification = useCallback(async (payload: NotificationPayload): Promise<void> => {
    await notificationService.showNotification(payload);
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    requestPermission,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendNotification
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
