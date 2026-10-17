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
        if (/(#ccc|#ddd|#eee|#333|#666|#999)\b/i.test(line)) {
          results.push(`${fullPath}:${i+1} -> ${line.trim()}`);
        }
      });
    }
  }
  return results;
}

const res = scanDir('frontend/components');
console.log(`Found ${res.length} matches:`);
res.forEach(r => console.log(r));
