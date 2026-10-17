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
        if (/(background|backgroundColor)\s*:\s*['"`]#(111827|1f2937|1e293b|0f172a|000|000000|171a22|1a1d26)['"`]/i.test(line)) {
          results.push(`${fullPath}:${i+1} -> ${line.trim()}`);
        }
      });
    }
  }
  return results;
}

const res = scanDir('frontend/components');
console.log(`Found ${res.length} instances of hardcoded dark background:`);
res.forEach(r => console.log(r));
