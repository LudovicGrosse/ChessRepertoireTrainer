const fs = require('fs');

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
