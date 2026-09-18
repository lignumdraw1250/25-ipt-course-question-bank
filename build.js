const fs = require('fs');

// ============================================================
// STEP 1: Extract paragraphs from document.xml
// FIXED: Handle w:t elements that contain XML formatting text
// ============================================================
const xml = fs.readFileSync('docx_extracted/word/document.xml', 'utf8');

function extractParagraphs(xmlStr) {
  const result = [];
  const pRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let match;
  while ((match = pRegex.exec(xmlStr)) !== null) {
    const pXml = match[0];
    const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    let parts = [];
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      let content = tMatch[1];
      // Strip leading XML tags from w:t content (some paragraphs have
      // embedded XML formatting as literal text before the actual content)
      content = content.replace(/^(\s*<[^>]+>\s*)+/, '');
      // Keep the content (may be whitespace-only, used as separator)
      parts.push(content);
    }
    // Join all w:t content. Don't collapse whitespace - spacing between
    // options relies on multiple spaces/tabs from the original document.
    let text = parts.join('').trim();
    if (text) {
      result.push(text);
    }
  }
  return result;
}

const rawParagraphs = extractParagraphs(xml);
console.log('Raw clean paragraphs:', rawParagraphs.length);

// Pre-process: split paragraphs that contain question + options + answer inline
// This happens when w:t elements from separate runs get merged due to XML stripping
const paragraphs = [];
for (const p of rawParagraphs) {
  // Check if this paragraph contains a question number + options AND/OR answer inline
  // Pattern: "N. question text  A. opt1    B. opt2    C. opt3    D. opt4  答案：X"
  const inlineMatch = p.match(/^(\d{1,3}\.[\s\S]*?)(?=\s{2,}[A-E]\.)/);
  if (inlineMatch && /^(\d{1,3})\./.test(p)) {
    let remaining = p;

    // Extract question text (up to first option)
    const qMatch = remaining.match(/^(\d{1,3}\.)(.+?)(?=\s{2,}[A-E]\.)/);
    if (qMatch) {
      paragraphs.push(qMatch[1] + qMatch[2].trim());
      remaining = remaining.substring(qMatch[0].length).trim();
    }

    // Extract options and possible answer
    // Split by option pattern: "A.xxx    B.xxx    C.xxx    D.xxx"
    // Check if answer is embedded
    const ansIdx = remaining.indexOf('答案');
    let optPart = remaining;
    let ansPart = '';
    if (ansIdx >= 0) {
      optPart = remaining.substring(0, ansIdx).trim();
      ansPart = remaining.substring(ansIdx).trim();
    }

    if (optPart) paragraphs.push(optPart);
    if (ansPart) paragraphs.push(ansPart);
  } else {
    paragraphs.push(p);
  }
}
console.log('After splitting:', paragraphs.length);

// Pre-process: fix numbers missing periods (e.g., "32党" -> "32.党")
for (let i = 0; i < paragraphs.length; i++) {
  paragraphs[i] = paragraphs[i].replace(/^(\d{1,3})([^\s\.、．\d])/, '$1.$2');
}

// Find section boundaries
let singleStart = -1, multiStart = -1, judgeParaIdx = -1, essayStart = -1;
paragraphs.forEach((p, i) => {
  if (p.startsWith('一、单选题')) singleStart = i + 1;
  if (p.startsWith('二、多选题')) multiStart = i + 1;
  if (p.startsWith('三、判断题')) judgeParaIdx = i;
  if (p.startsWith('其他需要重点掌握')) essayStart = i;
});

console.log('Sections:', {singleStart, multiStart, judgeParaIdx, essayStart});

