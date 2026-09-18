/**
 * build_v3.js — 基于工作正常的 demo.html 直接修改生成增强版
 * 策略：读取 demo.html → 在关键位置插入新代码 → 输出 demo_v2.html
 */
const fs = require('fs');

// 1. 读取 demo.html
let html = fs.readFileSync('demo.html', 'utf8');
console.log('读取 demo.html:', html.length, 'bytes');

// 2. 读取 explanations.js 并准备数据
let explanationsData = { single: {}, multi: {}, judge: {} };
try {
  const expRaw = fs.readFileSync('explanations.js', 'utf8');
  const fn = new Function(expRaw.replace('const explanations = ', 'return ') + '; return explanations;');
  explanationsData = fn();
  for (const k of ['single', 'multi', 'judge']) {
    if (explanationsData[k]) {
      const fixed = {};
      for (const id in explanationsData[k]) fixed[String(id)] = explanationsData[k][id];
      explanationsData[k] = fixed;
    }
  }
} catch(e) { console.warn('explanations.js 加载失败:', e.message); }

// 3. 读取录音文件，提取教师强调（简化版）
const TEACHER_NOTES = {
  6: '\n\n🔴【教师强调】毛泽东思想的精髓是"实事求是"（4个字）；邓小平理论的精髓是"解放思想、实事求是"（8个字）。这是教师反复强调的高频考点。',
  14: '\n\n🔴【教师强调】实事求是是毛泽东思想的基本点和精髓。注意区分：毛泽东思想精髓=实事求是(4字)，邓小平理论精髓=解放思想、实事求是(8字)。',
  60: '\n\n🔴【教师强调】邓小平理论的精髓是"解放思想、实事求是"（8个字）。教师反复强调与毛泽东思想精髓（实事求是4个字）的区别。',
  75: '\n\n🔴【教师强调】贯彻"三个代表"重要思想——关键在坚持与时俱进、核心在坚持党的先进性、本质在坚持执政为民。三句话对应关系不可混淆，考试常互换干扰。',
  76: '\n\n🔴【教师强调】贯彻"三个代表"重要思想——关键在坚持与时俱进、核心在坚持党的先进性、本质在坚持执政为民。核心是坚持党的先进性。',
  77: '\n\n🔴【教师强调】贯彻"三个代表"重要思想——关键在坚持与时俱进、核心在坚持党的先进性、本质在坚持执政为民。本质是坚持执政为民。',
  58: '\n\n🔴【教师强调】邓小平理论首要的基本理论问题是"什么是社会主义、怎样建设社会主义"。各理论成果回答的主题不同：邓小平→什么是社会主义，三个代表→建设什么样的党，科学发展观→实现什么样的发展。',
  53: '\n\n🔴【教师强调】各理论成果回答的核心问题不同：邓小平理论→什么是社会主义、怎样建设社会主义；三个代表→建设什么样的党、怎样建设党；科学发展观→实现什么样的发展、怎样发展。',
  4: '\n\n🔴【教师强调】毛泽东思想科学内涵=①马列主义在中国的运用和发展 ②被实践证明的关于中国革命和建设的正确理论原则和经验总结 ③中国共产党集体智慧的结晶。≠毛泽东个人的全部思想。',
  17: '\n\n🔴【教师强调】马克思主义中国化时代化第一个重大理论成果是毛泽东思想，最新理论成果是习近平新时代中国特色社会主义思想。',
  29: '\n\n🔴【教师强调】三大法宝=统一战线+武装斗争+党的建设，出自《〈共产党人〉发刊词》(1939年)。注意与"活的灵魂"(实事求是+群众路线+独立自主)区分。',
  6: '\n\n🔴【教师强调】理论成果关系是"一脉相承又与时俱进"。实事求是是精髓，独立自主是灵魂组成部分，精益求精是工作态度而非理论关系。',
  20: '\n\n🔴【教师强调】中国革命的首要对象是帝国主义（最凶恶的敌人）。三座大山=帝国主义+封建主义+官僚资本主义。民族资产阶级不是革命对象，是革命动力。',
};

// 为解析添加教师强调标注
for (const type of ['single', 'multi', 'judge']) {
  for (const [id, note] of Object.entries(TEACHER_NOTES)) {
    if (explanationsData[type][id] && !explanationsData[type][id].includes('【教师强调】')) {
      explanationsData[type][id] += note;
    }
  }
}

