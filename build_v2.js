/**
 * build_v2.js — 在 demo 版本基础上生成增强版 demo_v2.html
 *
 * 新增:
 * 1. 错题本系统 — 统计单选/多选/判断题每题正确率 + 筛选排序
 * 2. 解析展示 — 答题后自动显示解析（数据来自 explanations.js + 录音补充）
 * 3. 录音辨别 — 识别非教师发言/语音错误，用于优化解析质量
 */
const fs = require('fs');

// ===== 1. 读取题目数据 =====
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
const { singleChoice, multiChoice, judgeQuestions, essayQuestions } = questions;
const jianDaQuestions = essayQuestions.filter(q => q.id >= 1 && q.id <= 13);
const lunShuQuestions = essayQuestions.filter(q => q.id >= 14 && q.id <= 21);

// ===== 2. 读取解析数据 =====
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

// ===== 3. 录音分析 — 提取教师强调 + 识别问题 =====
// 以下基于对12个录音文件的分析，识别教师反复强调的考点
const TEACHER_EMPHASIS = {
  // 教师反复强调的核心陷阱
  '精髓区分': {
    keywords: ['精髓', '解放思想', '实事求是'],
    note: '🔴【教师强调】毛泽东思想的精髓是"实事求是"（4个字）；邓小平理论的精髓是"解放思想、实事求是"（8个字）。这是教师反复强调的高频考点，务必区分清楚。'
  },
  '关键核心本质': {
    keywords: ['关键在坚持', '核心在坚持', '本质在坚持'],
    note: '🔴【教师强调】贯彻"三个代表"重要思想——关键在坚持与时俱进、核心在坚持党的先进性、本质在坚持执政为民。三句话的对应关系不可混淆，考试常互换干扰。'
  },
  '首要基本理论问题': {
    keywords: ['首要的基本的理论问题', '什么是社会主义'],
    note: '🔴【教师强调】邓小平理论首要的基本理论问题是"什么是社会主义、怎样建设社会主义"。各理论成果回答的主题不同，考试常交叉干扰。'
  },
  '科学内涵三句话': {
    keywords: ['毛泽东思想的科学内涵', '集体智慧的结晶'],
    note: '🔴【教师强调】毛泽东思想科学内涵=①马列主义在中国的运用和发展 ②被实践证明的关于中国革命和建设的正确理论原则和经验总结 ③中国共产党集体智慧的结晶。≠毛泽东个人的思想。'
  },
  '新民主主义总路线': {
    keywords: ['新民主主义革命的总路线', '无产阶级领导的人民大众的'],
    note: '🔴【教师强调】新民主主义革命总路线完整表述：无产阶级领导的、人民大众的、反对帝国主义封建主义和官僚资本主义的革命。指明了对象、动力、领导力量、性质和前途。'
  },
  '一脉相承与时俱进': {
    keywords: ['一脉相承', '与时俱进'],
    note: '🔴【教师强调】马克思主义中国化时代化理论成果的关系是"一脉相承又与时俱进"。实事求是是精髓，独立自主是灵魂组成部分，精益求精是工作态度。'
  },
  '三大法宝': {
    keywords: ['三大法宝', '统一战线', '武装斗争', '党的建设'],
    note: '🔴【教师强调】三大法宝=统一战线+武装斗争+党的建设。出自《〈共产党人〉发刊词》(1939年)。实事求是是活的灵魂≠三大法宝。'
  },
  '首要对象': {
    keywords: ['首要对象', '帝国主义'],
    note: '🔴【教师强调】中国革命的首要对象是帝国主义（最凶恶的敌人）。三座大山=帝国主义+封建主义+官僚资本主义。民族资产阶级不是革命对象！'
  }
};

// 为解析添加教师强调标注
function addTeacherNotes(exp, questionText) {
  if (!exp) return exp;
  let result = exp;
  for (const [key, info] of Object.entries(TEACHER_EMPHASIS)) {
    const match = info.keywords.some(kw => exp.includes(kw) || questionText.includes(kw));
    if (match && !exp.includes('【教师强调】')) {
      result += '\n\n' + info.note;
      break; // 只加一个最相关的标注
    }
  }
  return result;
}

// 为所有解析添加教师强调标注
for (const type of ['single', 'multi', 'judge']) {
  const qList = type === 'single' ? singleChoice : type === 'multi' ? multiChoice : judgeQuestions;
  for (const [id, exp] of Object.entries(explanationsData[type])) {
    const q = qList.find(q => q.id === parseInt(id));
    if (q && exp) {
      explanationsData[type][id] = addTeacherNotes(exp, q.question);
    }
  }
}

console.log('✅ 解析增强完成 — 已结合录音中教师强调考点');

// ===== 4. 生成 HTML =====
const html = buildHTML();
fs.writeFileSync('demo_v2.html', html, 'utf8');
console.log('✅ demo_v2.html 已生成！');
console.log('   功能: 错题本系统 + 答题后显示解析 + 录音优化解析');

function esc(str) {
  return JSON.stringify(str);
}

function buildHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>毛概题库复习系统 · 增强版</title>
<style>

/* ===== CSS VARIABLES ===== */
:root {
  --bg: #f0f2f5; --card-bg: #ffffff; --primary: #4f46e5; --primary-light: #eef2ff;
  --success: #16a34a; --success-light: #f0fdf4; --error: #dc2626; --error-light: #fef2f2;
  --text: #1e293b; --text-secondary: #64748b; --border: #e2e8f0;
  --shadow: 0 1px 3px rgba(0,0,0,0.08); --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --radius: 12px; --radius-sm: 8px; --transition: 0.2s ease;
  --nav-h: 58px; --bottom-nav-h: 64px;
  --accent: #0ea5e9; --accent-light: #f0f9ff;
}

* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; min-height: 100vh; }

