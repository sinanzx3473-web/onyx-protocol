import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify for server-side sanitization
const { window: domWindow } = new JSDOM('');
const purify = DOMPurify(domWindow);

const router: Router = Router();

// Validation schemas
const createProposalSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(5000),
  proposalType: z.enum(['fee_change', 'pool_addition', 'reward_distribution', 'protocol_upgrade', 'borrower_approval', 'parameter_change']),
  targetContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  calldata: z.string().regex(/^0x[a-fA-F0-9]*$/),
  value: z.string().regex(/^\d+$/),
  proposerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  proposerTokenBalance: z.string().regex(/^\d+$/),
  snapshot: z.number().int().positive()
});

const voteSchema = z.object({
  proposalId: z.string(),
  support: z.enum(['for', 'against', 'abstain']),
  voterAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  votingPower: z.string().regex(/^\d+$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/)
});

const commentSchema = z.object({
  proposalId: z.string(),
  content: z.string().min(1).max(2000),
  authorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/)
});

// In-memory storage (replace with database in production)
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
  signature: string;
  timestamp: number;
}

interface Comment {
  id: string;
  proposalId: string;
  author: string;
  content: string;
  signature: string;
  timestamp: number;
  likes: number;
}

const proposals = new Map<string, Proposal>();
const votes = new Map<string, Vote[]>();
const comments = new Map<string, Comment[]>();

// Governance parameters
const GOVERNANCE_CONFIG = {
  PROPOSAL_THRESHOLD: '100000000000000000000000', // 100,000 tokens
  VOTING_PERIOD: 3 * 24 * 60 * 60 * 1000, // 3 days in ms
  TIMELOCK_DELAY: 2 * 24 * 60 * 60 * 1000, // 2 days in ms
  QUORUM: '1000000000000000000000000', // 1,000,000 tokens (10% of 10M supply)
  VOTE_THRESHOLD: 50, // 50% majority
  MIN_VOTING_POWER: '10000000000000000000000' // 10,000 tokens minimum to create proposals
};

/**
 * GET /api/governance/config
 * Get governance configuration parameters
 */
router.get('/config', (_req: Request, res: Response): void => {
  res.json({
    proposalThreshold: GOVERNANCE_CONFIG.PROPOSAL_THRESHOLD,
    votingPeriod: GOVERNANCE_CONFIG.VOTING_PERIOD,
    timelockDelay: GOVERNANCE_CONFIG.TIMELOCK_DELAY,
    quorum: GOVERNANCE_CONFIG.QUORUM,
    voteThreshold: GOVERNANCE_CONFIG.VOTE_THRESHOLD
  });
});

/**
 * GET /api/governance/proposals
 * Get all proposals with optional filtering
 */
router.get('/proposals', (req: Request, res: Response): void => {
  const { status, proposer } = req.query;
  
  let filteredProposals = Array.from(proposals.values());
  
  if (status) {
    filteredProposals = filteredProposals.filter(p => p.status === status);
  }
  
  if (proposer) {
    filteredProposals = filteredProposals.filter(p => 
      p.proposer.toLowerCase() === (proposer as string).toLowerCase()
    );
  }
  
  // Sort by creation date (newest first)
  filteredProposals.sort((a, b) => b.createdAt - a.createdAt);
  
  res.json({
    proposals: filteredProposals,
    total: filteredProposals.length
  });
});

/**
 * GET /api/governance/proposals/:id
 * Get proposal details with votes and comments
 */
router.get('/proposals/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const proposal = proposals.get(id);
  
  if (!proposal) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  
  const proposalVotes = votes.get(id) || [];
  const proposalComments = comments.get(id) || [];
  
  res.json({
    proposal,
    votes: proposalVotes,
    comments: proposalComments,
    voteCount: {
      for: proposalVotes.filter(v => v.support === 'for').length,
      against: proposalVotes.filter(v => v.support === 'against').length,
      abstain: proposalVotes.filter(v => v.support === 'abstain').length
    }
  });
});

/**
 * POST /api/governance/proposals
 * Create a new proposal
 */
