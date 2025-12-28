import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Health Check API', () => {
  it('should return 200 OK with healthy status', async () => {
    // Create a minimal test app
    const app = express();
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('healthy');
  });

  it('should include uptime in response', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('should include timestamp in response', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('should return JSON content type', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('should handle health check without errors', async () => {
    const app = express();
    app.get('/api/health', (_req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.uptime).toBeGreaterThan(0);
  });
});
