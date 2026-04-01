const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'app', 'app.js');
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Remove orphaned lines 744-802 (0-indexed: 743-801)
const keep = [...lines.slice(0, 743), '', ...lines.slice(802)];
fs.writeFileSync(file, keep.join('\n'), 'utf8');

console.log(`Done! Removed ${lines.length - keep.length + 1} orphan lines.`);
console.log(`Before: ${lines.length} lines -> After: ${keep.length} lines`);
