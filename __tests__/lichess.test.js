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
    it('should return oauth url without authentication', async () => {
      const res = await request(app).get('/api/lichess/login-url');
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

    it('should handle oauth flow (user creation)', async () => {
      const state = jwt.sign({ codeVerifier: 'verifier' }, SECRET_KEY);

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

      // Select returns no user (creation)
      db.query.mockResolvedValueOnce({ rows: [] });
      // Insert returns new user
      db.query.mockResolvedValueOnce({ rows: [{ id: 10, username: 'lichess_user' }] });

      const res = await request(app).get(`/api/lichess/callback?code=auth_code&state=${state}`);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('?token=');
      expect(res.headers.location).toContain('username=lichess_user');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should handle oauth flow (user exists)', async () => {
      const state = jwt.sign({ codeVerifier: 'verifier' }, SECRET_KEY);

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

      // Select returns user
      db.query.mockResolvedValueOnce({ rows: [{ id: 10, username: 'lichess_user' }] });
      // Update tokens
      db.query.mockResolvedValueOnce({});

      const res = await request(app).get(`/api/lichess/callback?code=auth_code&state=${state}`);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('?token=');
      expect(res.headers.location).toContain('username=lichess_user');
      expect(db.query).toHaveBeenCalledTimes(2);
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