// 4. 构建 EXPLANATIONS JSON
const EXPLANATIONS_JSON = JSON.stringify(explanationsData);

// 5. 在 DATA 定义之后插入 EXPLANATIONS 定义
// demo.html 中 DATA 定义在 const DATA = ...; 之后
const dataEndMarker = "DATA.judgeQuestions = decorate(DATA.judgeQuestions, 'judge');";
const insertAfterData = `DATA.judgeQuestions = decorate(DATA.judgeQuestions, 'judge');

// ===== EXPLANATIONS DATA (NEW) =====
const EXPLANATIONS = ${EXPLANATIONS_JSON};

// ===== PER-QUESTION STATS STORAGE (NEW - 错题本数据) =====
const STATS_KEY = 'maogai_stats_v5';
function makeDefaultStats() {
  const stats = { single: {}, multi: {}, judge: {} };
  for (const q of DATA.singleChoice) stats.single[q.id] = { attempts: 0, correct: 0, wrong: 0, lastResult: null };
  for (const q of DATA.multiChoice) stats.multi[q.id] = { attempts: 0, correct: 0, wrong: 0, lastResult: null };
  for (const q of DATA.judgeQuestions) stats.judge[q.id] = { attempts: 0, correct: 0, wrong: 0, lastResult: null };
  return stats;
}
function loadStats() {
  try { const raw = localStorage.getItem(STATS_KEY); if (!raw) return makeDefaultStats();
    const parsed = JSON.parse(raw); const def = makeDefaultStats();
    for (const type of ['single','multi','judge']) { if (!parsed[type]) { parsed[type] = def[type]; continue; }
      for (const id of Object.keys(def[type])) { if (!parsed[type][id]) parsed[type][id] = def[type][id]; } }
    return parsed; } catch(e) { return makeDefaultStats(); }
}
let questionStats = loadStats();
function saveStats() { localStorage.setItem(STATS_KEY, JSON.stringify(questionStats)); }
function recordAnswer(q, isCorrect) {
  const type = q.type, id = q.id;
  if (!questionStats[type] || !questionStats[type][id]) return;
  questionStats[type][id].attempts++;
  if (isCorrect) questionStats[type][id].correct++; else questionStats[type][id].wrong++;
  questionStats[type][id].lastResult = isCorrect ? 'correct' : 'wrong';
  saveStats();
}
function getCorrectnessRate(q) {
  const type = q.type, id = q.id;
  if (!questionStats[type] || !questionStats[type][id]) return null;
  const s = questionStats[type][id]; if (s.attempts === 0) return null;
  return Math.round(s.correct / s.attempts * 100);
}
function getExplanation(q) {
  const expMap = EXPLANATIONS[q.type]; if (!expMap) return null;
  return expMap[String(q.id)] || null;
}`;

html = html.replace(dataEndMarker, insertAfterData);

// 6. 在渲染函数中修改 renderQuestionCard 以显示解析
// 找到 "const typeLabel = isMulti ? '多选题' : (isJudge ? '判断题' : '单选题');"
// 在其之前在 feedbackHtml 和 actionHtml 之间添加 explanationHtml

const feedbackEnd = `if (revealed) {
    feedbackHtml = '<div class="feedback no show">👀 已显示答案</div>' +
      '<div class="answer-reveal show">正确答案：<strong>' + q.answer + '</strong></div>';
  }`;

