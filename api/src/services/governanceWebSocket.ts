import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface VoteUpdate {
  proposalId: string;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  totalVotes: number;
  forPercentage: number;
}

interface ProposalUpdate {
  proposalId: string;
  status: 'active' | 'queued' | 'executed' | 'defeated' | 'cancelled';
  timestamp: number;
}

class GovernanceWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocket>> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/governance' });

    this.wss.on('connection', (ws: WebSocket, _req) => {
      console.log('New governance WebSocket connection');

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'subscribe' && data.proposalId) {
            this.subscribeToProposal(ws, data.proposalId);
          } else if (data.type === 'unsubscribe' && data.proposalId) {
            this.unsubscribeFromProposal(ws, data.proposalId);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Governance WebSocket connection closed');
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('Governance WebSocket error:', error);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to governance updates'
      }));
    });

    console.log('✓ Governance WebSocket server initialized');
  }

  private subscribeToProposal(ws: WebSocket, proposalId: string) {
    if (!this.clients.has(proposalId)) {
      this.clients.set(proposalId, new Set());
    }
    
    this.clients.get(proposalId)!.add(ws);
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      proposalId,
      message: `Subscribed to proposal ${proposalId}`
    }));
  }

  private unsubscribeFromProposal(ws: WebSocket, proposalId: string) {
    const clients = this.clients.get(proposalId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.clients.delete(proposalId);
      }
    }
  }

  private removeClient(ws: WebSocket) {
    this.clients.forEach((clients, proposalId) => {
      clients.delete(ws);
      if (clients.size === 0) {
        this.clients.delete(proposalId);
      }
    });
  }

  broadcastVoteUpdate(update: VoteUpdate) {
    const clients = this.clients.get(update.proposalId);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'vote_update',
      data: update,
      timestamp: Date.now()
    });

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted vote update for proposal ${update.proposalId} to ${clients.size} clients`);
  }

  broadcastProposalUpdate(update: ProposalUpdate) {
    const clients = this.clients.get(update.proposalId);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'proposal_update',
      data: update,
      timestamp: Date.now()
    });

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted proposal update for ${update.proposalId} to ${clients.size} clients`);
  }

  broadcastNewProposal(proposalId: string, proposal: any) {
    // Broadcast to all connected clients (not proposal-specific)
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'new_proposal',
      data: {
        proposalId,
        proposal
      },
      timestamp: Date.now()
    });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted new proposal ${proposalId} to ${this.wss.clients.size} clients`);
  }

  broadcastCommentUpdate(proposalId: string, comment: any) {
    const clients = this.clients.get(proposalId);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify({
      type: 'new_comment',
      data: {
        proposalId,
        comment
      },
      timestamp: Date.now()
    });

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    console.log(`Broadcasted new comment for proposal ${proposalId} to ${clients.size} clients`);
  }

  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      subscribedProposals: this.clients.size,
      subscriptions: Array.from(this.clients.entries()).map(([proposalId, clients]) => ({
        proposalId,
        subscribers: clients.size
      }))
    };
  }
}

export const governanceWS = new GovernanceWebSocketService();
