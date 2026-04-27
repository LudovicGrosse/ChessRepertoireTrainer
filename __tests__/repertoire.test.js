const request = require('supertest');
const app = require('../server/app');
const db = require('../server/database');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const validToken = jwt.sign({ id: 1, username: 'testuser' }, SECRET_KEY, { expiresIn: '1d' });

describe('Repertoire Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/repertoires', () => {
    it('should return 400 if fields are missing', async () => {
      const res = await request(app)
        .post('/api/repertoires')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});
      expect(res.statusCode).toBe(400);
    });

    it('should save repertoire and return 201', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/api/repertoires')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          repertoire_id: 'test_rep',
          title: 'Test Title',
          color: 'white',
          chapters: [{ id: 'chap1', title: 'Chapter 1', white_moves: 10, black_moves: 10 }],
        });

      expect(res.statusCode).toBe(201);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest.fn().mockRejectedValueOnce(new Error('DB Error')),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/api/repertoires')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          repertoire_id: 'test_rep',
          title: 'Test Title',
          color: 'white',
          chapters: [{ id: 'chap1', title: 'Chapter 1', white_moves: 10, black_moves: 10 }],
        });

      expect(res.statusCode).toBe(500);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('GET /api/repertoires', () => {
    it('should fetch repertoires', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ repertoire_id: 'test', chapters: [] }] });
      const res = await request(app)
        .get('/api/repertoires')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].total_chapters).toBe(0);
    });
  });

  describe('PUT /api/repertoires/title', () => {
    it('should update title', async () => {
      db.query.mockResolvedValueOnce({});
      const res = await request(app)
        .put('/api/repertoires/title')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ repertoire_id: 'test', new_title: 'New Title' });
      expect(res.statusCode).toBe(200);
    });
    it('should return 400 if missing fields', async () => {
      const res = await request(app)
        .put('/api/repertoires/title')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/repertoires', () => {
    it('should delete repertoire', async () => {
      db.query.mockResolvedValue({});
      const res = await request(app)
        .delete('/api/repertoires?repertoire_id=test&color=white')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
    });
    it('should return 400 if missing query params', async () => {
      const res = await request(app)
        .delete('/api/repertoires')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(400);
    });
  });
});