// ============================================================
// STEP 2: Parse single-choice and multi-choice from paragraphs
// ============================================================
function parseChoiceQuestions(paragraphs, start, end, type) {
  const questions = [];
  let i = start;

  while (i < end && i < paragraphs.length) {
    const p = paragraphs[i];
    const qMatch = p.match(/^(\d{1,3})[\.、．]\s*(.+)/);
    if (qMatch) {
      const qNum = parseInt(qMatch[1]);
      let qText = qMatch[2];
      i++;

      let optionLines = [];
      let answerLines = [];

      while (i < end && i < paragraphs.length) {
        const next = paragraphs[i];
        if (/^\d{1,3}[\.、．]/.test(next)) break;

        if (next.startsWith('答案')) {
          const ansMatch = next.match(/答案[：:]\s*(.*)/);
          if (ansMatch && ansMatch[1].trim()) {
            answerLines.push(ansMatch[1].trim());
          } else {
            i++;
            while (i < end && i < paragraphs.length) {
              const al = paragraphs[i];
              if (/^\d{1,3}[\.、．]/.test(al)) { i--; break; }
              if (/^[A-E]\./.test(al)) { i--; break; }
              if (al.startsWith('答案')) { i--; break; }
              answerLines.push(al.replace(/\s+/g, ''));
              i++;
            }
          }
          break;
        }

        if (/^[A-E]\./.test(next)) {
          optionLines.push(next);
        }

        i++;
      }

      let options = [];
      for (const ol of optionLines) {
        const parts = ol.split(/\s{2,}(?=[A-E][\.．、，])/);
        for (const part of parts) {
          const optMatch = part.match(/^([A-E])[\.．、，]\s*(.+)/);
          if (optMatch) {
            options.push({ letter: optMatch[1], text: optMatch[2].trim() });
          }
        }
      }

      let answer = answerLines.join('').replace(/\s+/g, '').toUpperCase();

      if (qText && options.length >= 2) {
        questions.push({
          id: questions.length + 1,
          originalNum: qNum,
          type: type,
          question: qText.trim(),
          options: options,
          answer: answer
        });
      }
    } else {
      i++;
    }
  }

  return questions;
}

// Post-process: fill missing question numbers by finding orphan paragraphs
// between consecutively numbered questions
function fillMissingNumbers(questions, paragraphs, start, end, type) {
  if (questions.length === 0) return questions;

  const sorted = [...questions].sort((a, b) => a.originalNum - b.originalNum);
  const result = [...sorted];

  // Find gaps in numbering
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const gap = next.originalNum - curr.originalNum;

    if (gap > 1) {
      // There's a gap - look for orphan paragraphs between curr and next
      // Find the paragraph index of curr's question text and next's question text
      let currParaIdx = -1, nextParaIdx = -1;
      for (let p = start; p < end; p++) {
        const txt = paragraphs[p];
        // Match against the question text (first 30 chars)
        if (txt.includes(curr.question.substring(0, Math.min(30, curr.question.length)))) {
          currParaIdx = p;
        }
        if (txt.includes(next.question.substring(0, Math.min(30, next.question.length)))) {
          nextParaIdx = p;
          break;
        }
      }

      if (currParaIdx >= 0 && nextParaIdx > currParaIdx) {
        // Scan between curr and next for unnumbered question paragraphs
        for (let missingNum = curr.originalNum + 1; missingNum < next.originalNum; missingNum++) {
          for (let p = currParaIdx + 1; p < nextParaIdx; p++) {
            const txt = paragraphs[p];
            // Look for a paragraph that looks like a question:
            // - Does NOT start with a number
            // - Is NOT an option line (A. B. C. D.)
            // - Is NOT an answer line
            // - Has Chinese characters and is long enough
            if (!/^\d{1,3}[\.、．]/.test(txt) &&
                !/^[A-E][\.．、，]/.test(txt) &&
                !/^答案/.test(txt) &&
                /[一-鿿]/.test(txt) &&
                txt.length > 10) {

              // Check if next paragraphs have options
              let hasOptions = false;
              let options = [];
              let answer = '';
              let optIdx = p + 1;

              while (optIdx < nextParaIdx && optIdx < paragraphs.length) {
                const optLine = paragraphs[optIdx];
                if (/^[A-E][\.．、，]/.test(optLine)) {
                  hasOptions = true;
                  // Parse options from this line
                  const parts = optLine.split(/\s{2,}(?=[A-E][\.．、，])/);
                  for (const part of parts) {
                    const optMatch = part.match(/^([A-E])[\.．、，]\s*(.+)/);
                    if (optMatch) options.push({ letter: optMatch[1], text: optMatch[2].trim() });
                  }
                  optIdx++;
                } else if (optLine.startsWith('答案')) {
                  const ansMatch = optLine.match(/答案[：:]\s*(.*)/);
                  if (ansMatch && ansMatch[1].trim()) {
                    answer = ansMatch[1].trim().replace(/\s+/g, '').toUpperCase();
                  }
                  break;
                } else if (/^\d{1,3}[\.、．]/.test(optLine)) {
                  break; // next question
                } else {
                  optIdx++;
                }
              }

              if (hasOptions && options.length >= 2) {
                result.push({
                  id: result.length + 1,
                  originalNum: missingNum,
                  type: type,
                  question: txt.trim(),
                  options: options,
                  answer: answer
                });
                // Update currParaIdx to skip this question in future searches
                currParaIdx = optIdx;
              }
            }
          }
        }
      }
    }
  }

  // Re-sort and re-number IDs
  return result.sort((a, b) => a.originalNum - b.originalNum).map((q, i) => ({...q, id: i + 1}));
}

