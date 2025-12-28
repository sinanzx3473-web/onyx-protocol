import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface Alert {
  id: string;
  userId: string;
  name: string;
  type: 'price_cross' | 'volume_spike' | 'apr_change' | 'flash_loan_threshold';
  condition: string;
  targetValue: string;
  poolAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  deliveryMethods: string[];
  webhookUrl?: string;
  isActive: boolean;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateAlertModalProps {
  open: boolean;
  onClose: () => void;
  onAlertCreated: (alert: Alert) => void;
  onAlertUpdated: (alert: Alert) => void;
  editingAlert?: Alert | null;
  userId: string;
}

const alertTypes = [
  { value: 'price_cross', label: 'Price Alert', description: 'Get notified when price crosses a threshold' },
  { value: 'volume_spike', label: 'Volume Spike', description: 'Alert on sudden volume increases' },
  { value: 'apr_change', label: 'APR Change', description: 'Monitor APR changes in pools' },
  { value: 'flash_loan_threshold', label: 'Flash Loan Alert', description: 'Track large flash loans' }
];

const conditionsByType: Record<string, Array<{ value: string; label: string }>> = {
  price_cross: [
    { value: 'above', label: 'Above' },
    { value: 'below', label: 'Below' },
    { value: 'crosses_above', label: 'Crosses Above' },
    { value: 'crosses_below', label: 'Crosses Below' }
  ],
  volume_spike: [
    { value: 'increases_by', label: 'Increases By (%)' }
  ],
  apr_change: [
    { value: 'above', label: 'Above' },
    { value: 'below', label: 'Below' },
    { value: 'decreases_by', label: 'Decreases By (%)' }
  ],
  flash_loan_threshold: [
    { value: 'above', label: 'Above' }
  ]
};

const deliveryOptions = [
  { value: 'in_app', label: 'In-App Notification' },
  { value: 'push', label: 'Push Notification' },
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' }
];

export function CreateAlertModal({ 
  open, 
  onClose, 
  onAlertCreated, 
  onAlertUpdated,
  editingAlert,
  userId 
}: CreateAlertModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'price_cross' as Alert['type'],
    condition: 'above',
    targetValue: '',
    tokenSymbol: '',
    tokenAddress: '',
    poolAddress: '',
    deliveryMethods: ['in_app'] as string[],
    webhookUrl: ''
  });

  useEffect(() => {
    if (editingAlert) {
      setFormData({
        name: editingAlert.name,
        type: editingAlert.type,
        condition: editingAlert.condition,
        targetValue: editingAlert.targetValue,
        tokenSymbol: editingAlert.tokenSymbol || '',
        tokenAddress: editingAlert.tokenAddress || '',
        poolAddress: editingAlert.poolAddress || '',
        deliveryMethods: editingAlert.deliveryMethods,
        webhookUrl: editingAlert.webhookUrl || ''
      });
    } else {
      // Reset form when creating new alert
      setFormData({
        name: '',
        type: 'price_cross',
        condition: 'above',
        targetValue: '',
        tokenSymbol: '',
        tokenAddress: '',
        poolAddress: '',
        deliveryMethods: ['in_app'],
        webhookUrl: ''
      });
    }
  }, [editingAlert, open]);

  const handleTypeChange = (type: Alert['type']) => {
    const defaultCondition = conditionsByType[type][0].value;
    setFormData({ ...formData, type, condition: defaultCondition });
  };

  const handleDeliveryMethodToggle = (method: string) => {
    const methods = formData.deliveryMethods.includes(method)
      ? formData.deliveryMethods.filter(m => m !== method)
      : [...formData.deliveryMethods, method];
    
    setFormData({ ...formData, deliveryMethods: methods });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an alert name',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.targetValue.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a target value',
        variant: 'destructive'
      });
      return;
    }

    if (formData.deliveryMethods.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one delivery method',
        variant: 'destructive'
      });
      return;
    }

    if (formData.deliveryMethods.includes('webhook') && !formData.webhookUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a webhook URL',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        userId,
        tokenSymbol: formData.tokenSymbol || undefined,
        tokenAddress: formData.tokenAddress || undefined,
        poolAddress: formData.poolAddress || undefined,
        webhookUrl: formData.webhookUrl || undefined
      };

      const url = editingAlert 
        ? `/api/alerts/${editingAlert.id}`
        : '/api/alerts';
      
      const method = editingAlert ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save alert');
      }

      const alert = await response.json();

      if (editingAlert) {
        onAlertUpdated(alert);
      } else {
        onAlertCreated(alert);
      }

      onClose();
    } catch (error) {
      console.error('Error saving alert:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save alert',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAlert ? 'Edit Alert' : 'Create New Alert'}</DialogTitle>
          <DialogDescription>
            Set up custom alerts to stay informed about important market events
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Alert Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Alert Name</Label>
            <Input
              id="name"
              placeholder="e.g., ETH Price Above $2000"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Alert Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Alert Type</Label>
            <Select value={formData.type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {alertTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditionsByType[formData.type].map(condition => (
                  <SelectItem key={condition.value} value={condition.value}>
                    {condition.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Value */}
          <div className="space-y-2">
            <Label htmlFor="targetValue">
              Target Value
              {(formData.type === 'volume_spike' || formData.condition.includes('by')) && ' (%)'}
            </Label>
            <Input
              id="targetValue"
              type="number"
              step="any"
              placeholder={formData.type === 'price_cross' ? '2000' : '50'}
              value={formData.targetValue}
              onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
            />
          </div>

          {/* Token/Pool Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tokenSymbol">Token Symbol (Optional)</Label>
              <Input
                id="tokenSymbol"
                placeholder="ETH"
                value={formData.tokenSymbol}
                onChange={(e) => setFormData({ ...formData, tokenSymbol: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tokenAddress">Token Address (Optional)</Label>
              <Input
                id="tokenAddress"
                placeholder="0x..."
                value={formData.tokenAddress}
                onChange={(e) => setFormData({ ...formData, tokenAddress: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poolAddress">Pool Address (Optional)</Label>
            <Input
              id="poolAddress"
              placeholder="0x..."
              value={formData.poolAddress}
              onChange={(e) => setFormData({ ...formData, poolAddress: e.target.value })}
            />
          </div>

          {/* Delivery Methods */}
          <div className="space-y-2">
            <Label>Delivery Methods</Label>
            <div className="space-y-2">
              {deliveryOptions.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.value}
                    checked={formData.deliveryMethods.includes(option.value)}
                    onCheckedChange={() => handleDeliveryMethodToggle(option.value)}
                  />
                  <label
                    htmlFor={option.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook URL */}
          {formData.deliveryMethods.includes('webhook') && (
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://your-webhook-url.com/alerts"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : editingAlert ? 'Update Alert' : 'Create Alert'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