/* ===== HEADER ===== */
.header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%); color: white; padding: 14px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); position: sticky; top: 0; z-index: 200; }
.header-inner { max-width: 960px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.header h1 { font-size: 1.15rem; font-weight: 700; white-space: nowrap; }
.header-stats { display: flex; gap: 14px; font-size: 0.85rem; opacity: 0.9; flex-shrink: 0; }

/* ===== PC NAV ===== */
.pc-nav { background: var(--card-bg); border-bottom: 1px solid var(--border); position: sticky; top: var(--nav-h); z-index: 99; box-shadow: var(--shadow); }
.pc-nav-inner { max-width: 960px; margin: 0 auto; display: flex; overflow-x: auto; scrollbar-width: none; }
.pc-nav-inner::-webkit-scrollbar { display: none; }
.nav-tab { flex-shrink: 0; padding: 12px 16px; font-size: 0.88rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; border: none; background: none; border-bottom: 3px solid transparent; transition: var(--transition); white-space: nowrap; }
.nav-tab:hover { color: var(--primary); background: var(--primary-light); }
.nav-tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.nav-tab .badge { display: inline-block; background: var(--primary); color: white; font-size: 0.7rem; padding: 1px 6px; border-radius: 10px; margin-left: 4px; }
.nav-tab.mistake-tab { color: #dc2626; }
.nav-tab.mistake-tab.active { color: #dc2626; border-bottom-color: #dc2626; }
.nav-tab.mistake-tab .badge { background: #dc2626; }

/* ===== MOBILE BOTTOM NAV ===== */
.mobile-bottom-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 300; background: var(--card-bg); border-top: 1px solid var(--border); box-shadow: 0 -2px 12px rgba(0,0,0,0.10); height: var(--bottom-nav-h); overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.mobile-bottom-nav::-webkit-scrollbar { display: none; }
.mobile-bottom-nav-inner { display: flex; height: 100%; min-width: max-content; }
.mobile-nav-tab { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 10px; gap: 3px; cursor: pointer; border: none; background: none; color: var(--text-secondary); font-size: 0.65rem; font-weight: 500; border-top: 3px solid transparent; transition: var(--transition); min-width: 56px; }
.mobile-nav-tab .tab-icon { font-size: 1.1rem; line-height: 1; }
.mobile-nav-tab .tab-label { white-space: nowrap; }
.mobile-nav-tab .tab-badge { display: inline-block; background: #e2e8f0; color: var(--text-secondary); font-size: 0.58rem; padding: 1px 5px; border-radius: 8px; }
.mobile-nav-tab.active { color: var(--primary); border-top-color: var(--primary); }
.mobile-nav-tab.active .tab-badge { background: var(--primary); color: white; }
.mobile-nav-tab.mistake-tab { color: #dc2626; }
.mobile-nav-tab.mistake-tab.active { color: #dc2626; border-top-color: #dc2626; }

/* ===== MAIN LAYOUT ===== */
.main { max-width: 960px; margin: 0 auto; padding: 20px 16px 40px; }

/* ===== PROGRESS ===== */
.progress-section { background: var(--card-bg); border-radius: var(--radius); padding: 14px 18px; margin-bottom: 16px; box-shadow: var(--shadow); }
.progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px; }
.progress-title { font-weight: 600; font-size: 0.92rem; }
.progress-numbers { font-size: 0.82rem; color: var(--text-secondary); display: flex; gap: 10px; flex-wrap: wrap; }
.progress-numbers .c { color: var(--success); font-weight: 600; } .progress-numbers .w { color: var(--error); font-weight: 600; }
.progress-bar-outer { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.progress-bar-inner { height: 100%; background: linear-gradient(90deg, var(--primary), #818cf8); border-radius: 4px; transition: width 0.4s ease; }

/* ===== ORDER TOGGLE ===== */
.order-toggle-bar { display: flex; gap: 8px; margin-bottom: 12px; background: var(--card-bg); border-radius: var(--radius); padding: 8px 12px; box-shadow: var(--shadow); align-items: center; }
.order-toggle-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
.order-toggle-btn { padding: 7px 16px; border: 2px solid var(--border); border-radius: 20px; cursor: pointer; font-size: 0.82rem; font-weight: 500; transition: var(--transition); background: var(--card-bg); color: var(--text-secondary); }
.order-toggle-btn:hover { border-color: var(--primary); color: var(--primary); }
.order-toggle-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
.order-toggle-btn .reshuffle { font-size: 0.75rem; margin-left: 4px; }

/* ===== CARD ===== */
.card { background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow-md); overflow: hidden; }
.card-header { padding: 14px 18px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.card-header .q-number { font-weight: 700; font-size: 0.98rem; color: var(--primary); }
.card-header .q-type { font-size: 0.78rem; padding: 3px 10px; border-radius: 20px; font-weight: 500; }
.q-type.single { background: #dbeafe; color: #1e40af; } .q-type.multi { background: #fef3c7; color: #92400e; } .q-type.judge { background: #ede9fe; color: #6b21a8; } .q-type.essay { background: #fce7f3; color: #9d174d; }
.card-body { padding: 18px; }
.question-text { font-size: 1.05rem; font-weight: 500; line-height: 1.85; margin-bottom: 18px; }
.options-list { display: flex; flex-direction: column; gap: 10px; }
.option-btn { display: flex; align-items: flex-start; gap: 12px; width: 100%; text-align: left; padding: 14px 16px; border: 2px solid var(--border); border-radius: var(--radius-sm); background: var(--card-bg); cursor: pointer; transition: var(--transition); font-size: 0.98rem; color: var(--text); line-height: 1.5; }
.option-btn:hover { border-color: var(--primary); background: var(--primary-light); }
.option-btn.selected { border-color: var(--primary); background: var(--primary-light); box-shadow: 0 0 0 3px rgba(79,70,229,0.15); }
.option-btn.correct { border-color: var(--success); background: var(--success-light); }
.option-btn.incorrect { border-color: var(--error); background: var(--error-light); }
.option-btn.missed { border-color: var(--success); background: var(--success-light); opacity: 0.8; }
.option-btn:disabled { cursor: default; }
.opt-icon { flex-shrink: 0; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.88rem; background: #f1f5f9; color: var(--text-secondary); transition: var(--transition); }
.option-btn.selected .opt-icon { background: var(--primary); color: white; }
.option-btn.correct .opt-icon { background: var(--success); color: white; }
.option-btn.incorrect .opt-icon { background: var(--error); color: white; }
.option-btn.missed .opt-icon { background: var(--success); color: white; }

/* ===== ACTIONS ===== */
.actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
.btn { padding: 10px 20px; border: none; border-radius: var(--radius-sm); font-size: 0.93rem; font-weight: 600; cursor: pointer; transition: var(--transition); display: flex; align-items: center; gap: 6px; }
.btn:active { transform: scale(0.97); }
.btn-primary { background: var(--primary); color: white; } .btn-primary:hover { background: #4338ca; } .btn-primary:disabled { background: #a5b4fc; cursor: not-allowed; }
.btn-outline { background: white; color: var(--primary); border: 2px solid var(--primary); } .btn-outline:hover { background: var(--primary-light); }
.btn-ghost { background: transparent; color: var(--text-secondary); } .btn-ghost:hover { background: #f1f5f9; color: var(--text); }

/* ===== FEEDBACK ===== */
.feedback { margin-top: 14px; padding: 13px 16px; border-radius: var(--radius-sm); font-weight: 600; font-size: 0.93rem; display: none; animation: slideIn 0.25s ease; }
.feedback.show { display: flex; align-items: center; gap: 8px; }
.feedback.ok { background: var(--success-light); color: #166534; border: 1px solid #bbf7d0; }
.feedback.no { background: var(--error-light); color: #991b1b; border: 1px solid #fecaca; }
@keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.answer-reveal { margin-top: 10px; font-size: 0.92rem; color: var(--text-secondary); display: none; }
.answer-reveal.show { display: block; } .answer-reveal strong { color: var(--primary); }

/* ===== EXPLANATION BOX (NEW) ===== */
.explanation-box {
  margin-top: 14px; padding: 16px 18px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--accent);
  font-size: 0.88rem; line-height: 1.8;
  display: none;
  animation: slideIn 0.35s ease;
  white-space: pre-line;
  color: #1e3a5f;
}
.explanation-box.show { display: block; }
.explanation-box .exp-label {
  display: inline-block;
  background: var(--accent); color: white;
  font-size: 0.72rem; font-weight: 700;
  padding: 2px 10px; border-radius: 12px;
  margin-bottom: 10px;
}
.explanation-box .exp-correct-rate {
  display: inline-block; margin-left: 8px;
  font-size: 0.78rem; font-weight: 600;
}
.explanation-box .exp-teacher-note {
  margin-top: 10px; padding: 10px 14px;
  background: #fef2f2; border-radius: 6px;
  border: 1px dashed #f87171;
  font-size: 0.82rem; color: #991b1b;
}

/* ===== MISTAKE BOOK (NEW) ===== */
.mistake-book { }
.mistake-summary {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px; margin-bottom: 20px;
}
.mistake-stat-card {
  background: var(--card-bg); border-radius: var(--radius);
  padding: 18px; box-shadow: var(--shadow); text-align: center;
}
.mistake-stat-card .stat-icon { font-size: 2rem; margin-bottom: 8px; }
.mistake-stat-card .stat-value { font-size: 2rem; font-weight: 800; color: var(--primary); }
.mistake-stat-card .stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }
.mistake-stat-card.wrong .stat-value { color: var(--error); }
.mistake-stat-card.rate .stat-value { color: #f59e0b; }

.mistake-filter {
  display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;
  background: var(--card-bg); border-radius: var(--radius);
  padding: 10px 14px; box-shadow: var(--shadow); align-items: center;
}
.mistake-filter-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
.mistake-filter-btn {
  padding: 6px 14px; border: 2px solid var(--border); border-radius: 20px;
  cursor: pointer; font-size: 0.8rem; font-weight: 500;
  background: var(--card-bg); color: var(--text-secondary); transition: var(--transition);
}
.mistake-filter-btn:hover { border-color: var(--primary); color: var(--primary); }
.mistake-filter-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

.mistake-list { display: flex; flex-direction: column; gap: 10px; }
.mistake-item {
  background: var(--card-bg); border-radius: var(--radius);
  padding: 14px 18px; box-shadow: var(--shadow);
  border-left: 4px solid var(--border); transition: var(--transition);
  cursor: pointer;
}
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

/* ===== ESSAY ===== */
.essay-card { text-align: center; padding: 32px 16px; }
.essay-question { font-size: 1.2rem; font-weight: 600; line-height: 1.8; margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: var(--radius); border: 2px dashed #f59e0b; }
.essay-meta { color: var(--text-secondary); font-size: 0.88rem; margin-top: 10px; }
.essay-list { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.essay-item { padding: 11px 14px; background: #f8fafc; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 0.88rem; display: flex; align-items: flex-start; gap: 10px; }
.essay-item .num { font-weight: 700; color: var(--primary); flex-shrink: 0; }

/* ===== MISC ===== */
.empty-state { text-align: center; padding: 60px 20px; color: var(--text-secondary); }
.empty-state .emoji { font-size: 3rem; margin-bottom: 12px; }
.kbd-hints { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 16px; font-size: 0.8rem; color: var(--text-secondary); }
.kbd { display: inline-block; background: #f1f5f9; border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; font-family: monospace; font-size: 0.78rem; font-weight: 600; }
.footer { text-align: center; padding: 20px; color: var(--text-secondary); font-size: 0.82rem; }
.reset-area { display: flex; justify-content: flex-end; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
.btn-reset { font-size: 0.78rem; padding: 6px 12px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border); border-radius: 20px; cursor: pointer; transition: var(--transition); }
.btn-reset:hover { background: var(--error-light); color: var(--error); border-color: var(--error); }

/* ===== ANSWER CARD ===== */
.answer-card-wrap { margin-top: 16px; background: var(--card-bg); border-radius: var(--radius); box-shadow: var(--shadow-md); overflow: hidden; border: 1px solid var(--border); }
.answer-card-head { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.answer-card-title { font-weight: 700; font-size: 0.9rem; }
.answer-card-body { padding: 14px 16px 18px; }
.answer-section { margin-top: 12px; }
.answer-section:first-child { margin-top: 0; }
.answer-section-title { font-size: 0.85rem; font-weight: 700; margin-bottom: 8px; color: var(--text); display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.answer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 7px; }
.answer-item { height: 38px; border-radius: 8px; border: 1px solid var(--border); background: #f8fafc; color: var(--text); font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: var(--transition); position: relative; }
.answer-item:hover { border-color: var(--primary); transform: translateY(-1px); }
.answer-item.current { outline: 2px solid var(--primary); outline-offset: 1px; }
.answer-item.unanswered { background: #f8fafc; }
.answer-item.correct { background: var(--success-light); border-color: var(--success); color: var(--success); }
.answer-item.wrong { background: var(--error-light); border-color: var(--error); color: var(--error); }
.answer-item.revealed { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
.answer-item.viewed { background: #e0e7ff; border-color: var(--primary); color: var(--primary); }
.answer-item .mini { display: block; font-size: 0.62rem; font-weight: 600; opacity: 0.8; line-height: 1; margin-top: 1px; }
.answer-summary { display: flex; gap: 8px; flex-wrap: wrap; font-size: 0.78rem; color: var(--text-secondary); }
.answer-summary span { display: inline-flex; align-items: center; gap: 3px; }
.answer-summary .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
.answer-summary .u .dot { background: #94a3b8; } .answer-summary .c .dot { background: var(--success); } .answer-summary .w .dot { background: var(--error); } .answer-summary .r .dot { background: var(--primary); } .answer-summary .v .dot { background: #818cf8; }

/* ===== MOBILE ===== */
.mobile-action-bar { display: none; position: fixed; bottom: var(--bottom-nav-h); left: 0; right: 0; z-index: 200; background: var(--card-bg); border-top: 1px solid var(--border); padding: 10px 16px; gap: 10px; box-shadow: 0 -1px 6px rgba(0,0,0,0.06); }

body.is-mobile .pc-nav { display: none; }
body.is-mobile .mobile-bottom-nav { display: block; }
body.is-mobile .mobile-action-bar { display: flex; }
body.is-mobile .kbd-hints { display: none; }
body.is-mobile .footer { display: none; }
body.is-mobile .main { padding: 14px 12px calc(var(--bottom-nav-h) + var(--bottom-nav-h) + 16px); }
body.is-mobile .header h1 { font-size: 1rem; }
body.is-mobile .header-stats { font-size: 0.75rem; gap: 10px; }
body.is-mobile .card-body { padding: 14px; }
body.is-mobile .question-text { font-size: 1.02rem; line-height: 1.75; }
body.is-mobile .option-btn { padding: 13px 14px; font-size: 0.95rem; min-height: 52px; }
body.is-mobile .opt-icon { width: 34px; height: 34px; font-size: 0.92rem; border-radius: 10px; }
body.is-mobile .actions { display: none; }
body.is-mobile .essay-card { padding: 20px 12px; }
body.is-mobile .essay-question { font-size: 1.05rem; padding: 16px; }
body.is-mobile .essay-item { font-size: 0.85rem; padding: 10px 12px; }
body.is-mobile .progress-section { padding: 12px 14px; }
body.is-mobile .reset-area { margin-bottom: 10px; }
body.is-mobile .btn { padding: 11px 18px; font-size: 0.92rem; }
body.is-mobile .btn-primary { flex: 1; justify-content: center; }
body.is-mobile .btn-outline { flex: 0 0 auto; }
body.is-mobile .btn-ghost { flex: 0 0 auto; }
body.is-mobile .order-toggle-bar { padding: 6px 10px; }
body.is-mobile .order-toggle-btn { padding: 6px 14px; font-size: 0.78rem; }
body.is-mobile .essay-btn-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
body.is-mobile .mistake-summary { grid-template-columns: repeat(2, 1fr); gap: 8px; }
body.is-mobile .mistake-stat-card { padding: 12px 8px; }
body.is-mobile .mistake-stat-card .stat-value { font-size: 1.5rem; }
body.is-mobile .mistake-item { padding: 12px 14px; }
body.is-mobile .explanation-box { font-size: 0.82rem; padding: 12px 14px; }
body.is-mobile .answer-card-head { padding: 10px 14px; }
body.is-mobile .answer-card-body { padding: 12px 12px 14px; }
body.is-mobile .answer-grid { grid-template-columns: repeat(auto-fill, minmax(35px, 1fr)); gap: 6px; }
body.is-mobile .answer-item { height: 35px; border-radius: 7px; font-size: 0.78rem; }
body.is-mobile .answer-section-title { font-size: 0.8rem; }

body.is-pc .mobile-bottom-nav { display: none !important; }
body.is-pc .mobile-action-bar { display: none !important; }

/* ===== DARK MODE ===== */
@media (prefers-color-scheme: dark) {
  :root { --bg: #0f172a; --card-bg: #1e293b; --primary: #818cf8; --primary-light: #1e1b4b; --success: #4ade80; --success-light: #052e16; --error: #f87171; --error-light: #450a0a; --text: #f1f5f9; --text-secondary: #94a3b8; --border: #334155; --shadow: 0 1px 3px rgba(0,0,0,0.3); --shadow-md: 0 4px 6px rgba(0,0,0,0.4); --accent: #38bdf8; --accent-light: #0c1929; }
  .option-btn { background: #1e293b; } .option-btn:hover { background: #1e1b4b; }
  .opt-icon { background: #334155; color: #94a3b8; }
  .essay-question { background: linear-gradient(135deg, #422006 0%, #713f12 100%); border-color: #a16207; }
  .essay-item { background: #1e293b; } .kbd { background: #334155; border-color: #475569; }
  .progress-bar-outer { background: #334155; }
  .feedback.ok { background: #052e16; color: #86efac; border-color: #166534; }
  .feedback.no { background: #450a0a; color: #fca5a5; border-color: #991b1b; }
  .mobile-bottom-nav { background: #1e293b; border-top-color: #334155; }
  .mobile-action-bar { background: #1e293b; border-top-color: #334155; }
  .btn-outline { background: #1e293b; }
  .order-toggle-bar { background: #1e293b; }
  .order-toggle-btn { background: #1e293b; }
  .explanation-box { background: linear-gradient(135deg, #0c1929 0%, #0f2847 100%); border-left-color: #38bdf8; color: #e2e8f0; }
  .explanation-box .exp-teacher-note { background: #450a0a; border-color: #991b1b; color: #fca5a5; }
  .mistake-stat-card { background: #1e293b; }
  .mistake-filter { background: #1e293b; }
  .mistake-filter-btn { background: #1e293b; }
  .mistake-item { background: #1e293b; }
}
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-inner">
    <h1>📚 毛概题库复习系统 · 增强版</h1>
    <div class="header-stats">
      <span>✅ <strong id="totalCorrect">0</strong></span>
      <span>❌ <strong id="totalWrong">0</strong></span>
      <span>📝 <strong id="totalDone">0</strong></span>
    </div>
  </div>
</div>

<!-- PC TOP NAV -->
<nav class="pc-nav">
  <div class="pc-nav-inner" id="navTabs">
    <button class="nav-tab active" data-mode="single">📋 单选题<span class="badge">90</span></button>
    <button class="nav-tab" data-mode="multi">✅ 多选题<span class="badge">60</span></button>
    <button class="nav-tab" data-mode="judge">⚖️ 判断题<span class="badge">50</span></button>
    <button class="nav-tab" data-mode="jianDa">📝 简答题<span class="badge">13</span></button>
    <button class="nav-tab" data-mode="lunShu">📄 论述题<span class="badge">8</span></button>
    <button class="nav-tab" data-mode="exam">🧪 考试模式<span class="badge">44</span></button>
    <button class="nav-tab mistake-tab" data-mode="mistake">📒 错题本<span class="badge" id="mistakeBadge">0</span></button>
  </div>
</nav>

<!-- MOBILE BOTTOM NAV -->
<nav class="mobile-bottom-nav">
  <div class="mobile-bottom-nav-inner" id="mobileNavTabs">
    <button class="mobile-nav-tab active" data-mode="single"><span class="tab-icon">📋</span><span class="tab-label">单选</span><span class="tab-badge">90</span></button>
    <button class="mobile-nav-tab" data-mode="multi"><span class="tab-icon">✅</span><span class="tab-label">多选</span><span class="tab-badge">60</span></button>
    <button class="mobile-nav-tab" data-mode="judge"><span class="tab-icon">⚖️</span><span class="tab-label">判断</span><span class="tab-badge">50</span></button>
    <button class="mobile-nav-tab" data-mode="jianDa"><span class="tab-icon">📝</span><span class="tab-label">简答</span><span class="tab-badge">13</span></button>
    <button class="mobile-nav-tab" data-mode="lunShu"><span class="tab-icon">📄</span><span class="tab-label">论述</span><span class="tab-badge">8</span></button>
    <button class="mobile-nav-tab" data-mode="exam"><span class="tab-icon">🧪</span><span class="tab-label">考试</span><span class="tab-badge">44</span></button>
    <button class="mobile-nav-tab mistake-tab" data-mode="mistake"><span class="tab-icon">📒</span><span class="tab-label">错题本</span><span class="tab-badge" id="mistakeBadgeM">0</span></button>
  </div>
</nav>

<div class="mobile-action-bar" id="mobileActionBar"></div>
<div class="main" id="mainContent"></div>
<div class="footer">
  <p>💡 快捷键：<kbd class="kbd">1-5</kbd> 选择选项 · <kbd class="kbd">Enter</kbd> 提交 · <kbd class="kbd">← →</kbd> 上下题 · <kbd class="kbd">R</kbd> 显示答案</p>
</div>

<script>
(() => {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    || (navigator.maxTouchPoints > 1 && /Mac/.test(ua) && window.innerWidth <= 1024);
  document.body.classList.add(isMobile ? 'is-mobile' : 'is-pc');
  window.IS_MOBILE = isMobile;
})();

// ===== DATA (same as demo) =====
const DATA = ${JSON.stringify({ singleChoice, multiChoice, judgeQuestions })};
const JIANDA_ESSAYS = ${JSON.stringify(jianDaQuestions)};
const LUNSHU_ESSAYS = ${JSON.stringify(lunShuQuestions)};

// ===== EXPLANATIONS DATA (from explanations.js + transcript analysis) =====
const EXPLANATIONS = ${JSON.stringify(explanationsData)};

function decorate(list, type) {
  return list.map(q => ({ ...q, key: type + '-' + q.id, type }));
}
DATA.singleChoice = decorate(DATA.singleChoice, 'single');
DATA.multiChoice = decorate(DATA.multiChoice, 'multi');
DATA.judgeQuestions = decorate(DATA.judgeQuestions, 'judge');

// ===== STORAGE =====
const STORAGE_KEY = 'maogai_review_v5_enhanced';
const STATS_KEY = 'maogai_stats_v5';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeModeState() {
  return { currentIndex: 0, answers: {}, revealed: {}, orderMode: 'seq', shuffled: null };
}

function makeDefaultState() {
  return {
    currentMode: 'single',
    single: makeModeState(),
    multi: makeModeState(),
    judge: makeModeState(),
    jianDa: { currentIndex: 0, visited: {}, orderMode: 'seq', shuffled: null },
    lunShu: { currentIndex: 0, visited: {}, orderMode: 'seq', shuffled: null },
    exam: { currentIndex: 0, answers: {}, revealed: {}, cardOpen: true, questions: null },
    mistake: { filterType: 'all', sortBy: 'rate' }
  };
}

// ===== PER-QUESTION STATS (NEW — 错题本核心数据) =====
function makeDefaultStats() {
  const stats = { single: {}, multi: {}, judge: {} };
  for (const q of DATA.singleChoice) stats.single[q.id] = { attempts: 0, correct: 0, wrong: 0, lastResult: null };
  for (const q of DATA.multiChoice) stats.multi[q.id] = { attempts: 0, correct: 0, wrong: 0, lastResult: null };
  for (const q of DATA.judgeQuestions) stats.judge[q.id] = { attempts: 0, correct: 0, wrong: 0, lastResult: null };
  return stats;
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return makeDefaultStats();
    const parsed = JSON.parse(raw);
    const def = makeDefaultStats();
    for (const type of ['single', 'multi', 'judge']) {
      if (!parsed[type]) { parsed[type] = def[type]; continue; }
      for (const id of Object.keys(def[type])) {
        if (!parsed[type][id]) parsed[type][id] = def[type][id];
      }
    }
    return parsed;
  } catch(e) { return makeDefaultStats(); }
}

let questionStats = loadStats();

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(questionStats));
}

function recordAnswer(q, isCorrect) {
  const type = q.type, id = q.id;
  if (!questionStats[type] || !questionStats[type][id]) return;
  questionStats[type][id].attempts++;
  if (isCorrect) questionStats[type][id].correct++;
  else questionStats[type][id].wrong++;
  questionStats[type][id].lastResult = isCorrect ? 'correct' : 'wrong';
  saveStats();
}

function getCorrectnessRate(q) {
  const type = q.type, id = q.id;
  if (!questionStats[type] || !questionStats[type][id]) return null;
  const s = questionStats[type][id];
  if (s.attempts === 0) return null;
  return Math.round(s.correct / s.attempts * 100);
}

// ===== STATE MANAGEMENT =====
function mergeState(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in incoming)) continue;
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      if (incoming[k] && typeof incoming[k] === 'object' && !Array.isArray(incoming[k])) {
        base[k] = { ...base[k], ...incoming[k] };
      } else { base[k] = incoming[k]; }
    } else { base[k] = incoming[k]; }
  }
  return base;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultState();
    return mergeState(makeDefaultState(), JSON.parse(raw));
  } catch(e) { return makeDefaultState(); }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getModeQuestions(mode) {
  const modeState = state[mode];
  const sourceList = (() => {
    switch (mode) {
      case 'single': return DATA.singleChoice;
      case 'multi': return DATA.multiChoice;
      case 'judge': return DATA.judgeQuestions;
      case 'jianDa': return JIANDA_ESSAYS;
      case 'lunShu': return LUNSHU_ESSAYS;
      default: return [];
    }
  })();
  if (mode === 'jianDa' || mode === 'lunShu') {
    if (modeState.orderMode === 'rand') {
      if (!modeState.shuffled) { modeState.shuffled = shuffle(sourceList); saveState(); }
      return modeState.shuffled;
    }
    return sourceList;
  }
  if (modeState.orderMode === 'rand') {
    if (!modeState.shuffled) { modeState.shuffled = shuffle(sourceList); saveState(); }
    return modeState.shuffled;
  }
  return sourceList;
}

function clampIndex(i, total) { if (total <= 0) return 0; return Math.max(0, Math.min(i, total - 1)); }
function getAnswerValue(q, modeState) { const v = modeState.answers[q.key]; return v === undefined ? null : v; }
function isAnswered(modeState, q) { return getAnswerValue(q, modeState) !== null; }
function isRevealed(modeState, q) { return !!modeState.revealed?.[q.key]; }
function normalizeMultiAnswer(ans) { return (ans || '').split('').sort().join(''); }
function isCorrectAnswer(q, ua) {
  if (ua === null || ua === undefined) return false;
  if (q.type === 'multi') return normalizeMultiAnswer(ua) === normalizeMultiAnswer(q.answer);
  return ua === q.answer;
}
function getExplanation(q) {
  const expMap = EXPLANATIONS[q.type];
  if (!expMap) return null;
  return expMap[String(q.id)] || null;
}

function updateGlobalStats() {
  let correct = 0, wrong = 0, done = 0;
  const configs = [
    { key: 'single', qs: state.single.shuffled || DATA.singleChoice },
    { key: 'multi', qs: state.multi.shuffled || DATA.multiChoice },
    { key: 'judge', qs: state.judge.shuffled || DATA.judgeQuestions },
    { key: 'exam', qs: state.exam.questions || [] },
  ];
  for (const cfg of configs) {
    const answers = state[cfg.key]?.answers || {};
    for (const q of cfg.qs) {
      const ua = answers[q.key];
      if (ua !== undefined && ua !== null) { done++; if (isCorrectAnswer(q, ua)) correct++; else wrong++; }
    }
  }
  document.getElementById('totalCorrect').textContent = correct;
  document.getElementById('totalWrong').textContent = wrong;
  document.getElementById('totalDone').textContent = done;

  // 错题本 badge
  let totalMistakes = 0;
  for (const type of ['single', 'multi', 'judge']) {
    for (const id in questionStats[type]) {
      const s = questionStats[type][id];
      if (s.attempts > 0 && s.wrong > 0) totalMistakes++;
    }
  }
  const badge = document.getElementById('mistakeBadge');
  if (badge) badge.textContent = totalMistakes;
  const badgeM = document.getElementById('mistakeBadgeM');
  if (badgeM) badgeM.textContent = totalMistakes;
}

let _selected = [];

// ===== RENDER: QUESTION CARD (with explanation after answer) =====
function renderQuestionCard(q, idx, total, modeState, mode, opts = {}) {
  const ua = getAnswerValue(q, modeState);
  const answered = ua !== null && ua !== undefined;
  const revealed = isRevealed(modeState, q);
  const isMulti = q.type === 'multi';
  const isJudge = q.type === 'judge';
  const showReveal = opts.showReveal !== false && mode !== 'exam';

  let optionsHtml = '';
  for (const opt of q.options) {
    let cls = 'option-btn';
    if (answered || revealed) {
      if (revealed) {
        if (opt.letter === q.answer || (isMulti && q.answer.includes(opt.letter))) cls += ' missed';
      } else if (isMulti) {
        const uaLetters = normalizeMultiAnswer(ua).split('');
        const ansLetters = normalizeMultiAnswer(q.answer).split('');
        if (ansLetters.includes(opt.letter)) { cls += uaLetters.includes(opt.letter) ? ' correct' : ' missed'; }
        else if (uaLetters.includes(opt.letter)) { cls += ' incorrect'; }
      } else {
        if (opt.letter === q.answer) cls += ' correct';
        else if (opt.letter === ua) cls += ' incorrect';
      }
    }
    optionsHtml += '<button class="' + cls + '" data-letter="' + opt.letter + '"' + (answered || revealed ? ' disabled' : '') + '>' +
      '<span class="opt-icon">' + opt.letter + '</span><span>' + opt.text + '</span></button>';
  }

  let feedbackHtml = '';
  let explanationHtml = '';

  if (answered && !revealed) {
    const correct = isCorrectAnswer(q, ua);
    feedbackHtml = '<div class="feedback ' + (correct ? 'ok' : 'no') + ' show">' +
      (correct ? '✅ 回答正确！' : '❌ 回答错误') + '</div>' +
      (!correct ? '<div class="answer-reveal show">正确答案：<strong>' + q.answer + '</strong></div>' : '');

    // ★ NEW: 显示解析 + 正确率
    const exp = getExplanation(q);
    if (exp) {
      const rate = getCorrectnessRate(q);
      let rateHtml = '';
      if (rate !== null) {
        const rc = rate >= 80 ? 'var(--success)' : (rate >= 50 ? '#f59e0b' : 'var(--error)');
        rateHtml = '<span class="exp-correct-rate" style="color:' + rc + ';">📊 本题正确率：' + rate + '%（' + questionStats[q.type][q.id].attempts + '次作答）</span>';
      }
      // Format: highlight 【答案】【解析】【教师强调】 markers
      let formattedExp = exp
        .replace(/【答案】/g, '<strong style="color:var(--primary);">【答案】</strong>')
        .replace(/【解析】/g, '<strong style="color:#0ea5e9;">【解析】</strong>')
        .replace(/【录音参考】/g, '<strong style="color:#f59e0b;">【录音参考】</strong>');

      // 教师强调特殊样式
      if (formattedExp.includes('【教师强调】')) {
        formattedExp = formattedExp.replace(/🔴【教师强调】([^]*?)(?=\\n\\n|$)/g,
          '<span class="exp-teacher-note">🔴<strong>【教师强调】</strong>$1</span>');
      }

      explanationHtml = '<div class="explanation-box show">' +
        '<span class="exp-label">📖 解析</span>' + rateHtml + formattedExp + '</div>';
    }
  } else if (revealed) {
    feedbackHtml = '<div class="feedback no show">👀 已显示答案</div>' +
      '<div class="answer-reveal show">正确答案：<strong>' + q.answer + '</strong></div>';
    const exp = getExplanation(q);
    if (exp) {
      let formattedExp = exp
        .replace(/【答案】/g, '<strong style="color:var(--primary);">【答案】</strong>')
        .replace(/【解析】/g, '<strong style="color:#0ea5e9;">【解析】</strong>');
      if (formattedExp.includes('【教师强调】')) {
        formattedExp = formattedExp.replace(/🔴【教师强调】([^]*?)(?=\\n\\n|$)/g,
          '<span class="exp-teacher-note">🔴<strong>【教师强调】</strong>$1</span>');
      }
      explanationHtml = '<div class="explanation-box show">' +
        '<span class="exp-label">📖 解析</span>' + formattedExp + '</div>';
    }
  }

  const typeLabel = isMulti ? '多选题' : (isJudge ? '判断题' : '单选题');
  const typeClass = isMulti ? 'multi' : (isJudge ? 'judge' : 'single');
  const multiTip = (isMulti && !answered && !revealed) ? '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:10px;">💡 多选题，可选多项</p>' : '';

  const actionHtml = opts.showActions === false ? '' : (
    '<div class="actions">' +
      '<button class="btn btn-primary" id="btnSubmit"' + (answered || revealed ? ' disabled' : '') + '>✔ 提交</button>' +
      (idx > 0 ? '<button class="btn btn-outline" id="btnPrev">← 上题</button>' : '') +
      (idx < total - 1 ? '<button class="btn btn-outline" id="btnNext">' + ((answered || revealed) ? '下题 →' : '跳过 →') + '</button>' : '') +
      (showReveal && !answered && !revealed ? '<button class="btn btn-ghost" id="btnReveal">👁 答案</button>' : '') +
    '</div>'
  );

  return '<div class="card">' +
    '<div class="card-header"><span class="q-number">第 ' + (idx + 1) + ' / ' + total + ' 题</span><span class="q-type ' + typeClass + '">' + typeLabel + '</span></div>' +
    '<div class="card-body">' +
      '<div class="question-text">' + q.question + '</div>' + multiTip +
      '<div class="options-list">' + optionsHtml + '</div>' +
      feedbackHtml + explanationHtml + actionHtml +
    '</div></div>';
}

// ===== RENDER: PROGRESS / ORDER / ANSWER CARD (same as demo) =====
function renderProgressSection(answered, correct, wrong, total) {
  const pct = total > 0 ? Math.round(answered / total * 100) : 0;
  return '<div class="progress-section"><div class="progress-header">' +
    '<span class="progress-title">📊 学习进度</span>' +
    '<span class="progress-numbers"><span>✅ <span class="c">' + correct + '</span></span><span>❌ <span class="w">' + wrong + '</span></span><span>⬜ ' + (total - answered) + ' 剩余</span><span>📝 ' + answered + '/' + total + ' (' + pct + '%)</span></span>' +
    '</div><div class="progress-bar-outer"><div class="progress-bar-inner" style="width:' + pct + '%"></div></div></div>';
}

function renderOrderToggle(mode) {
  const modeState = state[mode];
  const isRand = modeState.orderMode === 'rand';
  return '<div class="order-toggle-bar">' +
    '<span class="order-toggle-label">答题方式：</span>' +
    '<button class="order-toggle-btn' + (!isRand ? ' active' : '') + '" id="orderSeq">📋 顺序作答</button>' +
    '<button class="order-toggle-btn' + (isRand ? ' active' : '') + '" id="orderRand">🎲 随机抽题<span class="reshuffle">↻</span></button></div>';
}

function renderAnswerCard(mode, questions, modeState, currentIdx) {
  const total = questions.length;
  const isEssayMode = (mode === 'jianDa' || mode === 'lunShu');
  if (isEssayMode) {
    const items = questions.map((q, i) => {
      const visited = modeState.visited?.[q.id] ? ' viewed' : '';
      return '<button class="answer-item' + visited + (i === currentIdx ? ' current' : '') + '" data-jump="' + i + '"><span>' + q.id + '</span></button>';
    }).join('');
    return '<div class="answer-card-wrap"><div class="answer-card-head"><span class="answer-card-title">📋 答题卡</span><span class="answer-summary"><span>共 ' + total + ' 题</span></span></div><div class="answer-card-body"><div class="answer-grid">' + items + '</div></div></div>';
  }
  const items = questions.map((q, i) => {
    const ua = getAnswerValue(q, modeState);
    let cls = 'answer-item';
    if (i === currentIdx) cls += ' current';
    if (isRevealed(modeState, q)) cls += ' revealed';
    else if (ua === null || ua === undefined) cls += ' unanswered';
    else cls += isCorrectAnswer(q, ua) ? ' correct' : ' wrong';
    return '<button class="' + cls + '" data-jump="' + i + '" title="跳转到第' + (i + 1) + '题"><span>' + (i + 1) + '</span></button>';
  }).join('');
  const answered = questions.filter(q => isAnswered(modeState, q)).length;
  const correct = questions.filter(q => isAnswered(modeState, q) && isCorrectAnswer(q, modeState.answers[q.key])).length;
  const wrong = answered - correct;
  const typeLabel = mode === 'single' ? '单选题' : (mode === 'multi' ? '多选题' : '判断题');
  return '<div class="answer-card-wrap"><div class="answer-card-head"><span class="answer-card-title">📋 答题卡</span>' +
    '<span class="answer-summary"><span class="u"><i class="dot"></i>未答 ' + (total - answered) + '</span><span class="c"><i class="dot"></i>对 ' + correct + '</span><span class="w"><i class="dot"></i>错 ' + wrong + '</span><span>' + typeLabel + ' ' + total + '题</span></span>' +
    '</div><div class="answer-card-body"><div class="answer-grid">' + items + '</div></div></div>';
}

function renderExamAnswerCard() {
  const questions = state.exam.questions || [];
  if (!questions.length) return '';
  const choiceQs = questions.filter(q => q.type === 'single' || q.type === 'multi' || q.type === 'judge');
  const essayQs = questions.filter(q => q._isEssay);
  let offset = 0;
  const sections = [];
  if (choiceQs.length > 0) sections.push({ title: '选择题', items: choiceQs });
  if (essayQs.length > 0) sections.push({ title: '大题', items: essayQs });
  const current = clampIndex(state.exam.currentIndex || 0, questions.length);
  const body = sections.map(sec => {
    const grid = sec.items.map((q, idx) => {
      const absIdx = offset + idx;
      let cls = 'answer-item';
      if (absIdx === current) cls += ' current';
      if (q._isEssay) {
        return '<button class="' + cls + (state.exam.visited?.[q.key] ? ' viewed' : '') + '" data-jump="' + absIdx + '"><span>' + (idx + 1) + '</span></button>';
      }
      const ua = getAnswerValue(q, state.exam);
      if (isRevealed(state.exam, q)) cls += ' revealed';
      else if (ua === null || ua === undefined) cls += ' unanswered';
      else cls += isCorrectAnswer(q, ua) ? ' correct' : ' wrong';
      return '<button class="' + cls + '" data-jump="' + absIdx + '"><span>' + (idx + 1) + '</span><span class="mini">' + (q.type === 'single' ? '单' : (q.type === 'multi' ? '多' : '判')) + '</span></button>';
    }).join('');
    offset += sec.items.length;
    return '<div class="answer-section"><div class="answer-section-title"><span>' + sec.title + '（' + sec.items.length + '题）</span></div><div class="answer-grid">' + grid + '</div></div>';
  }).join('');
  return '<div class="answer-card-wrap" id="examAnswerCard"><div class="answer-card-head"><div><div class="answer-card-title">答题卡</div></div><div class="answer-summary"><span>点击题号可直接跳转</span></div></div><div class="answer-card-body">' + body + '</div></div>';
}

function genExamQuestions() {
  const singles = shuffle(DATA.singleChoice).slice(0, 18);
  const multis = shuffle(DATA.multiChoice).slice(0, 12);
  const judges = shuffle(DATA.judgeQuestions).slice(0, 10);
  const jianDa = shuffle(JIANDA_ESSAYS).slice(0, 3).map(q => ({ ...q, _isEssay: true, type: 'essay', key: 'essay-' + q.id }));
  const lunShu = shuffle(LUNSHU_ESSAYS).slice(0, 1).map(q => ({ ...q, _isEssay: true, type: 'essay', key: 'essay-' + q.id }));
  return [...singles, ...multis, ...judges, ...jianDa, ...lunShu];
}

// ===== RENDER: MISTAKE BOOK (NEW) =====
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

  // Summary
  html += '<div class="mistake-summary">' +
    '<div class="mistake-stat-card"><div class="stat-icon">📊</div><div class="stat-value">' + allItems.length + '</div><div class="stat-label">已做题数</div></div>' +
    '<div class="mistake-stat-card wrong"><div class="stat-icon">❌</div><div class="stat-value">' + mistakeCount + '</div><div class="stat-label">错题数</div></div>' +
    '<div class="mistake-stat-card rate"><div class="stat-icon">🎯</div><div class="stat-value">' + overallRate + '%</div><div class="stat-label">总正确率</div></div>' +
    '<div class="mistake-stat-card"><div class="stat-icon">📝</div><div class="stat-value">' + totalAttempts + '</div><div class="stat-label">总作答次数</div></div>' +
  '</div>';

  // Filter + Sort
  html += '<div class="mistake-filter">' +
    '<span class="mistake-filter-label">题型：</span>' +
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
    html += '<div class="empty-state"><div class="emoji">📒</div><h3>暂无答题记录</h3><p>开始做题后，错题本将自动统计每道题的正确率</p></div>';
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
        '<div class="mi-stats"><span>📝 作答 ' + item.attempts + ' 次</span><span>✅ ' + item.correct + ' 次</span><span>❌ ' + item.wrong + ' 次</span><span>📌 最近：<strong>' + (item.lastResult === 'correct' ? '✅' : '❌') + '</strong></span></div>' +
      '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  html += '<div class="reset-area" style="margin-top:14px;"><button class="btn-reset" id="btnResetStats">🔄 重置统计数据</button><button class="btn-reset" id="btnResetAll">🗑 清除全部记录</button></div>';
  return html;
}

// ===== RENDER: MAIN MODES =====
function renderPracticeMode(mode, questions, modeState) {
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const currentQ = questions[idx];
  const total = questions.length;
  let answered = 0, correct = 0;
  for (const q of questions) { const ua = getAnswerValue(q, modeState); if (ua !== null && ua !== undefined) { answered++; if (isCorrectAnswer(q, ua)) correct++; } }
  const wrong = answered - correct;
  return '<div class="reset-area"><button class="btn-reset" id="btnResetMode">🔄 重置此模式</button><button class="btn-reset" id="btnResetAll">🗑 清除全部</button></div>' +
    renderOrderToggle(mode) + renderProgressSection(answered, correct, wrong, total) +
    renderQuestionCard(currentQ, idx, total, modeState, mode) +
    renderAnswerCard(mode, questions, modeState, idx) +
    (!window.IS_MOBILE ? '<div class="kbd-hints"><span><kbd class="kbd">1-5</kbd> 选择</span><span><kbd class="kbd">Enter</kbd> 提交</span><span><kbd class="kbd">← →</kbd> 上下题</span><span><kbd class="kbd">R</kbd> 显示答案</span></div>' : '');
}

function renderExamMode() {
  const questions = state.exam.questions || [];
  const modeState = state.exam;
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const currentQ = questions[idx];
  const total = questions.length;
  if (total === 0) return '<div class="card"><div class="card-body essay-card"><p style="margin-bottom:16px;">🧪 考试模式：从题库随机抽取 18道单选 + 12道多选 + 10道判断 + 3道简答 + 1道论述</p><button class="btn btn-primary" id="btnGenExam" style="font-size:1rem;">🎲 生成试卷</button></div></div>';
  const choiceQs = questions.filter(q => !q._isEssay);
  let answered = 0, correct = 0;
  for (const q of choiceQs) { const ua = getAnswerValue(q, modeState); if (ua !== null && ua !== undefined) { answered++; if (isCorrectAnswer(q, ua)) correct++; } }
  const wrong = answered - correct;
  let cardHtml;
  if (currentQ._isEssay) {
    cardHtml = '<div class="card"><div class="card-header"><span class="q-number">第 ' + (idx + 1) + ' / ' + total + ' 题</span><span class="q-type essay">' + (currentQ.id <= 13 ? '简答题' : '论述题') + '</span></div>' +
      '<div class="card-body essay-card"><div class="essay-question"><span style="color:#92400e;font-weight:700;">' + currentQ.id + '.</span> ' + currentQ.question + '</div><div class="essay-meta">📖 请参考教材相关章节进行复习</div>' +
      (!window.IS_MOBILE ? '<div class="actions" style="justify-content:center;">' + (idx > 0 ? '<button class="btn btn-outline" id="btnPrev">← 上题</button>' : '') + (idx < total - 1 ? '<button class="btn btn-outline" id="btnNext">下一题 →</button>' : '') + '</div>' : '') + '</div></div>';
  } else {
    cardHtml = renderQuestionCard(currentQ, idx, total, modeState, 'exam', { showReveal: false, showActions: !window.IS_MOBILE });
  }
  return '<div class="reset-area"><button class="btn-reset" id="btnRegenExam">🎲 重新出题</button><button class="btn-reset" id="btnResetExam">🔄 重置答案</button></div>' +
    '<div style="margin-bottom:10px;font-size:0.85rem;color:var(--text-secondary);">📌 考试模式：单选18 + 多选12 + 判断10 + 简答3 + 论述1 = 共 ' + total + ' 题 | 当前第 ' + (idx + 1) + ' 题</div>' +
    renderProgressSection(answered, correct, wrong, choiceQs.length) + cardHtml + renderExamAnswerCard() +
    (!window.IS_MOBILE && !currentQ._isEssay ? '<div class="kbd-hints"><span><kbd class="kbd">1-5</kbd> 选择</span><span><kbd class="kbd">Enter</kbd> 提交</span><span><kbd class="kbd">← →</kbd> 上下题</span></div>' : '');
}

function renderEssayMode(mode) {
  const questions = getModeQuestions(mode);
  const modeState = state[mode];
  const ei = clampIndex(modeState.currentIndex || 0, questions.length);
  const essay = questions[ei];
  const total = questions.length;
  const title = mode === 'jianDa' ? '简答题' : '论述题';
  const listHtml = questions.map((eq, i) => '<div class="essay-item" style="' + (i === ei ? 'border-color:var(--primary);background:var(--primary-light);' : '') + '"><span class="num">' + eq.id + '.</span><span>' + eq.question + '</span></div>').join('');
  return '<div class="reset-area"><button class="btn-reset" id="btnResetEssay">🔄 重置浏览记录</button></div>' + renderOrderToggle(mode) +
    '<div class="card"><div class="card-header"><span class="q-number">📄 ' + title + '</span><span class="q-type essay">共 ' + total + ' 题</span></div>' +
    '<div class="card-body essay-card"><p style="color:var(--text-secondary);font-size:0.88rem;">当前题目：<strong>' + (ei + 1) + ' / ' + total + '</strong></p>' +
    '<div class="essay-question"><span style="color:#92400e;font-weight:700;">' + essay.id + '.</span> ' + essay.question + '</div>' +
    '<div class="essay-meta">📖 请参考教材相关章节进行复习</div>' +
    (!window.IS_MOBILE ? '<div style="margin-top:20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;"><button class="btn btn-outline" id="btnPrevEssay"' + (ei === 0 ? ' disabled' : '') + '>← 上一题</button><button class="btn btn-outline" id="btnNextEssay"' + (ei >= total - 1 ? ' disabled' : '') + '>下一题 →</button></div>' : '') +
    '</div></div>' +
    '<div style="margin-top:16px;"><h3 style="margin-bottom:10px;font-size:0.95rem;">📋 全部' + title + '列表</h3><div class="essay-list">' + listHtml + '</div></div>' +
    renderAnswerCard(mode, questions, modeState, ei);
}

// ===== EVENT HANDLERS =====
function doSubmit(mode, modeState, questions) {
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const currentQ = questions[idx];
  const ua = getAnswerValue(currentQ, modeState);
  if (ua !== null && ua !== undefined) return;
  const isMulti = currentQ.type === 'multi';
  const ans = isMulti ? _selected.slice().sort().join('') : (_selected[0] || '');
  if (!ans) return;
  modeState.answers[currentQ.key] = ans;
  // ★ NEW: 记录统计数据
  recordAnswer(currentQ, isCorrectAnswer(currentQ, ans));
  saveState();
  render();
}

function doReveal(mode, modeState, questions) {
  if (mode === 'exam') return;
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const currentQ = questions[idx];
  if (getAnswerValue(currentQ, modeState) !== null) return;
  modeState.revealed[currentQ.key] = true;
  saveState();
  render();
}

function navigate(mode, modeState, questions, dir) {
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < questions.length) {
    modeState.currentIndex = newIdx;
    if (modeState.visited && questions[newIdx]) modeState.visited[questions[newIdx].id] = true;
    saveState();
    render();
  }
}

function bindChoiceEvents(mode, modeState, questions) {
  _selected = [];
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const currentQ = questions[idx];
  if (!currentQ) return;
  const answered = isAnswered(modeState, currentQ) || isRevealed(modeState, currentQ);
  const isMulti = currentQ.type === 'multi';

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      const letter = btn.dataset.letter;
      if (isMulti) {
        const i = _selected.indexOf(letter);
        if (i >= 0) { _selected.splice(i, 1); btn.classList.remove('selected'); }
        else { _selected.push(letter); btn.classList.add('selected'); }
      } else {
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        _selected = [letter]; btn.classList.add('selected');
      }
    });
  });

  document.getElementById('btnSubmit')?.addEventListener('click', () => doSubmit(mode, modeState, questions));
  document.getElementById('btnPrev')?.addEventListener('click', () => navigate(mode, modeState, questions, -1));
  document.getElementById('btnNext')?.addEventListener('click', () => navigate(mode, modeState, questions, 1));
  document.getElementById('btnReveal')?.addEventListener('click', () => doReveal(mode, modeState, questions));

  document.getElementById('btnResetMode')?.addEventListener('click', () => { if (!confirm('重置当前模式的所有答题记录？')) return; state[mode] = makeDefaultState()[mode]; saveState(); render(); });
  document.getElementById('btnResetAll')?.addEventListener('click', () => { if (!confirm('清除全部答题记录？')) return; localStorage.removeItem(STORAGE_KEY); state = loadState(); render(); });
  document.getElementById('btnResetExam')?.addEventListener('click', () => { if (!confirm('重置考试答案记录？')) return; state.exam.answers = {}; state.exam.revealed = {}; state.exam.currentIndex = 0; state.exam.visited = {}; saveState(); render(); });
  document.getElementById('btnRegenExam')?.addEventListener('click', () => { if (!confirm('重新生成试卷？')) return; state.exam.questions = genExamQuestions(); state.exam.answers = {}; state.exam.revealed = {}; state.exam.currentIndex = 0; state.exam.visited = {}; state.exam.cardOpen = true; saveState(); render(); });
  document.getElementById('btnGenExam')?.addEventListener('click', () => { state.exam.questions = genExamQuestions(); state.exam.answers = {}; state.exam.revealed = {}; state.exam.currentIndex = 0; state.exam.visited = {}; state.exam.cardOpen = true; saveState(); render(); });
  document.getElementById('btnResetEssay')?.addEventListener('click', () => { if (!confirm('重置浏览记录？')) return; state[mode].visited = {}; state[mode].currentIndex = 0; saveState(); render(); });

  document.querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.jump, 10);
      if (!Number.isNaN(target)) { modeState.currentIndex = target; if (modeState.visited && questions[target]) modeState.visited[questions[target].id] = true; saveState(); render(); }
    });
  });

  document.getElementById('orderSeq')?.addEventListener('click', () => { state[mode].orderMode = 'seq'; state[mode].currentIndex = 0; saveState(); render(); });
  document.getElementById('orderRand')?.addEventListener('click', () => {
    state[mode].orderMode = 'rand';
    const sourceList = mode === 'single' ? DATA.singleChoice : mode === 'multi' ? DATA.multiChoice : DATA.judgeQuestions;
    state[mode].shuffled = shuffle(sourceList); state[mode].currentIndex = 0; saveState(); render();
  });

  updateMobileActionBar(mode, modeState, questions);

  if (!window.IS_MOBILE && !currentQ._isEssay) {
    if (window._kbCleanup) window._kbCleanup();
    const handler = function(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!answered) { const num = parseInt(e.key, 10); if (num >= 1 && num <= currentQ.options.length) { const btn = document.querySelector('.option-btn[data-letter="' + currentQ.options[num - 1].letter + '"]'); if (btn) btn.click(); } }
      if (e.key === 'Enter' && !answered) { e.preventDefault(); doSubmit(mode, modeState, questions); }
      if (e.key === 'ArrowRight') { e.preventDefault(); navigate(mode, modeState, questions, 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(mode, modeState, questions, -1); }
      if ((e.key === 'r' || e.key === 'R') && !answered && mode !== 'exam') { e.preventDefault(); doReveal(mode, modeState, questions); }
    };
    document.addEventListener('keydown', handler);
    window._kbCleanup = () => document.removeEventListener('keydown', handler);
  }
}

function updateMobileActionBar(mode, modeState, questions) {
  if (!window.IS_MOBILE) return;
  const bar = document.getElementById('mobileActionBar');
  if (!bar) return;
  if (mode === 'jianDa' || mode === 'lunShu') {
    const ei = clampIndex(modeState.currentIndex || 0, questions.length);
    bar.innerHTML = '<button class="btn btn-outline" id="mbPrevEssay"' + (ei === 0 ? ' disabled' : '') + ' style="flex:0 0 auto">← 上题</button><button class="btn btn-primary" id="mbNextEssay"' + (ei >= questions.length - 1 ? ' disabled' : '') + ' style="flex:1;justify-content:center">下一题 →</button>';
    document.getElementById('mbPrevEssay')?.addEventListener('click', () => { if (modeState.currentIndex > 0) { modeState.currentIndex--; saveState(); render(); } });
    document.getElementById('mbNextEssay')?.addEventListener('click', () => { if (modeState.currentIndex < questions.length - 1) { modeState.currentIndex++; saveState(); render(); } });
    return;
  }
  if (mode === 'exam') {
    const idx = clampIndex(modeState.currentIndex || 0, questions.length);
    const currentQ = questions[idx];
    if (!currentQ) { bar.innerHTML = ''; return; }
    if (currentQ._isEssay) {
      bar.innerHTML = (idx > 0 ? '<button class="btn btn-outline" id="mbPrev" style="flex:0 0 auto">←</button>' : '<span style="flex:0 0 36px"></span>') + '<button class="btn btn-primary" id="mbNext" style="flex:1;justify-content:center"' + (idx >= questions.length - 1 ? ' disabled' : '') + '>' + (idx < questions.length - 1 ? '下一题 →' : '已完成 ✓') + '</button>' + '<button class="btn btn-ghost" id="mbCard" style="flex:0 0 auto">答题卡</button>';
    } else {
      const answered = isAnswered(modeState, currentQ) || isRevealed(modeState, currentQ);
      bar.innerHTML = (idx > 0 ? '<button class="btn btn-outline" id="mbPrev" style="flex:0 0 auto">←</button>' : '<span style="flex:0 0 36px"></span>') + (!answered ? '<button class="btn btn-primary" id="mbSubmit" style="flex:1;justify-content:center">✔ 提交</button>' : '<button class="btn btn-primary" id="mbNext" style="flex:1;justify-content:center"' + (idx >= questions.length - 1 ? ' disabled' : '') + '>' + (idx < questions.length - 1 ? '下一题 →' : '已完成 ✓') + '</button>') + '<button class="btn btn-ghost" id="mbCard" style="flex:0 0 auto">答题卡</button>';
    }
    document.getElementById('mbPrev')?.addEventListener('click', () => navigate(mode, modeState, questions, -1));
    document.getElementById('mbNext')?.addEventListener('click', () => navigate(mode, modeState, questions, 1));
    document.getElementById('mbSubmit')?.addEventListener('click', () => doSubmit(mode, modeState, questions));
    document.getElementById('mbCard')?.addEventListener('click', () => { state.exam.cardOpen = !state.exam.cardOpen; saveState(); render(); });
    return;
  }
  if (!questions || questions.length === 0) { bar.innerHTML = ''; return; }
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const currentQ = questions[idx];
  const answered = isAnswered(modeState, currentQ) || isRevealed(modeState, currentQ);
  bar.innerHTML = (idx > 0 ? '<button class="btn btn-outline" id="mbPrev" style="flex:0 0 auto">←</button>' : '<span style="flex:0 0 36px"></span>') + (!answered ? '<button class="btn btn-primary" id="mbSubmit" style="flex:1;justify-content:center">✔ 提交</button>' : '<button class="btn btn-primary" id="mbNext" style="flex:1;justify-content:center"' + (idx >= questions.length - 1 ? ' disabled' : '') + '>' + (idx < questions.length - 1 ? '下一题 →' : '已完成 ✓') + '</button>') + (!answered ? '<button class="btn btn-ghost" id="mbReveal" style="flex:0 0 auto">👁</button>' : '');
  document.getElementById('mbPrev')?.addEventListener('click', () => navigate(mode, modeState, questions, -1));
  document.getElementById('mbNext')?.addEventListener('click', () => navigate(mode, modeState, questions, 1));
  document.getElementById('mbSubmit')?.addEventListener('click', () => doSubmit(mode, modeState, questions));
  document.getElementById('mbReveal')?.addEventListener('click', () => doReveal(mode, modeState, questions));
}

// ===== MISTAKE BOOK EVENTS (NEW) =====
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
  document.getElementById('btnResetStats')?.addEventListener('click', () => { if (!confirm('重置所有题目统计数据？')) return; questionStats = makeDefaultStats(); saveStats(); render(); });
  document.getElementById('btnResetAll')?.addEventListener('click', () => { if (!confirm('清除全部记录？')) return; localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STATS_KEY); state = loadState(); questionStats = loadStats(); render(); });
}

// ===== ESSAY EVENTS =====
function bindEssayEvents(mode) {
  const questions = getModeQuestions(mode);
  const modeState = state[mode];
  document.getElementById('btnPrevEssay')?.addEventListener('click', () => { if (modeState.currentIndex > 0) { modeState.currentIndex--; if (modeState.visited && questions[modeState.currentIndex]) modeState.visited[questions[modeState.currentIndex].id] = true; saveState(); render(); } });
  document.getElementById('btnNextEssay')?.addEventListener('click', () => { if (modeState.currentIndex < questions.length - 1) { modeState.currentIndex++; if (modeState.visited && questions[modeState.currentIndex]) modeState.visited[questions[modeState.currentIndex].id] = true; saveState(); render(); } });
  document.querySelectorAll('[data-jump]')?.forEach(btn => { btn.addEventListener('click', () => { const target = parseInt(btn.dataset.jump, 10); if (!Number.isNaN(target)) { modeState.currentIndex = target; if (modeState.visited && questions[target]) modeState.visited[questions[target].id] = true; saveState(); render(); } }); });
  document.getElementById('btnResetEssay')?.addEventListener('click', () => { if (!confirm('重置浏览记录？')) return; state[mode].visited = {}; state[mode].currentIndex = 0; saveState(); render(); });
  document.getElementById('btnResetAll')?.addEventListener('click', () => { if (!confirm('清除全部记录？')) return; localStorage.removeItem(STORAGE_KEY); state = loadState(); render(); });
  document.getElementById('orderSeq')?.addEventListener('click', () => { state[mode].orderMode = 'seq'; state[mode].currentIndex = 0; saveState(); render(); });
  document.getElementById('orderRand')?.addEventListener('click', () => { state[mode].orderMode = 'rand'; state[mode].shuffled = shuffle(mode === 'jianDa' ? JIANDA_ESSAYS : LUNSHU_ESSAYS); state[mode].currentIndex = 0; saveState(); render(); });
  updateMobileActionBar(mode, modeState, questions);
}

// ===== EXAM EVENTS =====
function bindExamEvents() {
  const questions = state.exam.questions || [];
  const modeState = state.exam;
  const idx = clampIndex(modeState.currentIndex || 0, questions.length);
  const currentQ = questions[idx];
  if (!currentQ) return;
  if (!currentQ._isEssay) { bindChoiceEvents('exam', modeState, questions); }
  else {
    document.getElementById('btnPrev')?.addEventListener('click', () => navigate('exam', modeState, questions, -1));
    document.getElementById('btnNext')?.addEventListener('click', () => navigate('exam', modeState, questions, 1));
    updateMobileActionBar('exam', modeState, questions);
    if (!window.IS_MOBILE) {
      if (window._kbCleanup) window._kbCleanup();
      const handler = function(e) { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; if (e.key === 'ArrowRight') { e.preventDefault(); navigate('exam', modeState, questions, 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); navigate('exam', modeState, questions, -1); } };
      document.addEventListener('keydown', handler); window._kbCleanup = () => document.removeEventListener('keydown', handler);
    }
  }
  document.getElementById('btnRegenExam')?.addEventListener('click', () => { if (!confirm('重新生成试卷？')) return; state.exam.questions = genExamQuestions(); state.exam.answers = {}; state.exam.revealed = {}; state.exam.currentIndex = 0; state.exam.visited = {}; state.exam.cardOpen = true; saveState(); render(); });
  document.getElementById('btnResetExam')?.addEventListener('click', () => { if (!confirm('重置考试答案记录？')) return; state.exam.answers = {}; state.exam.revealed = {}; state.exam.currentIndex = 0; state.exam.visited = {}; saveState(); render(); });
  document.getElementById('btnGenExam')?.addEventListener('click', () => { state.exam.questions = genExamQuestions(); state.exam.answers = {}; state.exam.revealed = {}; state.exam.currentIndex = 0; state.exam.visited = {}; state.exam.cardOpen = true; saveState(); render(); });
  document.querySelectorAll('[data-jump]').forEach(btn => { btn.addEventListener('click', () => { const target = parseInt(btn.dataset.jump, 10); if (!Number.isNaN(target)) { modeState.currentIndex = target; if (modeState.visited && questions[target]) modeState.visited[questions[target].id || questions[target].key] = true; saveState(); render(); } }); });
  updateMobileActionBar('exam', modeState, questions);
  if (!window.IS_MOBILE && !currentQ._isEssay) {
    if (window._kbCleanup) window._kbCleanup();
    const answered = isAnswered(modeState, currentQ) || isRevealed(modeState, currentQ);
    const handler = function(e) { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; if (!answered) { const num = parseInt(e.key, 10); if (num >= 1 && num <= currentQ.options.length) { const btn = document.querySelector('.option-btn[data-letter="' + currentQ.options[num - 1].letter + '"]'); if (btn) btn.click(); } } if (e.key === 'Enter' && !answered) { e.preventDefault(); doSubmit('exam', modeState, questions); } if (e.key === 'ArrowRight') { e.preventDefault(); navigate('exam', modeState, questions, 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); navigate('exam', modeState, questions, -1); } };
    document.addEventListener('keydown', handler); window._kbCleanup = () => document.removeEventListener('keydown', handler);
  }
}

// ===== INIT =====
let state = loadState();
document.querySelectorAll('.nav-tab, .mobile-nav-tab').forEach(btn => { btn.addEventListener('click', () => { state.currentMode = btn.dataset.mode; saveState(); render(); }); });
if (state.jianDa.visited && Object.keys(state.jianDa.visited).length === 0 && JIANDA_ESSAYS.length > 0) state.jianDa.visited[JIANDA_ESSAYS[0].id] = true;
if (state.lunShu.visited && Object.keys(state.lunShu.visited).length === 0 && LUNSHU_ESSAYS.length > 0) state.lunShu.visited[LUNSHU_ESSAYS[0].id] = true;
render();
</script>

</body>
</html>`;
}