let singleChoice = parseChoiceQuestions(paragraphs, singleStart, multiStart - 1, 'single');
let multiChoice = parseChoiceQuestions(paragraphs, multiStart, judgeParaIdx - 1, 'multi');

// Fill missing numbers
multiChoice = fillMissingNumbers(multiChoice, paragraphs, multiStart, judgeParaIdx - 1, 'multi');

console.log(`Single choice: ${singleChoice.length}`);
console.log(`Multi choice: ${multiChoice.length}`);

// Count question numbers
const singleNums = singleChoice.map(q => q.originalNum).sort((a,b) => a-b);
console.log('Single number range:', singleNums[0], '-', singleNums[singleNums.length-1]);

const missingSingle = [];
for (let n = 1; n <= 90; n++) { if (!singleNums.includes(n)) missingSingle.push(n); }
console.log('Missing single numbers:', missingSingle.join(', ') || 'none');

const multiNums = multiChoice.map(q => q.originalNum).sort((a,b) => a-b);
console.log('Multi number range:', multiNums[0], '-', multiNums[multiNums.length-1]);
const missingMulti = [];
for (let n = 1; n <= 60; n++) { if (!multiNums.includes(n)) missingMulti.push(n); }
console.log('Missing multi numbers:', missingMulti.join(', ') || 'none');

// ============================================================
// STEP 3: Parse judge (true/false) from raw text (unchanged)
// ============================================================
const rawText = fs.readFileSync('extracted_text.txt', 'utf8');
const rawLines = rawText.split('\n').filter(l => l.trim());

let rawJudgeStart = -1, rawJudgeEnd = -1;
rawLines.forEach((l, i) => {
  if (l.includes('三、判断题')) rawJudgeStart = i;
  if (l.includes('其他需要重点掌握')) rawJudgeEnd = i;
});

function parseJudgeQuestions(lines, start, end) {
  const questions = [];
  let i = start + 1;

  while (i < end) {
    const line = lines[i].trim();
    let qNum = 0;
    let qText = '';

    const qMatchOneLine = line.match(/^(\d{1,3})\.\s*(.+)/);
    const qMatchNumOnly = line.match(/^(\d{1,3})\.$/);

    if (qMatchOneLine) {
      qNum = parseInt(qMatchOneLine[1]);
      qText = qMatchOneLine[2];
      i++;
    } else if (qMatchNumOnly) {
      qNum = parseInt(qMatchNumOnly[1]);
      i++;
      while (i < end) {
        const nl = lines[i].trim();
        if (/^\d{1,3}\.$/.test(nl)) break;
        if (nl.startsWith('答案')) break;
        const cleaned = nl.replace(/[（(]\s*[）)]/g, '').trim();
        if (cleaned && !/^[（(]\s*$/.test(cleaned) && !/^\s*[）)]$/.test(cleaned) && !/^[（(）)]$/.test(cleaned)) {
          qText += cleaned;
        }
        i++;
      }
    } else {
      i++;
      continue;
    }

    qText = qText.replace(/[（(]注[：:][^）)]*[）)]/g, '').trim();
    qText = qText.replace(/[（(]\s*[）)]\s*$/g, '').trim();
    qText = qText.replace(/\s+/g, '');

    let answer = '';
    while (i < end) {
      const nl = lines[i].trim();
      if (/^\d{1,3}\.$/.test(nl)) break;
      if (nl.startsWith('答案')) {
        const ansMatch = nl.match(/答案[：:]\s*(.*)/);
        if (ansMatch && ansMatch[1].trim()) {
          answer = ansMatch[1].trim();
        } else {
          i++;
          if (i < end) {
            let al = lines[i].trim();
            if (al.startsWith('（注') || al.startsWith('(注')) {
              while (i < end && !al.includes('）') && !al.includes(')')) {
                i++;
                if (i < end) al = lines[i].trim();
              }
              i++;
              if (i < end) al = lines[i].trim();
            }
            answer = al.replace(/\s+/g, '');
          }
        }
        i++;
        break;
      }
      i++;
    }

    if (qText && qText.length > 3) {
      questions.push({
        id: questions.length + 1,
        originalNum: qNum,
        type: 'judge',
        question: qText,
        options: [
          { letter: '√', text: '正确' },
          { letter: '×', text: '错误' }
        ],
        answer: answer
      });
    }
  }

  return questions;
}