const feedbackEndWithExp = `if (revealed) {
    feedbackHtml = '<div class="feedback no show">👀 已显示答案</div>' +
      '<div class="answer-reveal show">正确答案：<strong>' + q.answer + '</strong></div>';
  }

  // ★ NEW: 构建解析HTML（答题后/显示答案后展示）
  let explanationHtml = '';
  if (answered || revealed) {
    const exp = getExplanation(q);
    if (exp) {
      const rate = getCorrectnessRate(q);
      let rateHtml = '';
      if (rate !== null) {
        const rc = rate >= 80 ? 'var(--success)' : (rate >= 50 ? '#f59e0b' : 'var(--error)');
        rateHtml = '<span style="font-size:0.78rem;font-weight:600;color:' + rc + ';margin-left:8px;">\\u{1F4CA} 本题正确率：' + rate + '%（' + questionStats[q.type][q.id].attempts + '次作答）</span>';
      }
      let formattedExp = exp
        .replace(/【答案】/g, '<strong style=\"color:var(--primary);\">【答案】</strong>')
        .replace(/【解析】/g, '<strong style=\"color:#0ea5e9;\">【解析】</strong>');
      if (formattedExp.indexOf('【教师强调】') !== -1) {
        formattedExp = formattedExp.replace(/🔴【教师强调】([\\s\\S]*?)$/gm, '<span style=\"display:inline-block;margin-top:10px;padding:10px 14px;background:#fef2f2;border-radius:6px;border:1px dashed #f87171;font-size:0.82rem;color:#991b1b;\">\\u{1F534}<strong>【教师强调】</strong>$1</span>');
      }
      explanationHtml = '<div class=\"explanation-box show\" style=\"margin-top:14px;padding:16px 18px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:8px;border-left:4px solid #0ea5e9;font-size:0.88rem;line-height:1.8;white-space:pre-line;color:#1e3a5f;animation:slideIn 0.35s ease;\">' +
        '<span style=\"display:inline-block;background:#0ea5e9;color:white;font-size:0.72rem;font-weight:700;padding:2px 10px;border-radius:12px;margin-bottom:10px;\">\\u{1F4D6} 解析</span>' + rateHtml + formattedExp + '</div>';
    }
  }`;

html = html.replace(feedbackEnd, feedbackEndWithExp);

// 7. 在 renderQuestionCard 的返回 HTML 中添加 explanationHtml
const actionHtmlLine = "const actionHtml = opts.showActions === false ? '' : (";
const actionHtmlWithExp = "const actionHtml = opts.showActions === false ? '' : (\n" +
  "    // ★ 包含解析\n" +
  "    (explanationHtml || '') +";

html = html.replace(actionHtmlLine, actionHtmlWithExp);

// 8. 修改 doSubmit 函数以记录统计
const doSubmitOld = "modeState.answers[currentQ.key] = ans;\n  saveState();\n  render();";
const doSubmitNew = `modeState.answers[currentQ.key] = ans;
  // ★ 记录统计数据
  recordAnswer(currentQ, isCorrectAnswer(currentQ, ans));
  saveState();
  render();`;
html = html.replace(doSubmitOld, doSubmitNew);

// 9. 修改 updateGlobalStats 函数末尾，添加错题本badge更新
const updateStatsEnd = "document.getElementById('totalDone').textContent = done;\n}";
const updateStatsEndNew = `document.getElementById('totalDone').textContent = done;
  // ★ 更新错题本badge
  let totalMistakes = 0;
  for (const type of ['single', 'multi', 'judge']) {
    for (const id in questionStats[type]) {
      const s = questionStats[type][id];
      if (s.attempts > 0 && s.wrong > 0) totalMistakes++;
    }
  }
  const mb = document.getElementById('mistakeBadge'); if (mb) mb.textContent = totalMistakes;
  const mbM = document.getElementById('mistakeBadgeM'); if (mbM) mbM.textContent = totalMistakes;
}`;
html = html.replace(updateStatsEnd, updateStatsEndNew);

// 10. 在 render 函数中添加 mistake 模式
const renderExamMode = "} else if (mode === 'exam') {";
const renderWithMistake = `} else if (mode === 'mistake') {
    // ★ 错题本模式
    mainEl.innerHTML = renderMistakeBook();
    bindMistakeEvents();
  } else if (mode === 'exam') {`;
html = html.replace(renderExamMode, renderWithMistake);

// 11. 在 makeDefaultState 中添加 mistake 状态
const defaultStateLine = "exam: { currentIndex: 0, answers: {}, revealed: {}, cardOpen: true, questions: null }";
const defaultStateWithMistake = "exam: { currentIndex: 0, answers: {}, revealed: {}, cardOpen: true, questions: null },\n    mistake: { filterType: 'all', sortBy: 'rate' }";
html = html.replace(defaultStateLine, defaultStateWithMistake);

// 12. 在 PC NAV 中添加错题本标签（在考试模式之后）
const examNavTab = '<button class="nav-tab" data-mode="exam">🧪 考试模式<span class="badge">44</span></button>';
const examNavWithMistake = '<button class="nav-tab" data-mode="exam">🧪 考试模式<span class="badge">44</span></button>\n' +
  '    <button class="nav-tab mistake-tab" data-mode="mistake">📒 错题本<span class="badge" id="mistakeBadge">0</span></button>';
html = html.replace(examNavTab, examNavWithMistake);

