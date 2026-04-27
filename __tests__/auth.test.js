const request = require('supertest');
const app = require('../server/app');
const db = require('../server/database');

jest.mock('../server/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/register', () => {
    it('should register a user and return 201', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/register').send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty(
        'message',
        'Compte créé ! Veuillez vérifier votre boîte mail.'
      );
      expect(db.query).toHaveBeenCalled();
    });

    it('should return 400 if fields are missing', async () => {
      const res = await request(app).post('/api/register').send({
        username: 'testuser',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email invalide.');
    });

    it('should return 400 if email already exists', async () => {
      const error = new Error('Unique constraint failed');
      error.code = '23505';
      error.constraint = 'users_email_key';
      db.query.mockRejectedValueOnce(error);

      const res = await request(app).post('/api/register').send({
        username: 'testuser2',
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', "L'email existe déjà.");
    });
  });

  describe('POST /api/login', () => {
    it('should login successfully and return token', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('password123', 10);
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            password_hash: hashedPassword,
            is_verified: 1,
          },
        ],
      });

      const res = await request(app).post('/api/login').send({
        username: 'testuser',
        password: 'password123',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('username', 'testuser');
    });

    it('should return 401 for invalid credentials', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/login').send({
        username: 'wronguser',
        password: 'wrongpassword',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Identifiants invalides.');
    });

    it('should return 403 if email not verified', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('password123', 10);
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, username: 'testuser', password_hash: hashedPassword, is_verified: 0 }],
      });

      const res = await request(app).post('/api/login').send({
        username: 'testuser',
        password: 'password123',
      });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty(
        'error',
        'Veuillez vérifier votre email avant de vous connecter.'
      );
    });
  });

  describe('POST /api/forgot-password', () => {
    it('should return 404 if email not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/forgot-password')
        .send({ email: 'notfound@example.com' });
      expect(res.statusCode).toBe(404);
    });

    it('should send reset link and return 200', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'testuser' }] });
      db.query.mockResolvedValueOnce({});
      const res = await request(app)
        .post('/api/forgot-password')
        .send({ email: 'test@example.com' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/reset-password', () => {
    it('should return 400 for invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/reset-password')
        .send({ token: 'invalid', newPassword: 'new' });
      expect(res.statusCode).toBe(400);
    });

    it('should reset password and return 200', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, reset_token_expiry: new Date(Date.now() + 100000).toISOString() }],
      });
      db.query.mockResolvedValueOnce({});
      const res = await request(app)
        .post('/api/reset-password')
        .send({ token: 'valid', newPassword: 'new' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/account', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'your_secret_key_here');

    it('should return 400 if password missing', async () => {
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.statusCode).toBe(400);
    });

    it('should delete account if password correct', async () => {
      const bcrypt = require('bcryptjs');
      db.query.mockResolvedValueOnce({ rows: [{ password_hash: bcrypt.hashSync('pass', 10) }] });
      db.query.mockResolvedValueOnce({});
      const res = await request(app)
        .delete('/api/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'pass' });
      expect(res.statusCode).toBe(200);
    });
  });
});
