import { Alert } from '../routes/alerts.js';
import { alertEvaluator } from './alertEvaluator.js';

interface MarketData {
  poolAddress?: string;
  tokenAddress?: string;
  price?: string;
  volume24h?: string;
  volumeChange?: string;
  apr?: string;
  flashLoanAmount?: string;
  timestamp: Date;
}

class AlertMonitorService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start monitoring alerts
   */
  start(intervalMs: number = 5000): void {
    if (this.isRunning) {
      console.warn('Alert monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🔔 Alert monitor started (checking every ${intervalMs}ms)`);

    this.monitoringInterval = setInterval(() => {
      this.checkAlerts().catch(error => {
        console.error('Error checking alerts:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop monitoring alerts
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('🔕 Alert monitor stopped');
  }

  /**
   * Check all active alerts against current market data
   */
  private async checkAlerts(): Promise<void> {
    try {
      // In production, this would:
      // 1. Fetch all active alerts from database
      // 2. Fetch current market data from indexer/subgraph
      // 3. Evaluate each alert
      // 4. Deliver triggered alerts

      // For now, we'll simulate with mock data
      const marketData = await this.fetchMarketData();
      
      // This would fetch from database in production
      const activeAlerts = await this.getActiveAlerts();

      for (const alert of activeAlerts) {
        const shouldTrigger = alertEvaluator.evaluateAlert(alert, marketData);

        if (shouldTrigger) {
          await this.handleTriggeredAlert(alert, marketData);
        }
      }
    } catch (error) {
      console.error('Error in alert monitoring cycle:', error);
    }
  }

  /**
   * Fetch current market data
   * In production, this would query indexer/subgraph
   */
  private async fetchMarketData(): Promise<MarketData> {
    // Mock implementation
    // In production, fetch from:
    // - The Graph subgraph
    // - Custom indexer
    // - Price oracles
    // - DEX analytics API

    return {
      timestamp: new Date()
      // Real data would be fetched here
    };
  }

  /**
   * Get all active alerts
   * In production, this would query database
   */
  private async getActiveAlerts(): Promise<Alert[]> {
    // Mock implementation
    // In production, query database for active alerts
    return [];
  }

  /**
   * Handle a triggered alert
   */
  private async handleTriggeredAlert(alert: Alert, marketData: MarketData): Promise<void> {
    try {
      // Check if alert was recently triggered to avoid spam
      if (this.wasRecentlyTriggered(alert)) {
        return;
      }

      const message = alertEvaluator.generateAlertMessage(alert, marketData);

      // Deliver alert through configured channels
      await alertEvaluator.deliverAlert({
        alert,
        marketData,
        message
      });

      // Update last triggered timestamp
      await this.updateAlertTriggerTime(alert);

      console.log(`✅ Alert triggered: ${alert.name} (${alert.id})`);
    } catch (error) {
      console.error(`Failed to handle triggered alert ${alert.id}:`, error);
    }
  }

  /**
   * Check if alert was triggered recently (within cooldown period)
   */
  private wasRecentlyTriggered(alert: Alert): boolean {
    if (!alert.lastTriggered) return false;

    const cooldownMs = 5 * 60 * 1000; // 5 minutes cooldown
    const timeSinceLastTrigger = Date.now() - new Date(alert.lastTriggered).getTime();

    return timeSinceLastTrigger < cooldownMs;
  }

  /**
   * Update alert's last triggered timestamp
   */
  private async updateAlertTriggerTime(alert: Alert): Promise<void> {
    // In production, update database
    alert.lastTriggered = new Date().toISOString() as any;
  }

  /**
   * Process market event and check relevant alerts
   * This is called when new market data arrives (e.g., from websocket, webhook)
   */
  async processMarketEvent(marketData: MarketData): Promise<void> {
    try {
      // Get alerts relevant to this market data
      const relevantAlerts = await this.getRelevantAlerts(marketData);

      for (const alert of relevantAlerts) {
        const shouldTrigger = alertEvaluator.evaluateAlert(alert, marketData);

        if (shouldTrigger) {
          await this.handleTriggeredAlert(alert, marketData);
        }
      }
    } catch (error) {
      console.error('Error processing market event:', error);
    }
  }

  /**
   * Get alerts relevant to specific market data
   */
  private async getRelevantAlerts(_marketData: MarketData): Promise<Alert[]> {
    // In production, query database for alerts matching:
    // - poolAddress (if provided)
    // - tokenAddress (if provided)
    // - alert type matching the data type
    
    return [];
  }
}

export const alertMonitor = new AlertMonitorService();
