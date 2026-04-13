/**
 * @jest-environment jsdom
 */

import { extractStudyId, formatRelativeTime } from '../../public/js/utils.js';

describe('utils.js', () => {
  describe('extractStudyId', () => {
    it('extracts ID from full URL', () => {
      expect(extractStudyId('https://lichess.org/study/LwoJI6UV')).toBe('LwoJI6UV');
    });

    it('extracts ID from chapter URL', () => {
      expect(extractStudyId('https://lichess.org/study/LwoJI6UV/4sD9x1aX')).toBe('LwoJI6UV');
    });

    it('returns the ID if only ID is provided', () => {
      expect(extractStudyId('LwoJI6UV')).toBe('LwoJI6UV');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "À l\'instant" for very recent date', () => {
      const now = new Date();
      now.setSeconds(now.getSeconds() - 10);
      expect(formatRelativeTime(now.toISOString())).toBe("À l'instant");
    });

    it('handles plurals for days', () => {
      const past = new Date();
      past.setDate(past.getDate() - 2);
      expect(formatRelativeTime(past.toISOString())).toBe('Il y a 2 jours');
    });
  });
});