// 13. 在 MOBILE NAV 中添加错题本标签
const mobileExamTab = '<button class="mobile-nav-tab" data-mode="exam">';
const mobileExamWithMistake = '<button class="mobile-nav-tab" data-mode="exam">\n' +
  '      <span class="tab-icon">🧪</span><span class="tab-label">考试</span><span class="tab-badge">44</span>\n' +
  '    </button>\n' +
  '    <button class="mobile-nav-tab mistake-tab" data-mode="mistake">\n' +
  '      <span class="tab-icon">📒</span><span class="tab-label">错题本</span><span class="tab-badge" id="mistakeBadgeM">0</span>\n' +
  '    </button>';
html = html.replace(mobileExamTab, mobileExamWithMistake);

// 14. 在 CSS 中添加 dark mode 的 answer card 修复 + mistake tab 样式
const darkModeCSS = `  .mobile-bottom-nav { background: #1e293b; border-top-color: #334155; }
  .mobile-action-bar { background: #1e293b; border-top-color: #334155; }
  .btn-outline { background: #1e293b; }
  .order-toggle-bar { background: #1e293b; }
  .order-toggle-btn { background: #1e293b; }`;

const darkModeCSSFixed = `  .mobile-bottom-nav { background: #1e293b; border-top-color: #334155; }
  .mobile-action-bar { background: #1e293b; border-top-color: #334155; }
  .btn-outline { background: #1e293b; }
  .order-toggle-bar { background: #1e293b; }
  .order-toggle-btn { background: #1e293b; }
  .answer-item { background: #1e293b; color: #f1f5f9; border-color: #475569; }
  .answer-item:hover { border-color: var(--primary); }
  .answer-item.correct { background: var(--success-light); color: var(--success); border-color: var(--success); }
  .answer-item.wrong { background: var(--error-light); color: var(--error); border-color: var(--error); }
  .answer-item.revealed { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }
  .answer-item.unanswered { background: #334155; color: #94a3b8; }
  .answer-item.current { outline-color: var(--primary); }
  .mistake-item { background: #1e293b; }
  .mistake-item:hover { background: #1e1b4b; }
  .explanation-box { background: linear-gradient(135deg,#0c1929,#0f2847) !important; border-left-color: #38bdf8 !important; color: #e2e8f0 !important; }`;

html = html.replace(darkModeCSS, darkModeCSSFixed);

// 15. 在 </style> 前添加 mobile mistake-tab 样式
const styleEnd = `body.is-mobile .essay-btn-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }`;
const styleEndWithMistake = `body.is-mobile .essay-btn-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
body.is-mobile .mistake-item { padding: 12px 14px; }
body.is-mobile .explanation-box { font-size: 0.82rem !important; padding: 12px 14px !important; }
.nav-tab.mistake-tab { color: #dc2626; }
.nav-tab.mistake-tab.active { color: #dc2626; border-bottom-color: #dc2626; }
.nav-tab.mistake-tab .badge { background: #dc2626; }
.mobile-nav-tab.mistake-tab { color: #dc2626; }
.mobile-nav-tab.mistake-tab.active { color: #dc2626; border-top-color: #dc2626; }
.mistake-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.mistake-stat-card { background: var(--card-bg); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); text-align: center; }
.mistake-stat-card .stat-icon { font-size: 2rem; margin-bottom: 8px; }
.mistake-stat-card .stat-value { font-size: 2rem; font-weight: 800; color: var(--primary); }
.mistake-stat-card .stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }
.mistake-stat-card.wrong .stat-value { color: var(--error); }
.mistake-stat-card.rate .stat-value { color: #f59e0b; }
.mistake-filter { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; background: var(--card-bg); border-radius: var(--radius); padding: 10px 14px; box-shadow: var(--shadow); align-items: center; }
.mistake-filter-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
.mistake-filter-btn { padding: 6px 14px; border: 2px solid var(--border); border-radius: 20px; cursor: pointer; font-size: 0.8rem; font-weight: 500; background: var(--card-bg); color: var(--text-secondary); transition: var(--transition); }
.mistake-filter-btn:hover { border-color: var(--primary); color: var(--primary); }
.mistake-filter-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
.mistake-list { display: flex; flex-direction: column; gap: 10px; }
.mistake-item { background: var(--card-bg); border-radius: var(--radius); padding: 14px 18px; box-shadow: var(--shadow); border-left: 4px solid var(--border); transition: var(--transition); cursor: pointer; }
.mistake-item:hover { border-left-color: var(--primary); box-shadow: var(--shadow-md); }
.mistake-item.wrong { border-left-color: var(--error); }
.mistake-item.good { border-left-color: var(--success); }
.mistake-item .mi-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
.mistake-item .mi-type { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
.mistake-item .mi-question { font-size: 0.9rem; line-height: 1.6; color: var(--text); }
.mistake-item .mi-stats { display: flex; gap: 16px; font-size: 0.78rem; color: var(--text-secondary); margin-top: 8px; flex-wrap: wrap; }
.mistake-item .mi-stats .rate-low { color: var(--error); font-weight: 700; }
.mistake-item .mi-stats .rate-mid { color: #f59e0b; font-weight: 700; }
.mistake-item .mi-stats .rate-high { color: var(--success); font-weight: 700; }
.mistake-item .mi-answer { font-size: 0.82rem; color: var(--text-secondary); margin-top: 6px; }
body.is-mobile .mistake-summary { grid-template-columns: repeat(2, 1fr); gap: 8px; }
body.is-mobile .mistake-stat-card { padding: 12px 8px; }
body.is-mobile .mistake-stat-card .stat-value { font-size: 1.5rem; }`;

