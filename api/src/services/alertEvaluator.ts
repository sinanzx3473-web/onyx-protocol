import { Alert } from '../routes/alerts.js';
import nodemailer from 'nodemailer';

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

interface AlertDelivery {
  alert: Alert;
  marketData: MarketData;
  message: string;
}

class AlertEvaluatorService {
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    // Initialize email transporter if credentials are available
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  /**
   * Evaluate a single alert against market data
   */
  evaluateAlert(alert: Alert, marketData: MarketData): boolean {
    // Skip inactive alerts
    if (!alert.isActive) return false;

    // Match alert to relevant data
    if (alert.poolAddress && alert.poolAddress !== marketData.poolAddress) return false;
    if (alert.tokenAddress && alert.tokenAddress !== marketData.tokenAddress) return false;

    // Evaluate based on alert type
    switch (alert.type) {
      case 'price_cross':
        return this.evaluatePriceCross(alert, marketData);
      
      case 'volume_spike':
        return this.evaluateVolumeSpike(alert, marketData);
      
      case 'apr_change':
        return this.evaluateAPRChange(alert, marketData);
      
      case 'flash_loan_threshold':
        return this.evaluateFlashLoanThreshold(alert, marketData);
      
      default:
        return false;
    }
  }

  private evaluatePriceCross(alert: Alert, marketData: MarketData): boolean {
    if (!marketData.price) return false;

    const targetPrice = parseFloat(alert.targetValue);
    const currentPrice = parseFloat(marketData.price);

    if (isNaN(targetPrice) || isNaN(currentPrice)) return false;

    switch (alert.condition) {
      case 'above':
        return currentPrice > targetPrice;
      
      case 'below':
        return currentPrice < targetPrice;
      
      case 'crosses_above':
        // Would need historical data to detect crossing
        return currentPrice > targetPrice;
      
      case 'crosses_below':
        // Would need historical data to detect crossing
        return currentPrice < targetPrice;
      
      default:
        return false;
    }
  }

  private evaluateVolumeSpike(alert: Alert, marketData: MarketData): boolean {
    if (!marketData.volumeChange) return false;

    const targetIncrease = parseFloat(alert.targetValue);
    const volumeIncrease = parseFloat(marketData.volumeChange);

    if (isNaN(targetIncrease) || isNaN(volumeIncrease)) return false;

    return alert.condition === 'increases_by' && volumeIncrease >= targetIncrease;
  }

  private evaluateAPRChange(alert: Alert, marketData: MarketData): boolean {
    if (!marketData.apr) return false;

    const targetAPR = parseFloat(alert.targetValue);
    const currentAPR = parseFloat(marketData.apr);

    if (isNaN(targetAPR) || isNaN(currentAPR)) return false;

    switch (alert.condition) {
      case 'above':
        return currentAPR > targetAPR;
      
      case 'below':
        return currentAPR < targetAPR;
      
      case 'decreases_by':
        // Would need historical data to calculate decrease
        return currentAPR < targetAPR;
      
      default:
        return false;
    }
  }

  private evaluateFlashLoanThreshold(alert: Alert, marketData: MarketData): boolean {
    if (!marketData.flashLoanAmount) return false;

    const targetAmount = parseFloat(alert.targetValue);
    const loanAmount = parseFloat(marketData.flashLoanAmount);

    if (isNaN(targetAmount) || isNaN(loanAmount)) return false;

    return alert.condition === 'above' && loanAmount > targetAmount;
  }

  /**
   * Deliver alert through configured channels
   */
  async deliverAlert(delivery: AlertDelivery): Promise<void> {
    const { alert, message } = delivery;

    const deliveryPromises = alert.deliveryMethods.map(async (method) => {
      try {
        switch (method) {
          case 'in_app':
            await this.deliverInApp(alert, message);
            break;
          
          case 'push':
            await this.deliverPush(alert, message);
            break;
          
          case 'email':
            await this.deliverEmail(alert, message);
            break;
          
          case 'webhook':
            await this.deliverWebhook(alert, message, delivery.marketData);
            break;
        }
      } catch (error) {
        console.error(`Failed to deliver alert via ${method}:`, error);
      }
    });

    await Promise.allSettled(deliveryPromises);
  }

  private async deliverInApp(alert: Alert, message: string): Promise<void> {
    // Store in-app notification (would use database in production)
    console.log(`[IN-APP] Alert ${alert.id}: ${message}`);
    
    // In production, this would:
    // 1. Store notification in database
    // 2. Send via WebSocket to connected clients
    // 3. Update notification count in user's session
  }

  private async deliverPush(alert: Alert, message: string): Promise<void> {
    // Send push notification via service worker
    console.log(`[PUSH] Alert ${alert.id}: ${message}`);
    
    // In production, this would:
    // 1. Look up user's push subscription from database
    // 2. Send push notification via web-push library
    // 3. Handle subscription errors and cleanup
  }

  private async deliverEmail(alert: Alert, message: string): Promise<void> {
    if (!this.emailTransporter) {
      console.warn('Email transporter not configured');
      return;
    }

    // In production, fetch user email from database
    const userEmail = `user-${alert.userId}@example.com`;

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@dex.app',
      to: userEmail,
      subject: `Alert: ${alert.name}`,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8b5cf6;">Alert Triggered</h2>
          <h3>${alert.name}</h3>
          <p>${message}</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This alert was triggered at ${new Date().toLocaleString()}
          </p>
        </div>
      `
    });

    console.log(`[EMAIL] Sent to ${userEmail}: ${message}`);
  }

  private async deliverWebhook(alert: Alert, message: string, marketData: MarketData): Promise<void> {
    if (!alert.webhookUrl) {
      console.warn('Webhook URL not configured for alert');
      return;
    }

    const payload = {
      alertId: alert.id,
      alertName: alert.name,
      alertType: alert.type,
      message,
      marketData,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(alert.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DEX-Alert-Service/1.0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }

    console.log(`[WEBHOOK] Delivered to ${alert.webhookUrl}: ${message}`);
  }

  /**
   * Generate human-readable message for alert
   */
  generateAlertMessage(alert: Alert, marketData: MarketData): string {
    const symbol = alert.tokenSymbol || 'Token';
    
    switch (alert.type) {
      case 'price_cross':
        return `${symbol} price ${alert.condition.replace('_', ' ')} ${alert.targetValue}. Current price: ${marketData.price}`;
      
      case 'volume_spike':
        return `${symbol} volume increased by ${marketData.volumeChange}% (threshold: ${alert.targetValue}%)`;
      
      case 'apr_change':
        return `Pool APR ${alert.condition.replace('_', ' ')} ${alert.targetValue}%. Current APR: ${marketData.apr}%`;
      
      case 'flash_loan_threshold':
        return `Flash loan of ${marketData.flashLoanAmount} detected (threshold: ${alert.targetValue})`;
      
      default:
        return `Alert "${alert.name}" triggered`;
    }
  }
}

export const alertEvaluator = new AlertEvaluatorService();
