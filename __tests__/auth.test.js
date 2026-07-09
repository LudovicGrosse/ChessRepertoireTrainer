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
});
