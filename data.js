// data.js
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm';

// =========================================
// PGN PARSING & TREE BUILDING
// =========================================

/**
 * Parses multiple games/chapters from a single PGN text
 */
export const parseMultiPgn = (rawPgn) => {
    const chapters = [];
    const parts = rawPgn.split(/(?=\[Event ")/);
    parts.forEach((part, index) => {
        if (!part.trim()) return;
        let title = `Chapitre ${index + 1}`;
        const chapterNameMatch = part.match(/\[ChapterName\s+"([^"]+)"\]/);
        const eventMatch = part.match(/\[Event\s+"([^"]+)"\]/);
        
        if (chapterNameMatch && chapterNameMatch[1]) {
            title = chapterNameMatch[1];
        } else if (eventMatch && eventMatch[1] && eventMatch[1] !== "?") {
            title = eventMatch[1];
        }
        chapters.push({ id: `chap_${Date.now()}_${index}`, title: title, pgn: part.trim() });
    });
    if (chapters.length === 0 && rawPgn.trim().length > 0) {
         chapters.push({ id: `chap_${Date.now()}_0`, title: "Chapitre 1", pgn: rawPgn.trim() });
    }
    return chapters;
};

/**
 * Builds a nested move tree from PGN text
 */
export const buildRepertoireTree = (pgnText) => {
    const startFen = (pgnText.match(/\[FEN\s+"([^"]+)"\]/i) || [])[1] || new Chess().fen();
    const tokens = pgnText.replace(/\[.*?\]\s*/g, '').trim().match(/[a-zA-Z0-9\-+=#KQRBN]+|\(|\)|\{[^}]*\}|\$\d+|\d+\.+/g) || [];
    const root = { id: 'root', san: 'root', fen: startFen, comment: null, children: [], parent: null, isCompleted: false, isVisited: true, isLeaf: false };
    let current = root, tempGame = new Chess(startFen), nodeStack = [], idCounter = 0;
    for (let token of tokens) {
        if (/^\d+\.+$/.test(token) || /^\$\d+$/.test(token)) continue;
        if (token === '(') { nodeStack.push(current); current = current.parent; tempGame.load(current.fen); } 
        else if (token === ')') { current = nodeStack.pop(); tempGame.load(current.fen); } 
        else if (token.startsWith('{')) {
            const cmt = token.slice(1, -1).trim();
            if (current) current.comment = current.comment ? current.comment + " " + cmt : cmt;
        } else {
            try {
                const moveObj = tempGame.move(token);
                if (moveObj) {
                    const newNode = { id: 'node_'+(idCounter++), san: moveObj.san, from: moveObj.from, to: moveObj.to, fen: tempGame.fen(), color: moveObj.color === 'w' ? 'white' : 'black', comment: null, children: [], parent: current, isCompleted: false, isVisited: false, isLeaf: false };
                    current.children.push(newNode); current = newNode;
                }
            } catch (e) {}
        }
    }
    return root;
};
