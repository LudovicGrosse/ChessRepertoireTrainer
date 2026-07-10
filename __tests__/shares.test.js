const request = require('supertest');
const app = require('../server/app');
const db = require('../server/database');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key_here';
const teacherToken = jwt.sign({ id: 1, username: 'teacher', is_teacher: true }, SECRET_KEY);
const studentToken = jwt.sign({ id: 2, username: 'student', is_teacher: false }, SECRET_KEY);

describe('Shares Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('POST /api/shares', () => {
    it('should return 403 if user is not a teacher', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_teacher: false }] });
      const res = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          target_usernames: ['student2'],
          studies: [{ url: 'https://lichess.org/study/study_abc', color: 'white' }],
        });
      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error', 'Accès réservé aux professeurs.');
    });

    it('should share study successfully if user is a teacher', async () => {
      // 1. Teacher verify query
      db.query.mockResolvedValueOnce({
        rows: [{ is_teacher: true, lichess_access_token: 'teacher_token' }],
      });

      // DB Mock client for transaction
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(client);

      // Mocks in exact execution order:
      client.query.mockResolvedValueOnce({}); // BEGIN
      client.query.mockResolvedValueOnce({ rows: [{ username: 'student2' }] }); // Student check
      client.query.mockResolvedValueOnce({}); // Repertoire Insert
      client.query.mockResolvedValueOnce({}); // Chapter Insert
      client.query.mockResolvedValueOnce({}); // Shares Insert
      client.query.mockResolvedValueOnce({}); // COMMIT
      // Mock fetch Lichess study PGN
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `[Event "Chapter 1"]\n[StudyName "My Openings"]\n[Site "https://lichess.org/study/study_abc/chap_1"]\n\n1. e4 e5`,
      });

      const res = await request(app)
        .post('/api/shares')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          target_usernames: ['student2'],
          studies: [{ url: 'https://lichess.org/study/study_abc', color: 'white' }],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message', 'Études partagées avec succès.');
      expect(res.body.nonExistentUsers).toEqual([]);
    });
  });

  describe('GET /api/shares/pending', () => {
    it('should return pending invitations for the student', async () => {
      db.query.mockResolvedValueOnce({}); // DELETE cleanup query
      db.query.mockResolvedValueOnce({ rows: [{ lichess_username: 'student' }] });
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            repertoire_id: 'study_abc',
            repertoire_title: 'My Openings',
            color: 'white',
            created_at: new Date().toISOString(),
            teacher_username: 'teacher',
          },
        ],
      });

      const res = await request(app)
        .get('/api/shares/pending')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body[0]).toHaveProperty('repertoire_title', 'My Openings');
    });
  });

  describe('POST /api/shares/:id/accept', () => {
    it('should accept sharing invitation and link repertoire', async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      db.connect = jest.fn().mockResolvedValue(client);

      // BEGIN
      client.query.mockResolvedValueOnce({});
      // Fetch share invitation
      client.query.mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            repertoire_id: 'study_abc',
            target_username: 'student',
            color: 'white',
          },
        ],
      });
      // Fetch user profile
      client.query.mockResolvedValueOnce({ rows: [{ lichess_username: 'student' }] });
      // Insert user_repertoire link
      client.query.mockResolvedValueOnce({});
      // Update share invitation status
      client.query.mockResolvedValueOnce({});
      // COMMIT
      client.query.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/shares/5/accept')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Invitation acceptée avec succès !');
    });
  });

  describe('POST /api/shares/:id/decline', () => {
    it('should decline sharing invitation', async () => {
      // 1. Fetch share invitation
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            repertoire_id: 'study_abc',
            target_username: 'student',
            color: 'white',
          },
        ],
      });
      // 2. Fetch user profile
      db.query.mockResolvedValueOnce({ rows: [{ lichess_username: 'student' }] });
      // 3. Update share invitation status to declined
      db.query.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/shares/5/decline')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Invitation déclinée.');
    });
  });

  describe('DELETE /api/shares/:id', () => {
    it('should cancel share invitation', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_teacher: true }] });
      db.query.mockResolvedValueOnce({ rows: [{ teacher_id: 1 }] });
      db.query.mockResolvedValueOnce({}); // DELETE query

      const res = await request(app)
        .delete('/api/shares/5')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Invitation annulée avec succès.');
    });
  });

  describe('POST /api/shares/:id/renew', () => {
    it('should renew share invitation for 7 more days', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ is_teacher: true }] });
      db.query.mockResolvedValueOnce({ rows: [{ teacher_id: 1, status: 'pending' }] });
      db.query.mockResolvedValueOnce({}); // UPDATE query

      const res = await request(app)
        .post('/api/shares/5/renew')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty(
        'message',
        'Invitation renouvelée pour 7 jours supplémentaires.'
      );
    });
  });
});
