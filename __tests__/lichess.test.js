const request = require('supertest');
const app = require('../server/app');
const db = require('../server/database');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const validToken = jwt.sign({ id: 1, username: 'testuser' }, SECRET_KEY, { expiresIn: '1d' });

describe('Lichess Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('GET /api/lichess/login-url', () => {
    it('should return oauth url', async () => {
      const res = await request(app)
        .get('/api/lichess/login-url')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('url');
      expect(res.body.url).toContain('https://lichess.org/oauth');
    });
  });

  describe('GET /api/lichess/callback', () => {
    it('should redirect with missing params error', async () => {
      const res = await request(app).get('/api/lichess/callback');
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('missing_params');
    });

    it('should redirect with invalid state error', async () => {
      const res = await request(app).get('/api/lichess/callback?code=123&state=invalid');
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('invalid_state');
    });

    it('should handle oauth flow', async () => {
      const state = jwt.sign({ userId: 1, codeVerifier: 'verifier' }, SECRET_KEY);

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'token123',
          refresh_token: 'refresh123',
          expires_in: 3600,
        }),
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ username: 'lichess_user' }),
      });
      db.query.mockResolvedValueOnce({});

      const res = await request(app).get(`/api/lichess/callback?code=auth_code&state=${state}`);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('lichess_success=1');
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('GET /api/lichess/status', () => {
    it('should return connection status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ lichess_username: 'test' }] });
      const res = await request(app)
        .get('/api/lichess/status')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.isConnected).toBe(true);
    });
    it('should return disconnected if no username', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get('/api/lichess/status')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.isConnected).toBe(false);
    });
  });

  describe('DELETE /api/lichess/disconnect', () => {
    it('should disconnect lichess account', async () => {
      db.query.mockResolvedValueOnce({});
      const res = await request(app)
        .delete('/api/lichess/disconnect')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/lichess/study/:id.pgn', () => {
    it('should fetch pgn via proxy', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ lichess_access_token: 'token' }] });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'pgn content',
      });

      const res = await request(app)
        .get('/api/lichess/study/123.pgn')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('pgn content');
    });

    it('should handle fetch failure', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const res = await request(app)
        .get('/api/lichess/study/123.pgn')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(401);
    });
  });
});