let judgeQuestions = parseJudgeQuestions(rawLines, rawJudgeStart, rawJudgeEnd);
// Apply gap filling for judge questions
// Find judge section in the main paragraphs list
let judgeParaStart = -1, judgeParaEnd = -1;
for (let i = 0; i < paragraphs.length; i++) {
  if (paragraphs[i].startsWith('三、判断题')) judgeParaStart = i;
  if (paragraphs[i].startsWith('其他需要重点掌握') && judgeParaStart >= 0) {
    judgeParaEnd = i;
    break;
  }
}
if (judgeParaStart >= 0 && judgeParaEnd >= 0) {
  judgeQuestions = fillMissingNumbers(judgeQuestions, paragraphs, judgeParaStart, judgeParaEnd, 'judge');
}
console.log(`Judge questions: ${judgeQuestions.length}`);

const judgeNums = judgeQuestions.map(q => q.originalNum).sort((a,b) => a-b);
console.log('Judge number range:', judgeNums[0], '-', judgeNums[judgeNums.length-1]);
const missingJudge = [];
for (let n = 1; n <= 50; n++) { if (!judgeNums.includes(n)) missingJudge.push(n); }
console.log('Missing judge numbers:', missingJudge.join(', ') || 'none');

// ============================================================
// STEP 4: Parse essay questions
// ============================================================
const essayQuestions = [];
for (let i = essayStart + 1; i < paragraphs.length; i++) {
  const p = paragraphs[i];
  const m = p.match(/^(\d{1,2})[\.、]\s*(.+)/);
  if (m && p.length > 5) {
    essayQuestions.push({ id: parseInt(m[1]), question: m[2].trim() });
  }
}
console.log(`Essay questions: ${essayQuestions.length}`);

// ============================================================
// STEP 5: Validation
// ============================================================
const missingSingleAns = singleChoice.filter(q => !q.answer);
const missingMultiAns = multiChoice.filter(q => !q.answer);
const missingJudgeAns = judgeQuestions.filter(q => !q.answer);
console.log(`\nMissing answers - Single: ${missingSingleAns.length}, Multi: ${missingMultiAns.length}, Judge: ${missingJudgeAns.length}`);

// Print samples
if (singleChoice.length > 30) {
  console.log('\n=== Sample single Q31 (was missing before) ===');
  const q31 = singleChoice.find(q => q.originalNum === 31);
  if (q31) console.log(JSON.stringify(q31, null, 2));
  else console.log('STILL MISSING');
}

// Check for 3-option questions
const badOpts = singleChoice.filter(q => q.options.length !== 4);
console.log('\nSingle choice with != 4 options:', badOpts.length);
badOpts.forEach(q => console.log('  Q' + q.originalNum + ': ' + q.options.length + ' opts, ' + q.question.substring(0, 50)));

// Manual fixes for multi-choice answers
const manualFixes = {
  multi: { 29: 'CD', 30: 'ABD', 31: 'ABCD', 33: 'CD', 44: 'ABCD' }
};
for (const q of multiChoice) {
  if (manualFixes.multi[q.id]) q.answer = manualFixes.multi[q.id];
}

// Save
const output = { singleChoice, multiChoice, judgeQuestions, essayQuestions };
fs.writeFileSync('questions.json', JSON.stringify(output, null, 2), 'utf8');
console.log(`\nSaved questions.json: ${singleChoice.length} single, ${multiChoice.length} multi, ${judgeQuestions.length} judge, ${essayQuestions.length} essay`);
