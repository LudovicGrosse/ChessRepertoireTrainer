// data.js
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm';

/**
 * ============================================================================
 * PGN PARSING & TREE BUILDING
 * ============================================================================
 */

/**
 * Parses a multi-chapter PGN string from Lichess into an array of chapter objects.
 * 
 * @param {string} pgnString - The raw PGN content containing one or multiple chapters.
 * @returns {Array} List of chapters { title, pgn }
 */
export const parseMultiPgn = (pgnString) => {
    if (!pgnString) return [];
    
    // Chapters in Lichess PGN exports are separated by 3+ newlines
    const chapters = pgnString.split(/\n\n\n+/);
    
    return chapters
        .filter(pgn => pgn.trim().length > 0)
        .map(pgn => {
            // Extract the chapter title from the [Event "Title"] tag
            const titleMatch = pgn.match(/\[Event "(.*?)"\]/);
            return {
                title: titleMatch ? titleMatch[1] : 'Untitled Chapter',
                pgn: pgn.trim()
            };
        });
};

/**
 * Builds a recursive move tree from a single PGN string.
 * This tree is used by Chessground for interactive navigation and training.
 * 
 * @param {string} pgn - The PGN content of a single chapter.
 * @returns {Object} The root node of the move tree.
 */
export const buildRepertoireTree = (pgn) => {
    const game = new Chess();
    try {
        game.loadPgn(pgn);
    } catch (e) {
        console.error("Error loading PGN into Chess.js:", e);
        throw e;
    }

    const history = game.history({ verbose: true });
    
    /**
     * Root node structure:
     * - id: 'root'
     * - fen: initial position
     * - children: array of first moves
     */
    const root = { 
        id: 'root', 
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 
        children: [] 
    };

    let current = root;

    // Process each move in the main line and variations
    for (const move of history) {
        // Check if the move already exists as a child of the current node
        let child = current.children.find(c => c.san === move.san);
        
        if (!child) {
            // Create a new node for this move
            child = {
                id: move.after, // Use FEN as unique ID for the position
                san: move.san,
                from: move.from,
                to: move.to,
                color: move.color === 'w' ? 'white' : 'black',
                fen: move.after,
                parent: current,
                comment: move.comment || "",
                shapes: move.shapes || [],
                children: [],
                isVisited: false,
                isCompleted: false,
                isLeaf: false 
            };
            current.children.push(child);
        }
        current = child;
    }

    /**
     * Note: This simplified builder works best for linear PGNs. 
     * Complex PGNs with nested variations may require a more robust 
     * recursive parser if Lichess export structure changes.
     */
    return root;
};
