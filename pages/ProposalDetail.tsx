import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccount, useSignMessage } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, 
  ThumbsUp, ThumbsDown, MessageSquare, Calendar, Code,
  ExternalLink, Users, TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Proposal {
  id: string;
  title: string;
  description: string;
  proposalType: string;
  targetContract: string;
  calldata: string;
  value: string;
  proposer: string;
  snapshot: number;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  status: 'active' | 'queued' | 'executed' | 'defeated' | 'cancelled';
  createdAt: number;
  votingEndsAt: number;
  queuedAt?: number;
  executedAt?: number;
  timelockEta?: number;
}

interface Vote {
  proposalId: string;
  voter: string;
  support: 'for' | 'against' | 'abstain';
  votingPower: string;
  timestamp: number;
}

interface Comment {
  id: string;
  proposalId: string;
  author: string;
  content: string;
  timestamp: number;
  likes: number;
}

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [voteSupport, setVoteSupport] = useState<'for' | 'against' | 'abstain'>('for');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProposalDetails();
    }
  }, [id]);

  const fetchProposalDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/governance/proposals/${id}`);
      const data = await response.json();
      setProposal(data.proposal);
      setVotes(data.votes);
      setComments(data.comments);
    } catch (error) {
      console.error('Failed to fetch proposal:', error);
      toast({
        title: 'Error',
        description: 'Failed to load proposal details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!address || !proposal) return;

    try {
      setSubmitting(true);

      // Mock voting power (in production, fetch from contract)
      const votingPower = parseEther('1000').toString();

      // Create signature message
      const message = `Vote ${voteSupport} on proposal ${proposal.id}`;
      const signature = await signMessageAsync({ message });

      const response = await fetch(`/api/governance/proposals/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: id,
          support: voteSupport,
          voterAddress: address,
          votingPower,
          signature
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to vote');
      }

      toast({
        title: 'Vote Recorded',
        description: `Your ${voteSupport} vote has been recorded successfully`
      });

      setShowVoteModal(false);
      fetchProposalDetails();
    } catch (error: any) {
      console.error('Vote failed:', error);
      toast({
        title: 'Vote Failed',
        description: error.message || 'Failed to record vote',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async () => {
    if (!address || !commentText.trim()) return;

    try {
      setSubmitting(true);

      const message = `Comment on proposal ${id}: ${commentText}`;
      const signature = await signMessageAsync({ message });

      const response = await fetch(`/api/governance/proposals/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: id,
          content: commentText,
          authorAddress: address,
          signature
        })
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      toast({
        title: 'Comment Posted',
        description: 'Your comment has been added'
      });

      setCommentText('');
      fetchProposalDetails();
    } catch (error) {
      console.error('Comment failed:', error);
      toast({
        title: 'Failed',
        description: 'Failed to post comment',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueue = async () => {
    try {
      const response = await fetch(`/api/governance/proposals/${id}/queue`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      toast({
        title: 'Proposal Queued',
        description: 'Proposal has been queued for execution'
      });

      fetchProposalDetails();
    } catch (error: any) {
      toast({
        title: 'Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleExecute = async () => {
    try {
      const response = await fetch(`/api/governance/proposals/${id}/execute`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      toast({
        title: 'Proposal Executed',
        description: 'Proposal has been executed successfully'
      });

      fetchProposalDetails();
    } catch (error: any) {
      toast({
        title: 'Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading proposal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-20">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold mb-2">Proposal Not Found</h2>
            <button
              onClick={() => navigate('/governance')}
              className="text-blue-500 hover:text-blue-400"
            >
              Back to Governance
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalVotes = BigInt(proposal.votesFor) + BigInt(proposal.votesAgainst) + BigInt(proposal.votesAbstain);
  const forPercentage = totalVotes > 0 ? Number((BigInt(proposal.votesFor) * BigInt(100)) / totalVotes) : 0;
  const againstPercentage = totalVotes > 0 ? Number((BigInt(proposal.votesAgainst) * BigInt(100)) / totalVotes) : 0;
  const abstainPercentage = totalVotes > 0 ? Number((BigInt(proposal.votesAbstain) * BigInt(100)) / totalVotes) : 0;

  const userVote = votes.find(v => v.voter.toLowerCase() === address?.toLowerCase());
  const canVote = proposal.status === 'active' && !userVote && isConnected;
  const canQueue = proposal.status === 'active' && Date.now() > proposal.votingEndsAt;
  const canExecute = proposal.status === 'queued' && proposal.timelockEta && Date.now() >= proposal.timelockEta;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/governance')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Governance
        </button>

        {/* Proposal Header */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  proposal.status === 'active' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                  proposal.status === 'queued' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                  proposal.status === 'executed' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                  'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  {proposal.status.toUpperCase()}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  {proposal.proposalType.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <h1 className="text-3xl font-bold mb-4">{proposal.title}</h1>
              <p className="text-gray-300 whitespace-pre-wrap">{proposal.description}</p>
            </div>
          </div>

          {/* Proposal Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
            <div>
              <div className="text-sm text-gray-400 mb-1">Proposer</div>
              <div className="font-mono text-sm">
                {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Snapshot Block</div>
              <div className="font-medium">{proposal.snapshot.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Created</div>
              <div className="font-medium">
                {new Date(proposal.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Voting Ends</div>
              <div className="font-medium">
                {new Date(proposal.votingEndsAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Voting Results */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6">Voting Results</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-green-500" />
                  <span className="font-medium">For</span>
                </div>
                <span className="text-green-500 font-bold">
                  {formatEther(BigInt(proposal.votesFor))} ({forPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3">
                <div
                  className="bg-green-500 h-full rounded-full transition-all"
                  style={{ width: `${forPercentage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="w-5 h-5 text-red-500" />
                  <span className="font-medium">Against</span>
                </div>
                <span className="text-red-500 font-bold">
                  {formatEther(BigInt(proposal.votesAgainst))} ({againstPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3">
                <div
                  className="bg-red-500 h-full rounded-full transition-all"
                  style={{ width: `${againstPercentage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">Abstain</span>
                </div>
                <span className="text-gray-500 font-bold">
                  {formatEther(BigInt(proposal.votesAbstain))} ({abstainPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3">
                <div
                  className="bg-gray-500 h-full rounded-full transition-all"
                  style={{ width: `${abstainPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-gray-400">
              <Users className="w-5 h-5" />
              <span>{votes.length} voters</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <TrendingUp className="w-5 h-5" />
              <span>{formatEther(totalVotes)} total votes</span>
            </div>
          </div>

          {/* Vote Actions */}
          {canVote && (
            <button
              onClick={() => setShowVoteModal(true)}
              className="w-full mt-6 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors"
            >
              Cast Your Vote
            </button>
          )}

          {userVote && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-blue-500">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  You voted {userVote.support.toUpperCase()} with {formatEther(BigInt(userVote.votingPower))} votes
                </span>
              </div>
            </div>
          )}

          {canQueue && (
            <button
              onClick={handleQueue}
              className="w-full mt-6 bg-yellow-500 hover:bg-yellow-600 text-black py-3 rounded-lg font-medium transition-colors"
            >
              Queue for Execution
            </button>
          )}

          {canExecute && (
            <button
              onClick={handleExecute}
              className="w-full mt-6 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium transition-colors"
            >
              Execute Proposal
            </button>
          )}
        </div>

        {/* Technical Details */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Code className="w-6 h-6" />
            Technical Details
          </h2>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-400 mb-2">Target Contract</div>
              <div className="font-mono text-sm bg-black/50 p-3 rounded border border-white/10">
                {proposal.targetContract}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400 mb-2">Calldata</div>
              <div className="font-mono text-sm bg-black/50 p-3 rounded border border-white/10 break-all">
                {proposal.calldata}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400 mb-2">Value (ETH)</div>
              <div className="font-mono text-sm bg-black/50 p-3 rounded border border-white/10">
                {formatEther(BigInt(proposal.value))}
              </div>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Discussion ({comments.length})
          </h2>

          {isConnected && (
            <div className="mb-6">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Share your thoughts on this proposal..."
                className="w-full bg-black/50 border border-white/10 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || submitting}
                className="mt-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          )}

          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No comments yet. Be the first to share your thoughts!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-black/50 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-sm text-gray-400">
                      {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(comment.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Vote Modal */}
        {showVoteModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-white/10 rounded-lg p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold mb-6">Cast Your Vote</h3>
              
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setVoteSupport('for')}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    voteSupport === 'for'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-white/10 hover:border-green-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ThumbsUp className="w-6 h-6 text-green-500" />
                    <div className="text-left">
                      <div className="font-bold">Vote For</div>
                      <div className="text-sm text-gray-400">Support this proposal</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setVoteSupport('against')}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    voteSupport === 'against'
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-white/10 hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ThumbsDown className="w-6 h-6 text-red-500" />
                    <div className="text-left">
                      <div className="font-bold">Vote Against</div>
                      <div className="text-sm text-gray-400">Oppose this proposal</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setVoteSupport('abstain')}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    voteSupport === 'abstain'
                      ? 'border-gray-500 bg-gray-500/10'
                      : 'border-white/10 hover:border-gray-500/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-gray-500" />
                    <div className="text-left">
                      <div className="font-bold">Abstain</div>
                      <div className="text-sm text-gray-400">Count towards quorum only</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowVoteModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVote}
                  disabled={submitting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Confirm Vote'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
