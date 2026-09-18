const fs = require('fs');

// Read extracted text
const rawText = fs.readFileSync('extracted_text.txt', 'utf8');

// Split into lines, keep all lines (including empty ones for structure)
const allLines = rawText.split('\n');

// Helper: check if a line looks like a question number start
function isQuestionStart(line) {
  const t = line.trim();
  return /^\d{1,3}\.$/.test(t);
}

// Helper: check if a line looks like an option line (A. B. C. D.)
function isOptionLine(line) {
  const t = line.trim();
  return /^[A-E]\./.test(t);
}

// Helper: check if line is an answer line
function isAnswerLine(line) {
  return line.trim().startsWith('答案');
}

// Helper: check if line is a section header
function isSectionHeader(line) {
  const t = line.trim();
  return /^[一二三四五六七八九十]、/.test(t);
}

// Parse questions from a section of lines
function parseQuestions(lines, startIdx, endIdx, type) {
  const questions = [];
  let i = startIdx;

  while (i < endIdx) {
    const line = lines[i];
    if (!line) { i++; continue; }

    const trimmed = line.trim();

    // Check for section header
    if (isSectionHeader(trimmed)) {
      i++;
      continue;
    }

    // Check for question start
    if (isQuestionStart(trimmed)) {
      const qNum = parseInt(trimmed);
      let qText = '';
      let options = [];
      let answer = '';
      i++;

      // Collect question text and options until next question or answer
      while (i < endIdx) {
        const cl = lines[i];
        if (!cl) { i++; continue; }

        const ct = cl.trim();

        // Stop if we hit the next question number
        if (isQuestionStart(ct)) break;
        // Stop if we hit a section header
        if (isSectionHeader(ct)) break;

        // Check for answer
        if (isAnswerLine(ct)) {
          // Answer might be on same line or next line
          const ansMatch = ct.match(/答案[：:]\s*(.*)/);
          if (ansMatch && ansMatch[1].trim()) {
            answer = ansMatch[1].trim();
          } else {
            // Answer on next line(s)
            i++;
            if (i < endIdx) {
              let ansLine = lines[i].trim();
              // Skip empty lines
              while (i < endIdx && !ansLine) {
                i++;
                if (i < endIdx) ansLine = lines[i].trim();
              }
              if (ansLine && !isQuestionStart(ansLine) && !isSectionHeader(ansLine)) {
                // Clean answer text
                answer = ansLine.replace(/[（(]\s*注[：:].*$/, '').trim();
                // Remove parenthetical notes
                answer = answer.replace(/[（(][^)）]*注[^)）]*[)）]/g, '').trim();
              }
            }
          }
          i++;
          break;
        }

        // Check for option lines
        if (isOptionLine(ct)) {
          // Parse all 4 options from this line (they might be inline)
          // First check if options are fully inline like "A.xxx    B.xxx    C.xxx    D.xxx"
          const inlineMatch = ct.match(/^([A-E])\.\s*(.+)$/);
          if (inlineMatch) {
            const optLetter = inlineMatch[1];
            let optText = inlineMatch[2];

            // Check if the rest of the line has more options
            // Look for patterns like "    B." or "  B." to split
            const restOptions = optText.split(/\s{2,}(?=[A-E]\.)/);
            if (restOptions.length > 1) {
              // Multiple options on one line
              for (const part of restOptions) {
                const m = part.match(/^([A-E])\.\s*(.+)$/);
                if (m) {
                  options.push({ letter: m[1], text: m[2].trim() });
                  if (options.length >= 4) break; // Most questions have 4 options
                }
              }
            } else {
              // Single option on this line
              options.push({ letter: optLetter, text: optText.trim() });
            }
          }
          i++;
          continue;
        }

        // Regular text - could be continuation of question text or a split option
        // Check if this looks like a split option (single letter)
        if (/^[A-E]$/.test(ct)) {
          const optLetter = ct;
          i++;
          // Skip dots
          if (i < endIdx && lines[i].trim() === '.') i++;
          // Read option text
          let optText = '';
          while (i < endIdx) {
            const nl = lines[i].trim();
            if (!nl || isQuestionStart(nl) || isOptionLine(nl) || isAnswerLine(nl) || isSectionHeader(nl) || /^[A-E]$/.test(nl)) break;
            optText += nl;
            i++;
          }
          if (optText) {
            options.push({ letter: optLetter, text: optText.trim() });
          }
          continue;
        }

        // Otherwise it's part of the question text
        if (ct) {
          qText += ct;
        }
        i++;
      }

      // Clean up question text
      qText = qText.replace(/\s+/g, ' ').trim();
      // Remove trailing number artifacts
      qText = qText.replace(/^\d+\s*/, '').trim();

      if (qText && options.length > 0) {
        questions.push({
          id: questions.length + 1,
          originalNum: qNum,
          type: type,
          question: qText,
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

// Find section boundaries
function findSections() {
  const sections = [];
  for (let i = 0; i < allLines.length; i++) {
    const t = allLines[i].trim();
    if (t.includes('一、单选题') || t.includes('一、单项选择题')) {
      sections.push({ name: 'single', start: i });
    } else if (t.includes('二、多选题') || t.includes('二、多项选择题')) {
      sections.push({ name: 'multi', start: i });
    } else if (t.includes('三、判断题')) {
      sections.push({ name: 'judge', start: i });
    } else if (t.includes('其他需要重点掌握') || t.includes('四、简答') || t.includes('四、论述')) {
      sections.push({ name: 'essay', start: i });
    }
  }

  // Set end indices
  for (let i = 0; i < sections.length; i++) {
    if (i + 1 < sections.length) {
      sections[i].end = sections[i + 1].start;
    } else {
      sections[i].end = allLines.length;
    }
  }

  return sections;
}

const sections = findSections();
console.log('Sections found:', sections.map(s => `${s.name}: ${s.start}-${s.end}`));

// Parse each section
let singleChoice = [];
let multiChoice = [];
let judgeQuestions = [];
let essayQuestions = [];

for (const sec of sections) {
  if (sec.name === 'single') {
    singleChoice = parseQuestions(allLines, sec.start, sec.end, 'single');
    console.log(`Parsed ${singleChoice.length} single-choice questions`);
  } else if (sec.name === 'multi') {
    multiChoice = parseQuestions(allLines, sec.start, sec.end, 'multi');
    console.log(`Parsed ${multiChoice.length} multiple-choice questions`);
  } else if (sec.name === 'judge') {
    judgeQuestions = parseQuestions(allLines, sec.start, sec.end, 'judge');
    console.log(`Parsed ${judgeQuestions.length} true/false questions`);
  } else if (sec.name === 'essay') {
    // Parse essay questions
    const lines = allLines.slice(sec.start, sec.end);
    for (const line of lines) {
      const t = line.trim();
      const m = t.match(/^(\d{1,2})[\.、]\s*(.+)/);
      if (m && t.length > 5) {
        essayQuestions.push({
          id: essayQuestions.length + 1,
          num: parseInt(m[1]),
          question: m[2].trim()
        });
      }
    }
    console.log(`Parsed ${essayQuestions.length} essay questions`);
  }
}

// Validate
console.log('\n--- Validation ---');
console.log('Single choice without answers:', singleChoice.filter(q => !q.answer).length);
console.log('Multi choice without answers:', multiChoice.filter(q => !q.answer).length);
console.log('Judge without answers:', judgeQuestions.filter(q => !q.answer).length);

// Print some samples to verify
console.log('\n--- Sample single choice ---');
console.log(JSON.stringify(singleChoice[0], null, 2));
console.log('\n--- Sample multi choice ---');
console.log(JSON.stringify(multiChoice[0], null, 2));
console.log('\n--- Sample judge ---');
console.log(JSON.stringify(judgeQuestions[0], null, 2));
console.log('\n--- Sample essay ---');
console.log(JSON.stringify(essayQuestions[0], null, 2));

// Print last few single choice questions
console.log('\n--- Last single choice ---');
console.log(JSON.stringify(singleChoice[singleChoice.length - 1], null, 2));
console.log('\n--- Last multi choice ---');
console.log(JSON.stringify(multiChoice[multiChoice.length - 1], null, 2));

// Save parsed data to JSON
const output = {
  singleChoice,
  multiChoice,
  judgeQuestions,
  essayQuestions
};

fs.writeFileSync('questions.json', JSON.stringify(output, null, 2), 'utf8');
console.log('\nSaved to questions.json');
console.log(`Total: ${singleChoice.length} single, ${multiChoice.length} multi, ${judgeQuestions.length} judge, ${essayQuestions.length} essay`);
