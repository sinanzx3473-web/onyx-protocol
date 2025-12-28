import { useState } from 'react';
import { useAccount, useSignMessage, useBlockNumber } from 'wagmi';
import { X, AlertCircle, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseEther } from 'viem';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PROPOSAL_TYPES = [
  { value: 'fee_change', label: 'Fee Change', description: 'Modify protocol fee parameters' },
  { value: 'pool_addition', label: 'Pool Addition', description: 'Add a new liquidity pool' },
  { value: 'reward_distribution', label: 'Reward Distribution', description: 'Distribute protocol rewards' },
  { value: 'protocol_upgrade', label: 'Protocol Upgrade', description: 'Upgrade protocol contracts' },
  { value: 'borrower_approval', label: 'Borrower Approval', description: 'Approve flash loan borrower' },
  { value: 'parameter_change', label: 'Parameter Change', description: 'Change protocol parameters' }
];

export default function CreateProposalModal({ isOpen, onClose, onSuccess }: CreateProposalModalProps) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: blockNumber } = useBlockNumber();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    proposalType: 'fee_change',
    targetContract: '',
    calldata: '0x',
    value: '0'
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.title.length < 10) {
      newErrors.title = 'Title must be at least 10 characters';
    }

    if (formData.description.length < 50) {
      newErrors.description = 'Description must be at least 50 characters';
    }

    if (!formData.targetContract.match(/^0x[a-fA-F0-9]{40}$/)) {
      newErrors.targetContract = 'Invalid contract address';
    }

    if (!formData.calldata.match(/^0x[a-fA-F0-9]*$/)) {
      newErrors.calldata = 'Invalid calldata format';
    }

    if (!formData.value.match(/^\d+$/)) {
      newErrors.value = 'Invalid value';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !address) return;

    try {
      setSubmitting(true);

      // Mock token balance check (in production, fetch from contract)
      const tokenBalance = parseEther('150000').toString(); // 150k tokens
      const snapshot = Number(blockNumber) || 0;

      const response = await fetch('/api/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          proposerAddress: address,
          proposerTokenBalance: tokenBalance,
          snapshot
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create proposal');
      }

      const data = await response.json();

      toast({
        title: 'Proposal Created',
        description: `Proposal "${formData.title}" has been created successfully`
      });

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Failed to create proposal:', error);
      toast({
        title: 'Failed',
        description: error.message || 'Failed to create proposal',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      proposalType: 'fee_change',
      targetContract: '',
      calldata: '0x',
      value: '0'
    });
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-white/10 rounded-lg p-8 max-w-2xl w-full my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Create Proposal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">Proposal Requirements</p>
              <ul className="list-disc list-inside space-y-1 text-blue-400">
                <li>Minimum 100,000 governance tokens required</li>
                <li>Voting period: 3 days</li>
                <li>Execution delay: 2 days after approval</li>
                <li>Quorum: 1,000,000 tokens (10% of supply)</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Proposal Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Reduce protocol fee to 0.25%"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={200}
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">
              {formData.title.length}/200 characters
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide a detailed explanation of your proposal, including rationale and expected impact..."
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
              maxLength={5000}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">
              {formData.description.length}/5000 characters
            </p>
          </div>

          {/* Proposal Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Proposal Type *
            </label>
            <select
              value={formData.proposalType}
              onChange={(e) => setFormData({ ...formData, proposalType: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PROPOSAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Technical Details */}
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold">Technical Details</h3>
            </div>

            {/* Target Contract */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Target Contract Address *
              </label>
              <input
                type="text"
                value={formData.targetContract}
                onChange={(e) => setFormData({ ...formData, targetContract: e.target.value })}
                placeholder="0x..."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.targetContract && (
                <p className="text-red-500 text-sm mt-1">{errors.targetContract}</p>
              )}
            </div>

            {/* Calldata */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Calldata *
              </label>
              <textarea
                value={formData.calldata}
                onChange={(e) => setFormData({ ...formData, calldata: e.target.value })}
                placeholder="0x..."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              />
              {errors.calldata && (
                <p className="text-red-500 text-sm mt-1">{errors.calldata}</p>
              )}
              <p className="text-gray-500 text-sm mt-1">
                Encoded function call data for the proposal
              </p>
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Value (wei) *
              </label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="0"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.value && (
                <p className="text-red-500 text-sm mt-1">{errors.value}</p>
              )}
              <p className="text-gray-500 text-sm mt-1">
                Amount of ETH to send with the transaction (usually 0)
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
