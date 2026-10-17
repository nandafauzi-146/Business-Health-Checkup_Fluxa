const fs = require('fs');
const path = require('path');

function scanDir(dir, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, results);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // match hardcoded background like background: '#fff' or background: 'white' or backgroundColor: '#fff'
        if (/(background|backgroundColor)\s*:\s*['"`]#(fff|ffffff|f\w{5})['"`]/i.test(line) ||
            /(background|backgroundColor)\s*:\s*['"`]white['"`]/i.test(line)) {
          results.push(`${fullPath}:${i+1} -> ${line.trim()}`);
        }
      });
    }
  }
  return results;
}

const res = scanDir('frontend/components');
console.log(`Found ${res.length} instances of hardcoded light background:`);
res.slice(0, 30).forEach(r => console.log(r));
if (res.length > 30) console.log(`... and ${res.length - 30} more`);
