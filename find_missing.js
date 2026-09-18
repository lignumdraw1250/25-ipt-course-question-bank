const fs = require('fs');
const text = fs.readFileSync('extracted_text.txt', 'utf8');
const lines = text.split('\n').filter(l => l.trim());

// Find multi-choice section and look for Q41-45, Q60
const multiStart = lines.findIndex(l => l.includes('二、多选题'));
console.log('Multi start line:', multiStart);

console.log('\n=== Looking for Q41-45, Q60 answers ===');
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (/^4[1-5]\./.test(t) || /^60\./.test(t)) {
    console.log('\nLine ' + i + ': ' + t.substring(0, 120));
    for (let j = i+1; j < Math.min(i+12, lines.length); j++) {
      console.log('  ' + j + ': ' + lines[j].trim().substring(0, 120));
    }
  }
}

// Also look at the first two judge questions (Q1, Q2)
console.log('\n\n=== Judge Q1-Q5 ===');
const judgeStart = lines.findIndex(l => l.includes('三、判断题'));
for (let i = judgeStart; i < judgeStart + 30; i++) {
  console.log(i + ': ' + lines[i].trim().substring(0, 150));
}