router.post('/proposals', validateRequest(createProposalSchema), (req: Request, res: Response): void => {
  const data = req.body;
  
  // Validate proposer has enough tokens
  const proposerBalance = BigInt(data.proposerTokenBalance);
  const threshold = BigInt(GOVERNANCE_CONFIG.PROPOSAL_THRESHOLD);
  const minVotingPower = BigInt(GOVERNANCE_CONFIG.MIN_VOTING_POWER);
  
  if (proposerBalance < threshold) {
    res.status(403).json({
      error: 'Insufficient governance tokens',
      required: GOVERNANCE_CONFIG.PROPOSAL_THRESHOLD,
      balance: data.proposerTokenBalance
    });
    return;
  }
  
  // Additional voting power check (10,000 tokens minimum)
  if (proposerBalance < minVotingPower) {
    res.status(403).json({
      error: 'Insufficient voting power to create proposal',
      required: GOVERNANCE_CONFIG.MIN_VOTING_POWER,
      balance: data.proposerTokenBalance
    });
    return;
  }
  
  // Sanitize title and description to prevent XSS
  const sanitizedTitle = purify.sanitize(data.title, { ALLOWED_TAGS: [] }).trim();
  const sanitizedDescription = purify.sanitize(data.description, { ALLOWED_TAGS: [] }).trim();
  
  // Enforce title length limit (200 chars)
  if (sanitizedTitle.length > 200) {
    res.status(400).json({
      error: 'Title exceeds maximum length of 200 characters'
    });
    return;
  }
  
  // Create proposal
  const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  const proposal: Proposal = {
    id: proposalId,
    title: sanitizedTitle,
    description: sanitizedDescription,
    proposalType: data.proposalType,
    targetContract: data.targetContract,
    calldata: data.calldata,
    value: data.value,
    proposer: data.proposerAddress,
    snapshot: data.snapshot,
    votesFor: '0',
    votesAgainst: '0',
    votesAbstain: '0',
    status: 'active',
    createdAt: now,
    votingEndsAt: now + GOVERNANCE_CONFIG.VOTING_PERIOD
  };
  
  proposals.set(proposalId, proposal);
  votes.set(proposalId, []);
  comments.set(proposalId, []);
  
  res.status(201).json({
    proposalId,
    proposal,
    message: 'Proposal created successfully'
  });
});

/**
 * POST /api/governance/proposals/:id/vote
 * Cast a vote on a proposal
 */
router.post('/proposals/:id/vote', validateRequest(voteSchema), (req: Request, res: Response): void => {
  const { id } = req.params;
  const data = req.body;
  
  const proposal = proposals.get(id);
  
  if (!proposal) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  
  // Check if voting period is active
  const now = Date.now();
  if (now > proposal.votingEndsAt) {
    res.status(400).json({ error: 'Voting period has ended' });
    return;
  }
  
  if (proposal.status !== 'active') {
    res.status(400).json({ error: 'Proposal is not active' });
    return;
  }
  
  // Check if user already voted
  const proposalVotes = votes.get(id) || [];
  const existingVote = proposalVotes.find(v => 
    v.voter.toLowerCase() === data.voterAddress.toLowerCase()
  );
  
  if (existingVote) {
    res.status(400).json({ error: 'Already voted on this proposal' });
    return;
  }
  
  // Record vote
  const vote: Vote = {
    proposalId: id,
    voter: data.voterAddress,
    support: data.support,
    votingPower: data.votingPower,
    signature: data.signature,
    timestamp: now
  };
  
  proposalVotes.push(vote);
  votes.set(id, proposalVotes);
  
  // Update vote tallies
  const votingPower = BigInt(data.votingPower);
  
  if (data.support === 'for') {
    proposal.votesFor = (BigInt(proposal.votesFor) + votingPower).toString();
  } else if (data.support === 'against') {
    proposal.votesAgainst = (BigInt(proposal.votesAgainst) + votingPower).toString();
  } else {
    proposal.votesAbstain = (BigInt(proposal.votesAbstain) + votingPower).toString();
  }
  
  proposals.set(id, proposal);
  
  res.json({
    message: 'Vote recorded successfully',
    vote,
    currentTally: {
      for: proposal.votesFor,
      against: proposal.votesAgainst,
      abstain: proposal.votesAbstain
    }
  });
});

/**
 * POST /api/governance/proposals/:id/comments
 * Add a comment to a proposal
 */
router.post('/proposals/:id/comments', validateRequest(commentSchema), (req: Request, res: Response): void => {
  const { id } = req.params;
  const data = req.body;
  
  const proposal = proposals.get(id);
  
  if (!proposal) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  
  // Sanitize comment content to prevent XSS
  const sanitizedContent = purify.sanitize(data.content, { ALLOWED_TAGS: [] }).trim();
  
  const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const comment: Comment = {
    id: commentId,
    proposalId: id,
    author: data.authorAddress,
    content: sanitizedContent,
    signature: data.signature,
    timestamp: Date.now(),
    likes: 0
  };
  
  const proposalComments = comments.get(id) || [];
  proposalComments.push(comment);
  comments.set(id, proposalComments);
  
  res.status(201).json({
    commentId,
    comment,
    message: 'Comment added successfully'
  });
});

