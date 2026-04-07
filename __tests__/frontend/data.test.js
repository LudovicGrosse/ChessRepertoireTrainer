/**
 * @jest-environment jsdom
 */

import { parseMultiPgn, buildRepertoireTree } from '../../public/js/data.js';

describe('data.js', () => {
    describe('parseMultiPgn', () => {
        it('separates a PGN containing multiple chapters', () => {
            const rawPgn = `[Event "Chapter 1"]\n[Site "https://lichess.org/study/xxx"]\n\n1. e4 e5\n\n[Event "Chapter 2"]\n[Site "https://lichess.org/study/yyy"]\n\n1. d4 d5`;
            const chapters = parseMultiPgn(rawPgn);
            expect(chapters.length).toBe(2);
            expect(chapters[0].title).toBe('Chapter 1');
            expect(chapters[0].studyUrl).toBe('https://lichess.org/study/xxx');
            expect(chapters[1].title).toBe('Chapter 2');
        });

        it('extracts chapter title correctly from ChapterName', () => {
            const rawPgn = `[Event "Some Event"]\n[ChapterName "My Secret Chapter"]\n\n1. e4`;
            const chapters = parseMultiPgn(rawPgn);
            expect(chapters[0].title).toBe('My Secret Chapter');
        });
    });

    describe('buildRepertoireTree', () => {
        it('creates a move tree from simple PGN notation', () => {
            const pgn = `1. e4 e5`;
            const root = buildRepertoireTree(pgn);
            
            expect(root.children.length).toBe(1);
            expect(root.children[0].san).toBe('e4');
            expect(root.children[0].color).toBe('white');
            
            expect(root.children[0].children.length).toBe(1);
            expect(root.children[0].children[0].san).toBe('e5');
            expect(root.children[0].children[0].color).toBe('black');
        });

        it('handles variations correctly', () => {
            const pgn = `1. e4 e5 (1... c5 2. Nf3) 2. Nf3`;
            const root = buildRepertoireTree(pgn);
            
            const e4 = root.children[0];
            expect(e4.children.length).toBe(2); // e5 and c5
            
            const e5 = e4.children[0];
            expect(e5.san).toBe('e5');
            
            const c5 = e4.children[1];
            expect(c5.san).toBe('c5');
            expect(c5.children[0].san).toBe('Nf3');
        });
    });
});
