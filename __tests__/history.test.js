const request = require('supertest');
const app = require('../server/app');
const db = require('../server/database');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const validToken = jwt.sign({ id: 1, username: 'testuser' }, SECRET_KEY, { expiresIn: '1d' });

describe('History Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/history', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).post('/api/history').send({
        repertoire_title: 'My Repo',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should save history and return 201', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/history')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          repertoire_title: 'My Repertoire',
          chapter_title: 'Chapter 1',
          repertoire_id: 'study123',
          color: 'white',
          moves_learned: 10,
          total_moves: 20,
          errors: 2,
          total_chapters: 5,
          is_revision: false,
        });

      expect(res.statusCode).toBe(201);
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('GET /api/history', () => {
    it('should return user history', async () => {
      const mockHistory = [
        { id: 1, user_id: 1, repertoire_title: 'Repo 1' },
        { id: 2, user_id: 1, repertoire_title: 'Repo 2' },
      ];
      db.query.mockResolvedValueOnce({ rows: mockHistory });

      const res = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockHistory);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM history WHERE user_id = $1 ORDER BY date DESC',
        [1]
      );
    });
  });
});
