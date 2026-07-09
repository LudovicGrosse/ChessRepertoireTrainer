jest.mock('../server/database', () => ({
  query: jest.fn(),
}));

