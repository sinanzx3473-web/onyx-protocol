// Push notification utilities for PWA

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class NotificationService {
  private static instance: NotificationService;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  static isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  async showNotification(payload: NotificationPayload): Promise<void> {
    const permission = await this.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      console.error('Service worker not registered');
      return;
    }

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/icon-96x96.png',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: false
    };

    await this.registration.showNotification(payload.title, options);
  }

  // Transaction completion notification
  async notifyTransactionComplete(txHash: string, type: 'swap' | 'liquidity' | 'flashloan', success: boolean): Promise<void> {
    const title = success 
      ? `${type.charAt(0).toUpperCase() + type.slice(1)} Successful`
      : `${type.charAt(0).toUpperCase() + type.slice(1)} Failed`;
    
    const body = success
      ? `Your ${type} transaction has been confirmed on-chain.`
      : `Your ${type} transaction failed. Please try again.`;

    await this.showNotification({
      title,
      body,
      tag: `tx-${txHash}`,
      data: { txHash, type, success },
      actions: [
        {
          action: 'view',
          title: 'View Details'
        }
      ]
    });
  }

  // Pool change notification
  async notifyPoolChange(poolAddress: string, change: 'created' | 'liquidity_added' | 'liquidity_removed', amount?: string): Promise<void> {
    const titles = {
      created: 'New Pool Created',
      liquidity_added: 'Liquidity Added',
      liquidity_removed: 'Liquidity Removed'
    };

    const bodies = {
      created: `A new liquidity pool has been created.`,
      liquidity_added: amount ? `${amount} liquidity added to pool.` : 'Liquidity added to pool.',
      liquidity_removed: amount ? `${amount} liquidity removed from pool.` : 'Liquidity removed from pool.'
    };

    await this.showNotification({
      title: titles[change],
      body: bodies[change],
      tag: `pool-${poolAddress}-${change}`,
      data: { poolAddress, change, amount }
    });
  }

  // Volume spike notification
  async notifyVolumeSpike(poolAddress: string, volumeIncrease: number): Promise<void> {
    await this.showNotification({
      title: 'High Trading Volume',
      body: `Trading volume increased by ${volumeIncrease}% in this pool.`,
      tag: `volume-${poolAddress}`,
      data: { poolAddress, volumeIncrease },
      actions: [
        {
          action: 'view-pool',
          title: 'View Pool'
        }
      ]
    });
  }

  // Price alert notification
  async notifyPriceAlert(tokenSymbol: string, price: string, direction: 'up' | 'down'): Promise<void> {
    await this.showNotification({
      title: `${tokenSymbol} Price Alert`,
      body: `${tokenSymbol} price moved ${direction} to ${price}`,
      tag: `price-${tokenSymbol}`,
      data: { tokenSymbol, price, direction }
    });
  }

  // Get current permission status
  static getPermission(): NotificationPermission {
    return Notification.permission;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
