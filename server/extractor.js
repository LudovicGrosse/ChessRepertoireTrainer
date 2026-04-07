const fs = require('fs');

if (require.main === module) {
    const html = fs.readFileSync('chess.html', 'utf8');

    const styleRegex = /<style>([\s\S]*?)<\/style>/;
    const scriptRegex = /<script type="module">([\s\S]*?)<\/script>/;

    const styleMatch = html.match(styleRegex);
    const scriptMatch = html.match(scriptRegex);

    if (styleMatch) {
        fs.writeFileSync('public/css/style.css', styleMatch[1].trim());
    }

    let remainingHtml = html.replace(styleRegex, '<link rel="stylesheet" href="css/style.css" />');
    remainingHtml = remainingHtml.replace(scriptRegex, '<script type="module" src="js/main.js"></script>');

    fs.writeFileSync('public/index.html', remainingHtml);

    const scriptContent = scriptMatch[1];
    fs.writeFileSync('public/js/full_script.js', scriptContent);
}

function extractGameEndPgn(pgnContent) {
    if (!pgnContent) return { lastMove: null, result: null };
    
    // Remove tags
    const cleanPgn = pgnContent.replace(/\[.*?\]/g, '').trim();
    if (!cleanPgn) return { lastMove: null, result: null };

    // Remove comments
    const noComments = cleanPgn.replace(/\{[^}]*\}/g, '').trim();
    
    const tokens = noComments.split(/\s+/).filter(t => t && !t.includes('...'));
    if (tokens.length === 0) return { lastMove: null, result: null };

    let lastMove = null;
    let result = null;

    const lastToken = tokens[tokens.length - 1];
    if (['1-0', '0-1', '1/2-1/2', '*'].includes(lastToken)) {
        result = lastToken;
        if (tokens.length > 1) {
            lastMove = tokens[tokens.length - 2];
        }
    } else {
        lastMove = lastToken;
    }

    // Clean up last move if it starts with a move number like '34.e4'
    if (lastMove && lastMove.match(/^\d+\.(.+)$/)) {
        lastMove = lastMove.match(/^\d+\.(.+)$/)[1];
    }

    return { lastMove, result };
}

module.exports = { extractGameEndPgn };
