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
        
        const siteMatch = part.match(/\[Site\s+"([^"]+)"\]/);
        const studyUrl = siteMatch ? siteMatch[1] : null;
        
        chapters.push({ id: `chap_${Date.now()}_${index}`, title: title, pgn: part.trim(), studyUrl: studyUrl });
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
    
    // Safely remove only standard PGN headers: [Word "Value"]
    let cleanedText = pgnText.replace(/\[[a-zA-Z]+\s+"[^"]*"\]\s*/g, '').trim();
    
    const tokens = cleanedText.match(/[a-zA-Z0-9\-+=#KQRBN]+|\(|\)|\{[^}]*\}|\$\d+|\d+\.+/g) || [];
    const root = { id: 'root', san: 'root', fen: startFen, comment: null, shapes: [], children: [], parent: null, isCompleted: false, isVisited: true, isLeaf: false };
    let current = root, tempGame = new Chess(startFen), nodeStack = [], idCounter = 0;
    
    for (let token of tokens) {
        if (/^\d+\.+$/.test(token) || /^\$\d+$/.test(token)) continue;
        if (token === '(') { 
            nodeStack.push(current); 
            current = current.parent; 
            tempGame.load(current.fen); 
        } 
        else if (token === ')') { 
            current = nodeStack.pop(); 
            tempGame.load(current.fen); 
        } 
        else if (token.startsWith('{')) {
            let cmt = token.slice(1, -1).trim();
            const shapes = [];

            // Extract Lichess arrows: [%cal Gg1f3,Re2e4]
            const calMatch = cmt.match(/\[%cal\s+(.*?)\]/);
            if (calMatch) {
                calMatch[1].split(',').forEach(s => {
                    const item = s.trim();
                    if (item.length >= 5) {
                        const colorCode = item[0];
                        const orig = item.substring(1, 3);
                        const dest = item.substring(3, 5);
                        let brush = 'green';
                        if (colorCode === 'R') brush = 'red';
                        if (colorCode === 'B') brush = 'blue';
                        if (colorCode === 'O') brush = 'orange';
                        if (colorCode === 'Y') brush = 'yellow';
                        shapes.push({ orig, dest, brush });
                    }
                });
            }

            // Extract Lichess circles: [%csl Gg1,Re2]
            const cslMatch = cmt.match(/\[%csl\s+(.*?)\]/);
            if (cslMatch) {
                cslMatch[1].split(',').forEach(s => {
                    const item = s.trim();
                    if (item.length >= 3) {
                        const colorCode = item[0];
                        const orig = item.substring(1, 3);
                        let brush = 'green';
                        if (colorCode === 'R') brush = 'red';
                        if (colorCode === 'B') brush = 'blue';
                        if (colorCode === 'O') brush = 'orange';
                        if (colorCode === 'Y') brush = 'yellow';
                        shapes.push({ orig, brush });
                    }
                });
            }

            // Clean comment
            cmt = cmt.replace(/\[%cal\s+.*?\]/g, '').replace(/\[%csl\s+.*?\]/g, '').trim();

            if (current) {
                current.comment = current.comment ? current.comment + " " + cmt : cmt;
                if (shapes.length > 0) current.shapes = (current.shapes || []).concat(shapes);
            }
        } else {
            try {
                const moveObj = tempGame.move(token);
                if (moveObj) {
                    const newNode = { 
                        id: 'node_'+(idCounter++), 
                        san: moveObj.san, 
                        from: moveObj.from, 
                        to: moveObj.to, 
                        fen: tempGame.fen(), 
                        color: moveObj.color === 'w' ? 'white' : 'black', 
                        comment: null, 
                        shapes: [], 
                        children: [], 
                        parent: current, 
                        isCompleted: false, 
                        isVisited: false, 
                        isLeaf: false 
                    };
                    current.children.push(newNode); 
                    current = newNode;
                }
            } catch (e) {}
        }
    }
    return root;
};