/**
 * POST /api/governance/proposals/:id/queue
 * Queue a successful proposal for execution
 */
router.post('/proposals/:id/queue', (req: Request, res: Response): void => {
  const { id } = req.params;
  const proposal = proposals.get(id);
  
  if (!proposal) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  
  // Check if voting period has ended
  const now = Date.now();
  if (now <= proposal.votingEndsAt) {
    res.status(400).json({ error: 'Voting period still active' });
    return;
  }
  
  if (proposal.status !== 'active') {
    res.status(400).json({ error: 'Proposal is not active' });
    return;
  }
  
  // Check if proposal passed
  const totalVotes = BigInt(proposal.votesFor) + BigInt(proposal.votesAgainst);
  const quorum = BigInt(GOVERNANCE_CONFIG.QUORUM);
  
  if (totalVotes < quorum) {
    proposal.status = 'defeated';
    proposals.set(id, proposal);
    res.status(400).json({ error: 'Quorum not reached' });
    return;
  }
  
  const forPercentage = Number(BigInt(proposal.votesFor) * BigInt(100) / totalVotes);
  
  if (forPercentage < GOVERNANCE_CONFIG.VOTE_THRESHOLD) {
    proposal.status = 'defeated';
    proposals.set(id, proposal);
    res.status(400).json({ error: 'Proposal did not pass' });
    return;
  }
  
  // Queue proposal
  proposal.status = 'queued';
  proposal.queuedAt = now;
  proposal.timelockEta = now + GOVERNANCE_CONFIG.TIMELOCK_DELAY;
  proposals.set(id, proposal);
  
  res.json({
    message: 'Proposal queued for execution',
    proposal,
    eta: proposal.timelockEta
  });
});

/**
 * POST /api/governance/proposals/:id/execute
 * Execute a queued proposal
 */
router.post('/proposals/:id/execute', (req: Request, res: Response): void => {
  const { id } = req.params;
  const proposal = proposals.get(id);
  
  if (!proposal) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  
  if (proposal.status !== 'queued') {
    res.status(400).json({ error: 'Proposal is not queued' });
    return;
  }
  
  // Check if timelock delay has passed
  const now = Date.now();
  if (!proposal.timelockEta || now < proposal.timelockEta) {
    res.status(400).json({
      error: 'Timelock delay not passed',
      eta: proposal.timelockEta
    });
    return;
  }
  
  // Mark as executed (actual execution would happen on-chain)
  proposal.status = 'executed';
  proposal.executedAt = now;
  proposals.set(id, proposal);
  
  res.json({
    message: 'Proposal executed successfully',
    proposal
  });
});

/**
 * POST /api/governance/proposals/:id/cancel
 * Cancel a proposal (only by proposer or admin)
 */
router.post('/proposals/:id/cancel', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { canceller } = req.body;
  
  const proposal = proposals.get(id);
  
  if (!proposal) {
    res.status(404).json({ error: 'Proposal not found' });
    return;
  }
  
  if (proposal.status === 'executed') {
    res.status(400).json({ error: 'Cannot cancel executed proposal' });
    return;
  }
  
  // Verify canceller is proposer (in production, also check admin role)
  if (canceller.toLowerCase() !== proposal.proposer.toLowerCase()) {
    res.status(403).json({ error: 'Only proposer can cancel' });
    return;
  }
  
  proposal.status = 'cancelled';
  proposals.set(id, proposal);
  
  res.json({
    message: 'Proposal cancelled',
    proposal
  });
});

/**
 * GET /api/governance/stats
 * Get governance statistics
 */
router.get('/stats', (_req: Request, res: Response): void => {
  const allProposals = Array.from(proposals.values());
  const allVotes = Array.from(votes.values()).flat();
  
  const uniqueVoters = new Set(allVotes.map(v => v.voter.toLowerCase()));
  
  res.json({
    totalProposals: allProposals.length,
    activeProposals: allProposals.filter(p => p.status === 'active').length,
    queuedProposals: allProposals.filter(p => p.status === 'queued').length,
    executedProposals: allProposals.filter(p => p.status === 'executed').length,
    defeatedProposals: allProposals.filter(p => p.status === 'defeated').length,
    totalVotes: allVotes.length,
    uniqueVoters: uniqueVoters.size,
    participationRate: allProposals.length > 0 
      ? ((uniqueVoters.size / 10000) * 100).toFixed(2) // Assuming 10k token holders
      : '0.00'
  });
});

export default router;
export { router as governanceRouter };
