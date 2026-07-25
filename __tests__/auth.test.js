const request = require('supertest');
const app = require('../server/app');
const db = require('../server/database');
const jwt = require('jsonwebtoken');

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE /api/account', () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'your_secret_key_here');

    it('should delete account successfully for authenticated user', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/account').set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Compte supprimé avec succès.');
      expect(db.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = $1', [1]);
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request(app).delete('/api/account');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/preferences', () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'your_secret_key_here');

    it('should return default preferences if none found in DB', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        random_mode: false,
        expert_mode: false,
        board_theme: 'classic',
        pieces_theme: 'cburnett',
      });
    });

    it('should return user preferences if present in DB', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { random_mode: true, expert_mode: true, board_theme: 'blue', pieces_theme: 'alpha' },
        ],
      });
      const res = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        random_mode: true,
        expert_mode: true,
        board_theme: 'blue',
        pieces_theme: 'alpha',
      });
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get('/api/preferences');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/preferences', () => {
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'your_secret_key_here');

    it('should save preferences successfully', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ random_mode: true, expert_mode: true, board_theme: 'blue', pieces_theme: 'alpha' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        random_mode: true,
        expert_mode: true,
        board_theme: 'blue',
        pieces_theme: 'alpha',
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_preferences'),
        [1, true, true, 'blue', 'alpha']
      );
    });

    it('should return 400 if random_mode parameter is missing', async () => {
      const res = await request(app)
        .post('/api/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Paramètre random_mode manquant.');
    });

    it('should return 401 if unauthorized', async () => {
      const res = await request(app).post('/api/preferences').send({ random_mode: true });
      expect(res.statusCode).toBe(401);
    });
  });
});