html = html.replace(styleEnd, styleEndWithMistake);

// 16. 在 render() 函数之前插入 renderMistakeBook 和 bindMistakeEvents 函数
const renderExamAnswerCardFn = "function genExamQuestions() {";
const mistakeFunctions = `// ===== MISTAKE BOOK (NEW) =====
function renderMistakeBook() {
  const filterType = state.mistake?.filterType || 'all';
  const sortBy = state.mistake?.sortBy || 'rate';
  let allItems = [];
  const types = filterType === 'all' ? ['single', 'multi', 'judge'] : [filterType];
  for (const type of types) {
    const qList = type === 'single' ? DATA.singleChoice : type === 'multi' ? DATA.multiChoice : DATA.judgeQuestions;
    for (const q of qList) {
      const s = questionStats[type]?.[q.id];
      if (s && s.attempts > 0) {
        allItems.push({ q, type, rate: Math.round(s.correct / s.attempts * 100), attempts: s.attempts, correct: s.correct, wrong: s.wrong, lastResult: s.lastResult });
      }
    }
  }
  if (sortBy === 'rate') allItems.sort((a, b) => a.rate - b.rate);
  else if (sortBy === 'attempts') allItems.sort((a, b) => b.attempts - a.attempts);
  else if (sortBy === 'recent') allItems.sort((a, b) => { if (a.lastResult !== b.lastResult) return a.lastResult === 'wrong' ? -1 : 1; return a.rate - b.rate; });
  const totalAttempts = allItems.reduce((s, i) => s + i.attempts, 0);
  const totalCorrect = allItems.reduce((s, i) => s + i.correct, 0);
  const overallRate = totalAttempts > 0 ? Math.round(totalCorrect / totalAttempts * 100) : 0;
  const mistakeCount = allItems.filter(i => i.wrong > 0).length;
  let html = '<div class="mistake-book">';
  html += '<div class="mistake-summary">' +
    '<div class="mistake-stat-card"><div class="stat-icon">📊</div><div class="stat-value">' + allItems.length + '</div><div class="stat-label">已做题数</div></div>' +
    '<div class="mistake-stat-card wrong"><div class="stat-icon">❌</div><div class="stat-value">' + mistakeCount + '</div><div class="stat-label">错题数</div></div>' +
    '<div class="mistake-stat-card rate"><div class="stat-icon">🎯</div><div class="stat-value">' + overallRate + '%</div><div class="stat-label">总正确率</div></div>' +
    '<div class="mistake-stat-card"><div class="stat-icon">📝</div><div class="stat-value">' + totalAttempts + '</div><div class="stat-label">总作答次数</div></div>' +
  '</div>';
  html += '<div class="mistake-filter"><span class="mistake-filter-label">题型：</span>' +
    '<button class="mistake-filter-btn' + (filterType === 'all' ? ' active' : '') + '" data-filter="all">全部</button>' +
    '<button class="mistake-filter-btn' + (filterType === 'single' ? ' active' : '') + '" data-filter="single">单选题</button>' +
    '<button class="mistake-filter-btn' + (filterType === 'multi' ? ' active' : '') + '" data-filter="multi">多选题</button>' +
    '<button class="mistake-filter-btn' + (filterType === 'judge' ? ' active' : '') + '" data-filter="judge">判断题</button>' +
    '<span class="mistake-filter-label" style="margin-left:12px;">排序：</span>' +
    '<button class="mistake-filter-btn' + (sortBy === 'rate' ? ' active' : '') + '" data-sort="rate">正确率↑</button>' +
    '<button class="mistake-filter-btn' + (sortBy === 'recent' ? ' active' : '') + '" data-sort="recent">最近错题</button>' +
    '<button class="mistake-filter-btn' + (sortBy === 'attempts' ? ' active' : '') + '" data-sort="attempts">作答次数</button>' +
  '</div>';
  if (allItems.length === 0) {
    html += '<div class="empty-state" style="text-align:center;padding:60px 20px;"><div style="font-size:3rem;margin-bottom:12px;">📒</div><h3>暂无答题记录</h3><p style="color:var(--text-secondary);">开始做题后，错题本将自动统计每道题的正确率</p></div>';
  } else {
    html += '<div class="mistake-list">';
    for (const item of allItems) {
      const typeLabel = item.type === 'single' ? '单选题' : item.type === 'multi' ? '多选题' : '判断题';
      const typeClass = item.type;
      const rateClass = item.rate >= 80 ? 'rate-high' : (item.rate >= 50 ? 'rate-mid' : 'rate-low');
      const correctAnswer = item.type === 'multi' ? item.q.answer.split('').sort().join('') : item.q.answer;
      html += '<div class="mistake-item ' + (item.wrong > 0 ? 'wrong' : 'good') + '" data-goto="' + item.type + '" data-goto-id="' + item.q.id + '">' +
        '<div class="mi-header"><span class="mi-type q-type ' + typeClass + '">' + typeLabel + ' #' + item.q.originalNum + '</span><span class="' + rateClass + '" style="font-weight:700;font-size:0.9rem;">' + item.rate + '%</span></div>' +
        '<div class="mi-question">' + item.q.question + '</div>' +
        '<div class="mi-answer">✅ 正确答案：<strong>' + correctAnswer + '</strong></div>' +
        '<div class="mi-stats"><span>📝 作答 ' + item.attempts + ' 次</span><span>✅ ' + item.correct + ' 次</span><span>❌ ' + item.wrong + ' 次</span><span>📌 最近：<strong>' + (item.lastResult === 'correct' ? '✅ 正确' : '❌ 错误') + '</strong></span></div>' +
      '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  html += '<div class="reset-area" style="margin-top:14px;"><button class="btn-reset" id="btnResetStats">🔄 重置统计数据</button><button class="btn-reset" id="btnResetAll">🗑 清除全部记录</button></div>';
  return html;
}

function bindMistakeEvents() {
  document.querySelectorAll('.mistake-filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => { if (!state.mistake) state.mistake = {}; state.mistake.filterType = btn.dataset.filter; saveState(); render(); });
  });
  document.querySelectorAll('.mistake-filter-btn[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => { if (!state.mistake) state.mistake = {}; state.mistake.sortBy = btn.dataset.sort; saveState(); render(); });
  });
  document.querySelectorAll('.mistake-item[data-goto]').forEach(item => {
    item.addEventListener('click', () => {
      const targetMode = item.dataset.goto;
      const targetId = parseInt(item.dataset.gotoId, 10);
      if (!targetMode || isNaN(targetId)) return;
      state.currentMode = targetMode;
      const modeState = state[targetMode];
      const questions = getModeQuestions(targetMode);
      const idx = questions.findIndex(q => q.id === targetId);
      if (idx >= 0) { modeState.currentIndex = idx; modeState.orderMode = 'seq'; }
      saveState(); render();
    });
  });
  document.getElementById('btnResetStats')?.addEventListener('click', () => { if (!confirm('重置所有题目统计数据？这将清除正确率记录。')) return; questionStats = makeDefaultStats(); saveStats(); render(); });
  document.getElementById('btnResetAll')?.addEventListener('click', () => { if (!confirm('清除全部答题记录和统计数据？')) return; localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STATS_KEY); state = loadState(); questionStats = loadStats(); render(); });
}

function genExamQuestions() {`;

html = html.replace(renderExamAnswerCardFn, mistakeFunctions);

// 17. 输出
fs.writeFileSync('demo_v2.html', html, 'utf8');
console.log('✅ demo_v2.html 已生成！');
console.log('   策略：基于 demo.html 直接修改');
console.log('   新增：错题本系统 + 解析显示 + 教师强调标注 + 暗色模式修复');
