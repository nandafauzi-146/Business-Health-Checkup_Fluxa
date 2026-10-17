const fs = require('fs');
const content = fs.readFileSync('frontend/app/globals.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('data-theme="dark"')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
