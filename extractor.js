const fs = require('fs');
const html = fs.readFileSync('chess.html', 'utf8');
const startTag = '<script type="module">';
const endTag = '</script>';
const start = html.indexOf(startTag);
const end = html.lastIndexOf(endTag);
if (start !== -1 && end !== -1) {
  const js = html.substring(start + startTag.length, end);
  fs.writeFileSync('temp.js', js);
  console.log('Extracted to temp.js');
} else {
  console.log('Could not find script tags');
}