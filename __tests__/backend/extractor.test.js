const { extractGameEndPgn } = require('../../server/extractor.js');

describe('extractor.js', () => {
  describe('extractGameEndPgn', () => {
    it('extracts the last move and result correctly', () => {
      const result = extractGameEndPgn('1. e4 e5 2. Nf3 Nc6 1-0');
      expect(result.lastMove).toBe('Nc6');
      expect(result.result).toBe('1-0');
    });

    it('handles games without a final result tag', () => {
      const result = extractGameEndPgn('1. e4 e5 2. Nf3 Nc6');
      expect(result.lastMove).toBe('Nc6');
      expect(result.result).toBe(null);
    });

    it('handles pre-mature game ends (1/2-1/2)', () => {
      const result = extractGameEndPgn('1. d4 d5 2. c4 c6 1/2-1/2');
      expect(result.lastMove).toBe('c6');
      expect(result.result).toBe('1/2-1/2');
    });

    it('removes PGN tags and comments', () => {
      const result = extractGameEndPgn('[Event "FIDE"] {A comment} 1. e4 {Another} e5 0-1');
      expect(result.lastMove).toBe('e5');
      expect(result.result).toBe('0-1');
    });

    it('cleans up move numbers', () => {
      const result = extractGameEndPgn('1. e4 e5 2. Nf3 1-0');
      expect(result.lastMove).toBe('Nf3');
      expect(result.result).toBe('1-0');

      const result2 = extractGameEndPgn('1. e4');
      expect(result2.lastMove).toBe('e4');
      expect(result2.result).toBe(null);
    });
  });
});
