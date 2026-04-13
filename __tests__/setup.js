jest.mock('../server/database', () => ({
  query: jest.fn(),
}));

jest.mock('../server/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
}));
