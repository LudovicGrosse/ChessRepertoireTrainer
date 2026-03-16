// data.js
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm';

const STORAGE_KEY = 'custom_repertoires_v3';

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
        const eventMatch = part.match(/\[Event "([^"]+)"\]/);
        if (eventMatch && eventMatch[1] && eventMatch[1] !== "?") title = eventMatch[1];
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

// =========================================
// REPERTOIRE DATABASE
// =========================================

export const defaultDatabase = [
    {
        id: "default_1", title: "Italienne - Attaque Max Lange (Blancs)", defaultColor: "white",
        chapters: parseMultiPgn(`[Event "Attaque Max Lange"]\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 {Défense des deux cavaliers} 4. d4 exd4 5. O-O Bc5 {Transposition dans l'attaque Max Lange} 6. e5 d5 7. exf6 dxc4 8. Re1+ Be6 9. Ng5 Qd5 (9... Qxf6 {Mauvais car les Blancs récupèrent la pièce avec avantage} 10. Nxe6 fxe6 11. Qh5+) 10. Nc3 Qf5 11. Nce4 *`)
    },
    {
        id: "default_2", title: "Défense Sicilienne - Dragon (Noirs)", defaultColor: "black",
        chapters: parseMultiPgn(`[Event "Variante du Dragon"]\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 {La structure caractéristique du Dragon} 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 *`)
    },
    {
        id: "default_3", title: "Finale de Pions (Position FEN personnalisée)", defaultColor: "white",
        chapters: parseMultiPgn(`[Event "Sécuriser le pion passé"]\n[FEN "8/8/8/8/4K3/5P2/8/4k3 w - - 0 1"]\n1. f4 {Sécurise le pion passé} Kd2 2. f5 *`)
    }
];

/**
 * Merges default database with local storage custom repertoires
 */
export const getRepertoireDatabase = () => {
    const localData = localStorage.getItem(STORAGE_KEY);
    const customReps = localData ? JSON.parse(localData) : [];
    return [...defaultDatabase, ...customReps];
};

/**
 * Saves a new custom repertoire to local storage
 */
export const saveCustomRepertoire = (title, rawPgn, color) => {
    const localData = localStorage.getItem(STORAGE_KEY);
    const customReps = localData ? JSON.parse(localData) : [];
    const newRep = { 
        id: 'custom_' + Date.now(), 
        title, 
        defaultColor: color, 
        chapters: parseMultiPgn(rawPgn) 
    };
    customReps.push(newRep);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customReps));
    return newRep;
};
