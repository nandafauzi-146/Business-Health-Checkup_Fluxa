const fs = require('fs');
const content = fs.readFileSync('frontend/app/globals.css', 'utf8');
const lines = content.split('\n');

const keywords = ['table', '.card', '.modal', '.dialog', '.search-pill', '.product-card', '.cashier', 'input', 'select', 'textarea'];

keywords.forEach(kw => {
  const matches = [];
  lines.forEach((line, i) => {
    if (line.includes(kw) && line.includes('{')) {
      matches.push(`${i+1}: ${line.trim()}`);
    }
  });
  console.log(`=== Matches for "${kw}": ${matches.length} ===`);
  matches.slice(0, 5).forEach(m => console.log(m));
});
