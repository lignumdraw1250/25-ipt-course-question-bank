const fs = require('fs');
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
const { singleChoice, multiChoice, judgeQuestions, essayQuestions } = questions;

// Load explanations
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
} catch(e) { console.warn('Could not load explanations.js:', e.message); }

const EXPLANATIONS = {
  single: explanationsData.single || {},
  multi: explanationsData.multi || {},
  judge: explanationsData.judge || {}
};

// Split essay questions: 1-13 short answer, 14-21 essay/discussion
const shortAnswerQuestions = essayQuestions.filter(q => q.id >= 1 && q.id <= 13);
const longEssayQuestions = essayQuestions.filter(q => q.id >= 14 && q.id <= 21);

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>毛概题库复习系统</title>
<style>
:root {
  --bg: #f0f2f5; --card-bg: #ffffff; --primary: #4f46e5; --primary-light: #eef2ff;
  --success: #16a34a; --success-light: #f0fdf4; --error: #dc2626; --error-light: #fef2f2;
  --text: #1e293b; --text-secondary: #64748b; --border: #e2e8f0;
  --shadow: 0 1px 3px rgba(0,0,0,0.08); --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --radius: 12px; --radius-sm: 8px; --transition: 0.2s ease;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;padding-bottom:var(--safe-bottom)}
.header{background:linear-gradient(135deg,#1e3a5f,#2d5a87 50%,#1e3a5f);color:#fff;padding:12px 16px;box-shadow:0 2px 8px rgba(0,0,0,.15);position:sticky;top:0;z-index:100}
.header-inner{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.header h1{font-size:1.1rem;font-weight:700}
.header-stats{display:flex;gap:10px;font-size:.78rem;opacity:.9;flex-wrap:wrap}
.nav{background:var(--card-bg);border-bottom:1px solid var(--border);position:sticky;top:46px;z-index:99;box-shadow:var(--shadow)}
.nav-inner{max-width:960px;margin:0 auto;display:flex;align-items:center;overflow-x:auto;scrollbar-width:none;gap:0}
.nav-inner::-webkit-scrollbar{display:none}
.nav-tab{flex-shrink:0;padding:10px 18px;font-size:.82rem;font-weight:500;color:var(--text-secondary);cursor:pointer;border:none;background:none;border-bottom:3px solid transparent;transition:var(--transition);white-space:nowrap;min-height:44px;display:flex;align-items:center;gap:4px}
.nav-tab:hover{color:var(--primary);background:var(--primary-light)}
.nav-tab.active{color:var(--primary);border-bottom-color:var(--primary);font-weight:600}
.nav-tab .badge{display:inline-block;background:var(--primary);color:#fff;font-size:.65rem;padding:1px 5px;border-radius:10px;margin-left:2px}
.main{max-width:960px;margin:0 auto;padding:14px 12px 40px}

/* Toolbar: exam button + order toggle */
.toolbar{background:var(--card-bg);border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;box-shadow:var(--shadow);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.toolbar-sep{width:1px;height:20px;background:var(--border);margin:0 2px}
.toggle-group{display:flex;border-radius:20px;overflow:hidden;border:2px solid var(--border)}
.toggle-btn{padding:6px 14px;border:none;background:var(--card-bg);font-size:.8rem;font-weight:600;cursor:pointer;transition:var(--transition);color:var(--text-secondary);white-space:nowrap;min-height:34px}
.toggle-btn:hover{background:var(--primary-light);color:var(--primary)}
.toggle-btn.active{background:var(--primary);color:#fff}
.btn-exam{padding:6px 14px;border-radius:20px;border:2px solid #f59e0b;background:var(--card-bg);font-size:.8rem;font-weight:600;cursor:pointer;transition:var(--transition);color:#92400e;margin-left:auto;min-height:34px}
.btn-exam:hover{background:#fefce8}
.btn-exam.active{background:#fef3c7;border-color:#f59e0b}

/* Exam banner */
.exam-banner{display:none;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#92400e;padding:8px 14px;text-align:center;font-weight:600;font-size:.85rem;border-radius:var(--radius-sm);margin-bottom:12px;animation:slideIn .3s ease}
.exam-banner.active{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.exam-banner .exam-btn{padding:4px 12px;border-radius:20px;border:none;font-weight:600;font-size:.78rem;cursor:pointer;transition:var(--transition)}
.exam-btn-submit{background:#dc2626;color:#fff}
.exam-btn-submit:hover{background:#b91c1c}
.exam-btn-exit{background:transparent;color:#92400e;border:1px solid #92400e!important}

/* Progress */
.progress-section{background:var(--card-bg);border-radius:var(--radius);padding:12px 16px;margin-bottom:14px;box-shadow:var(--shadow);position:relative}
.progress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px}
.progress-title{font-weight:600;font-size:.88rem}
.progress-numbers{font-size:.78rem;color:var(--text-secondary);display:flex;gap:8px;flex-wrap:wrap}
.progress-numbers .c{color:var(--success);font-weight:600}
.progress-numbers .w{color:var(--error);font-weight:600}
.progress-bar-outer{height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden}
.progress-bar-inner{height:100%;background:linear-gradient(90deg,var(--primary),#818cf8);border-radius:3px;transition:width .4s ease}

/* Question nav toggle */
.qnav-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:var(--card-bg);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);transition:var(--transition);z-index:2}
.qnav-toggle:hover{background:var(--primary-light);color:var(--primary);border-color:var(--primary)}
.qnav-toggle:active{transform:translateY(-50%) scale(.92)}

/* Question navigator overlay */
.qnav-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);z-index:300;animation:fadeIn .2s ease}
.qnav-overlay.open{display:block}
.qnav-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--card-bg);border-radius:var(--radius);padding:20px;max-width:500px;width:calc(100% - 32px);max-height:70vh;overflow-y:auto;z-index:301;box-shadow:0 20px 60px rgba(0,0,0,.3);display:none}
.qnav-overlay.open .qnav-panel{display:block}
.qnav-panel h3{font-size:1rem;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
.qnav-close{width:30px;height:30px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center}
.qnav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,1fr));gap:6px}
.qnav-dot{width:100%;aspect-ratio:1;border-radius:6px;border:1px solid var(--border);background:var(--card-bg);cursor:pointer;font-size:.7rem;font-weight:600;display:flex;align-items:center;justify-content:center;transition:var(--transition);min-width:32px;min-height:32px}
.qnav-dot:hover{transform:scale(1.1)}
.qnav-dot.done-correct{background:var(--success-light);border-color:var(--success);color:var(--success)}
.qnav-dot.done-wrong{background:var(--error-light);border-color:var(--error);color:var(--error)}
.qnav-dot.done-seen{background:#fefce8;border-color:#eab308;color:#a16207}
.qnav-dot.current{border-color:var(--primary);border-width:2px;box-shadow:0 0 0 2px rgba(79,70,229,.2)}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* Results screen */
.results-panel{display:none;background:var(--card-bg);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow-md)}
.results-panel.show{display:block}
.results-score{text-align:center;padding:20px}
.results-score .big-score{font-size:3rem;font-weight:800;color:var(--primary)}
.results-score .score-label{font-size:.9rem;color:var(--text-secondary);margin-top:4px}
.results-bar{height:10px;border-radius:5px;background:#e5e7eb;overflow:hidden;margin:12px 0}
.results-bar-fill{height:100%;border-radius:5px;transition:width .6s ease}
.results-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:6px;margin-top:16px}
.results-dot{width:100%;aspect-ratio:1;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:.72rem;font-weight:600;display:flex;align-items:center;justify-content:center;transition:var(--transition);min-width:36px;min-height:36px}
.results-dot.correct{background:var(--success-light);border-color:var(--success);color:var(--success)}
.results-dot.wrong{background:var(--error-light);border-color:var(--error);color:var(--error)}

/* Card */
.card{background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow-md);overflow:hidden}
.card-header{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px}
.card-header .q-num{font-weight:700;font-size:.9rem;color:var(--primary)}
.card-header .q-type{font-size:.74rem;padding:2px 9px;border-radius:20px;font-weight:500}
.q-type.single{background:#dbeafe;color:#1e40af}
.q-type.multi{background:#fef3c7;color:#92400e}
.q-type.judge{background:#ede9fe;color:#6b21a8}
.q-type.essay{background:#fce7f3;color:#9d174d}
.card-body{padding:16px}
.question-text{font-size:1.02rem;font-weight:500;line-height:1.8;margin-bottom:16px}
.options-list{display:flex;flex-direction:column;gap:8px}
.option-btn{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;padding:12px 14px;border:2px solid var(--border);border-radius:var(--radius-sm);background:var(--card-bg);cursor:pointer;transition:var(--transition);font-size:.93rem;color:var(--text);line-height:1.5;-webkit-tap-highlight-color:transparent;min-height:48px}
.option-btn:hover{border-color:var(--primary);background:var(--primary-light)}
.option-btn:active{transform:scale(.985)}
.option-btn.selected{border-color:var(--primary);background:var(--primary-light);box-shadow:0 0 0 3px rgba(79,70,229,.15)}
.option-btn.correct{border-color:var(--success);background:var(--success-light)}
.option-btn.incorrect{border-color:var(--error);background:var(--error-light)}
.option-btn.missed{border-color:var(--success);background:var(--success-light);opacity:.75}
.option-btn:disabled{cursor:default;opacity:.85}
.opt-icon{flex-shrink:0;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;background:#f1f5f9;color:var(--text-secondary);transition:var(--transition)}
.option-btn.selected .opt-icon{background:var(--primary);color:#fff}
.option-btn.correct .opt-icon{background:var(--success);color:#fff}
.option-btn.incorrect .opt-icon{background:var(--error);color:#fff}
.option-btn.missed .opt-icon{background:var(--success);color:#fff}
.actions{display:flex;gap:6px;margin-top:16px;flex-wrap:wrap}
.btn{padding:9px 16px;border:none;border-radius:var(--radius-sm);font-size:.88rem;font-weight:600;cursor:pointer;transition:var(--transition);display:inline-flex;align-items:center;gap:4px;-webkit-tap-highlight-color:transparent;min-height:44px}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--primary);color:#fff}
.btn-primary:hover{background:#4338ca}
.btn-primary:disabled{background:#a5b4fc;cursor:not-allowed}
.btn-outline{background:#fff;color:var(--primary);border:2px solid var(--primary)}
.btn-outline:hover{background:var(--primary-light)}
.btn-ghost{background:transparent;color:var(--text-secondary)}
.btn-ghost:hover{background:#f1f5f9;color:var(--text)}
.btn-danger{background:var(--error);color:#fff}
.btn-danger:hover{background:#b91c1c}
.feedback{margin-top:12px;padding:10px 14px;border-radius:var(--radius-sm);font-weight:600;font-size:.88rem;display:none;animation:slideIn .25s ease}
.feedback.show{display:flex;align-items:center;gap:6px}
.feedback.ok{background:var(--success-light);color:#166534;border:1px solid #bbf7d0}
.feedback.no{background:var(--error-light);color:#991b1b;border:1px solid #fecaca}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.explanation{margin-top:14px;padding:14px 16px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:var(--radius-sm);border-left:4px solid #0ea5e9;font-size:.85rem;line-height:1.75;display:none;animation:slideIn .3s ease;white-space:pre-line}
.explanation.show{display:block}
.essay-card{text-align:center;padding:32px 16px}
.essay-question{font-size:1.15rem;font-weight:600;line-height:1.8;margin:18px 0;padding:18px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:var(--radius);border:2px dashed #f59e0b}
.essay-meta{color:var(--text-secondary);font-size:.82rem;margin-top:8px}
.empty-state{text-align:center;padding:60px 16px;color:var(--text-secondary)}
.empty-state .emoji{font-size:3rem;margin-bottom:14px}
.empty-state h3{font-size:1.2rem;margin-bottom:6px;color:var(--text)}
.kbd-hints{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px;font-size:.75rem;color:var(--text-secondary)}
.kbd{display:inline-block;background:#f1f5f9;border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-family:monospace;font-size:.75rem;font-weight:600}
.footer{text-align:center;padding:14px;color:var(--text-secondary);font-size:.76rem}
.reset-area{display:flex;justify-content:flex-end;margin-bottom:12px;flex-wrap:wrap;gap:6px}
.btn-reset{font-size:.72rem;padding:4px 10px;background:transparent;color:var(--text-secondary);border:1px solid var(--border);border-radius:20px;cursor:pointer;transition:var(--transition);min-height:32px}
.btn-reset:hover{background:var(--error-light);color:var(--error);border-color:var(--error)}
.essay-list{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.essay-item{padding:10px 14px;background:#f8fafc;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:.82rem;display:flex;align-items:center;gap:8px}
.essay-item .num{font-weight:700;color:var(--primary);flex-shrink:0}

/* ===== MOBILE ===== */
.mobile-nav-bar{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--card-bg);border-top:1px solid var(--border);z-index:200;padding:4px 2px var(--safe-bottom);box-shadow:0 -2px 10px rgba(0,0,0,.08)}
.mobile-nav-bar .mob-row{display:flex;width:100%;max-width:500px;margin:0 auto;gap:0}
.mobile-nav-bar .mob-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 1px;border:none;background:none;color:var(--text-secondary);font-size:.58rem;cursor:pointer;transition:var(--transition);gap:1px;-webkit-tap-highlight-color:transparent;min-height:48px}
.mobile-nav-bar .mob-btn .mob-icon{font-size:1.1rem}
.mobile-nav-bar .mob-btn.active{color:var(--primary)}
body.is-mobile .header{padding:8px 10px}
body.is-mobile .header h1{font-size:.9rem}
body.is-mobile .header-stats{font-size:.68rem;gap:4px}
body.is-mobile .nav{top:36px}
body.is-mobile .nav-tab{padding:8px 14px;font-size:.72rem;min-height:38px}
body.is-mobile .main{padding:10px 6px 100px}
body.is-mobile .card-body{padding:12px}
body.is-mobile .question-text{font-size:.9rem;line-height:1.7}
body.is-mobile .option-btn{padding:11px 12px;font-size:.85rem;border-radius:6px;min-height:46px}
body.is-mobile .opt-icon{width:28px;height:28px;font-size:.76rem}
body.is-mobile .btn{padding:10px 12px;font-size:.8rem;min-height:42px;border-radius:6px}
body.is-mobile .actions{gap:5px}
body.is-mobile .card-header{padding:10px 12px}
body.is-mobile .progress-section{padding:10px 12px}
body.is-mobile .kbd-hints{display:none}
body.is-mobile .footer{font-size:.68rem;padding:8px 8px 80px}
body.is-mobile .essay-card{padding:20px 8px}
body.is-mobile .essay-question{font-size:.95rem;padding:14px}
body.is-mobile .mobile-nav-bar{display:block}
body.is-mobile .reset-area{margin-bottom:4px}
body.is-mobile .qnav-dot{min-width:28px;min-height:28px;font-size:.65rem}
body.is-mobile .exam-banner{font-size:.75rem;padding:6px 10px}
body.is-mobile .exam-toggle-btn{font-size:.72rem;padding:5px 10px;min-height:36px}
body.is-mobile .results-dot{min-width:30px;min-height:30px;font-size:.65rem}
body.is-mobile .qnav-panel{padding:14px;max-height:60vh}
body.is-mobile .explanation{font-size:.78rem;padding:10px 12px}
body.is-mobile .toolbar{padding:8px 10px;gap:6px}
body.is-mobile .toggle-btn{padding:5px 10px;font-size:.72rem}
body.is-mobile .btn-exam{font-size:.72rem;padding:5px 10px}
@media(max-width:400px){
  .nav-tab{padding:7px 12px;font-size:.7rem;min-height:36px}
  .question-text{font-size:.85rem}
  .option-btn{padding:10px;font-size:.82rem;min-height:44px}
  .btn{padding:9px 10px;font-size:.76rem;min-height:40px}
  .qnav-grid{grid-template-columns:repeat(auto-fill,minmax(28px,1fr));gap:4px}
  .qnav-dot{font-size:.6rem}
}
@media(prefers-color-scheme:dark){
  :root{--bg:#0f172a;--card-bg:#1e293b;--primary:#818cf8;--primary-light:#1e1b4b;--success:#4ade80;--success-light:#052e16;--error:#f87171;--error-light:#450a0a;--text:#f1f5f9;--text-secondary:#94a3b8;--border:#334155;--shadow:0 1px 3px rgba(0,0,0,.3);--shadow-md:0 4px 6px rgba(0,0,0,.4)}
  .option-btn{background:#1e293b}
  .option-btn:hover{background:#1e1b4b}
  .opt-icon{background:#334155;color:#94a3b8}
  .essay-question{background:linear-gradient(135deg,#422006,#713f12);border-color:#a16207}
  .essay-item{background:#1e293b}
  .kbd{background:#334155;border-color:#475569}
  .progress-bar-outer{background:#334155}
  .feedback.ok{background:#052e16;color:#86efac;border-color:#166534}
  .feedback.no{background:#450a0a;color:#fca5a5;border-color:#991b1b}
  .exam-banner{background:linear-gradient(135deg,#422006,#713f12);color:#fbbf24}
  .qnav-dot.done-seen{background:#422006;border-color:#eab308;color:#fbbf24}
  .exam-btn-submit{background:#991b1b}
  .explanation{background:linear-gradient(135deg,#0c1929,#0f2847);border-left-color:#38bdf8}
}
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <h1>📚 毛概题库复习系统</h1>
    <div class="header-stats">
      <span>✅ <strong id="totalCorrect">0</strong></span>
      <span>❌ <strong id="totalWrong">0</strong></span>
      <span>📝 <strong id="totalDone">0</strong></span>
    </div>
  </div>
</div>

<nav class="nav">
  <div class="nav-inner" id="navTabs">
    <button class="nav-tab active" data-tab="single">📋 单选题<span class="badge">${singleChoice.length}</span></button>
    <button class="nav-tab" data-tab="multi">✅ 多选题<span class="badge">${multiChoice.length}</span></button>
    <button class="nav-tab" data-tab="judge">⚖️ 判断题<span class="badge">${judgeQuestions.length}</span></button>
    <button class="nav-tab" data-tab="essay">📄 大题<span class="badge">${essayQuestions.length}</span></button>
  </div>
</nav>

<div class="main" id="mainContent"></div>

<div class="footer" id="footerHints"><p>💡 <kbd class="kbd">1-5</kbd>选择 <kbd class="kbd">Enter</kbd>提交 <kbd class="kbd">←→</kbd>翻题 <kbd class="kbd">R</kbd>看答案</p></div>

<div class="mobile-nav-bar" id="mobileNav">
  <div class="mob-row">
    <button class="mob-btn active" data-mob="single"><span class="mob-icon">📋</span>单选</button>
    <button class="mob-btn" data-mob="multi"><span class="mob-icon">✅</span>多选</button>
    <button class="mob-btn" data-mob="judge"><span class="mob-icon">⚖️</span>判断</button>
    <button class="mob-btn" data-mob="essay"><span class="mob-icon">📄</span>大题</button>
  </div>
</div>

<div class="qnav-overlay" id="qnavOverlay">
  <div class="qnav-panel" id="qnavPanel"></div>
</div>

<script>
(function(){
  var ua = navigator.userAgent || '';
  var mobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (window.innerWidth < 768);
  if (mobile) document.body.classList.add('is-mobile');
})();

// ===== DATA =====
const DATA = ${JSON.stringify({ singleChoice, multiChoice, judgeQuestions, shortAnswerQuestions, longEssayQuestions })};
const EXPLANATIONS_DATA = ${JSON.stringify(EXPLANATIONS)};

// ===== HELPERS =====
function shuffle(arr) { var a=arr.slice(); for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }

// ===== STATE =====
const STORAGE_KEY = 'maogai_study_v6';

function makeDefaultState() {
  return {
    currentTab: 'single',
    // For single/multi/judge: { orderMode: 'seq'|'rand', currentIndex, answers: {qId: userAnswer}, shuffled }
    single: { orderMode: 'seq', currentIndex: 0, answers: {}, shuffled: null },
    multi:  { orderMode: 'seq', currentIndex: 0, answers: {}, shuffled: null },
    judge:  { orderMode: 'seq', currentIndex: 0, answers: {}, shuffled: null },
    // Essay tab
    essay: { essayTab: 'short', currentIndex: 0 },  // 'short' or 'long'
    // Exam mode
    examMode: false,
    examQuestions: null, // { single:[], multi:[], judge:[], short:[], long:{} }
    examAnswers: {},
    examSubmitted: false
  };
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      var def = makeDefaultState();
      for (var k in def) { if (!(k in s)) s[k] = def[k]; }
      if (!s.single) s.single = def.single;
      if (!s.multi) s.multi = def.multi;
      if (!s.judge) s.judge = def.judge;
      if (!s.essay) s.essay = def.essay;
      return s;
    }
  } catch(e) {}
  return makeDefaultState();
}

let state = loadState();

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getQuestionsForTab(tab) {
  if (tab === 'single') return DATA.singleChoice;
  if (tab === 'multi') return DATA.multiChoice;
  if (tab === 'judge') return DATA.judgeQuestions;
  return [];
}

function getTabState() {
  var tab = state.currentTab;
  if (state.examMode && state.examQuestions) return null; // handled specially
  return state[tab];
}

// ===== RENDER =====
function render() {
  state = state || makeDefaultState();
  if (state.examMode && state.examSubmitted) {
    renderExamResults();
    return;
  }
  if (state.examMode) {
    renderExamMode();
    return;
  }
  renderNormalMode();
}

function renderNormalMode() {
  var tab = state.currentTab;
  var tabState = getTabState();
  if (!tabState) { renderEmpty(); return; }

  var main = document.getElementById('mainContent');
  var html = '';

  // Toolbar
  html += buildToolbar(false);

  // Progress bar for choice modes
  if (tab !== 'essay') {
    html += buildProgress(tab, tabState);
  }

  // Card content
  if (tab === 'essay') {
    html += renderEssayMode(tabState);
  } else {
    var questions = getQuestionsForTab(tab);
    var orderedQ = (tabState.orderMode === 'rand' && tabState.shuffled)
      ? tabState.shuffled.map(function(i) { return questions[i]; })
      : questions;
    var idx = tabState.currentIndex || 0;
    if (idx >= orderedQ.length) idx = orderedQ.length - 1;
    if (idx < 0) idx = 0;
    var q = orderedQ[idx];
    html += renderQuestionCard(q, idx, orderedQ.length, tabState, false, tab, orderedQ);
  }

  // Reset area
  html += '<div class="reset-area" style="margin-top:14px;">'+
    '<button class="btn-reset" id="btnResetMode">🗑 重置'+(tab==='essay'?'大题':(tab==='single'?'单选':tab==='multi'?'多选':'判断'))+'进度</button>'+
    '<button class="btn-reset" id="btnResetAll">⚠ 清除全部记录</button>'+
    '</div>';

  main.innerHTML = html;
  updateHeaderStats();
  updateNav();
  updateMobileNav();
  bindEvents();
}

function buildToolbar(forExam) {
  var tab = state.currentTab;
  var html = '<div class="toolbar">';

  if (!forExam) {
    // Exam button
    html += '<button class="btn-exam" id="btnStartExam">📝 考试模式</button>';

    // Order toggle (not for essay)
    if (tab !== 'essay') {
      var tabState = getTabState();
      var orderMode = tabState ? tabState.orderMode : 'seq';
      html += '<div class="toolbar-sep"></div>';
      html += '<span style="font-size:.8rem;color:var(--text-secondary);">答题顺序：</span>';
      html += '<div class="toggle-group" id="orderToggle">'+
        '<button class="toggle-btn'+(orderMode==='seq'?' active':'')+'" data-order="seq">📋 顺序作答</button>'+
        '<button class="toggle-btn'+(orderMode==='rand'?' active':'')+'" data-order="rand">🎲 随机抽题</button>'+
        '</div>';
    }
  } else {
    html += '<strong style="color:#92400e;">⚠ 考试模式</strong>';
    html += '<span style="font-size:.78rem;color:var(--text-secondary);">18单选 + 12多选 + 10判断 + 3简答 + 1论述</span>';
    html += '<button class="btn-exam active" id="btnExitExam" style="margin-left:auto;">退出考试</button>';
  }

  html += '</div>';
  return html;
}

function buildProgress(tab, tabState) {
  var questions = getQuestionsForTab(tab);
  var total = questions.length;
  var answered = Object.keys(tabState.answers || {}).length;
  var correct = 0;
  for (var qid in tabState.answers) {
    if (tabState.answers[qid] !== '(revealed)') {
      var q = questions.find(function(x) { return x.id == qid; });
      if (q && tabState.answers[qid] === q.answer) correct++;
    }
  }
  var wrong = answered - correct;
  var pct = total > 0 ? Math.round(answered/total*100) : 0;

  return '<div class="progress-section">'+
    '<div class="progress-header">'+
      '<span class="progress-title">'+(tab==='single'?'单选题':tab==='multi'?'多选题':'判断题')+' 进度</span>'+
      '<span class="progress-numbers">'+
        '<span>✅ <span class="c">'+correct+'</span></span>'+
        '<span>❌ <span class="w">'+wrong+'</span></span>'+
        '<span>📝 '+answered+'/'+total+' ('+pct+'%)</span>'+
      '</span>'+
    '</div>'+
    '<div class="progress-bar-outer"><div class="progress-bar-inner" style="width:'+pct+'%"></div></div>'+
    // Question nav trigger
    '<button class="qnav-toggle" id="btnQNav" title="答题卡">⊞</button>'+
    '</div>';
}

function renderQuestionCard(q, idx, total, tabState, inExam, tab, orderedQ) {
  var isMulti = q.type === 'multi';
  var isJudge = q.type === 'judge';
  var userAnswer = inExam ? (state.examAnswers[q.id]) : (tabState.answers[q.id]);
  var isAnswered = userAnswer !== undefined && userAnswer !== null;
  var isCorrect = isAnswered && !inExam && userAnswer === q.answer;
  var showFeedback = isAnswered && !inExam;

  var optsHtml = '';
  q.options.forEach(function(opt) {
    var cls = 'option-btn';
    var userHasThis = false;
    if (isAnswered) {
      if (isMulti || isJudge) {
        userHasThis = (userAnswer || '').indexOf(opt.letter) >= 0;
      } else {
        userHasThis = userAnswer === opt.letter;
      }
    }
    var isActuallyCorrect = q.answer.indexOf(opt.letter) >= 0;
    if (!inExam && userHasThis) cls += ' selected';
    if (showFeedback && isActuallyCorrect && userHasThis) cls += ' correct';
    else if (showFeedback && !isActuallyCorrect && userHasThis) cls += ' incorrect';
    else if (showFeedback && isActuallyCorrect && !userHasThis) cls += ' missed';
    if (inExam && userHasThis) cls += ' selected';

    var suffix = '';
    if (showFeedback) {
      if (isActuallyCorrect && !userHasThis) suffix = '<span style="margin-left:auto;font-size:.75rem;color:#16a34a;">✓</span>';
      else if (userHasThis) suffix = isActuallyCorrect ? '<span style="margin-left:auto;">✅</span>' : '<span style="margin-left:auto;">❌</span>';
    }

    optsHtml += '<button class="'+cls+'" data-letter="'+opt.letter+'"'+(isAnswered&&!inExam?' disabled':'')+'>'+
      '<span class="opt-icon">'+opt.letter+'</span><span>'+opt.text+'</span>'+suffix+'</button>';
  });

  var typeLabel = q.type==='single'?'单选题':q.type==='multi'?'多选题':'判断题';
  var typeCls = q.type==='single'?'single':q.type==='multi'?'multi':'judge';
  var hint = isMulti?'（多选）':isJudge?'（判断正误）':'（单选）';

  var fbHtml = '';
  if (showFeedback) {
    fbHtml = '<div class="feedback show '+(isCorrect?'ok':'no')+'">'+
      (isCorrect?'✅ 回答正确！':'❌ 回答错误，正确答案：<strong>'+q.answer+'</strong>')+'</div>';
  }

  // Explanation
  var expKey = q.type==='single'?'single':q.type==='multi'?'multi':'judge';
  var expText = '';
  try {
    if (EXPLANATIONS_DATA[expKey] && EXPLANATIONS_DATA[expKey][q.id]) {
      expText = EXPLANATIONS_DATA[expKey][q.id];
    }
  } catch(e) {}
  var expHtml = '';
  if (expText && expText.trim()) {
    var lines = expText.trim().split('\\n');
    var expTitle = '', expBody = '';
    lines.forEach(function(ln) {
      ln = ln.trim();
      if (!ln) return;
      if (ln.indexOf('【答案】')===0) expTitle += '<strong style="color:#0ea5e9;">📖 答案：</strong>'+ln.replace('【答案】','')+'<br>';
      else if (ln.indexOf('【解析】')===0) expBody += ln.replace('【解析】','')+'\\n';
      else expBody += ln + '\\n';
    });
    if (!expTitle) expTitle = '<strong style="color:#0ea5e9;">📖 解析</strong><br>';
    expHtml = '<div class="explanation'+(showFeedback?' show':'')+'" id="expBlock">'+expTitle+expBody.trim()+'</div>';
  }

  var mhHtml = '';
  if ((isMulti||isJudge) && !isAnswered) {
    mhHtml = '<div style="margin-top:6px;font-size:.78rem;color:var(--text-secondary);">已选：<strong id="selectedLabels">-</strong></div>';
  } else if (inExam && isAnswered) {
    mhHtml = '<div style="margin-top:6px;font-size:.78rem;color:var(--primary);">已答 ✓</div>';
  }

  return '<div class="card">'+
    '<div class="card-header">'+
      '<span class="q-num">第 '+(idx+1)+' / '+total+' 题</span>'+
      '<span class="q-type '+typeCls+'">'+typeLabel+' '+hint+'</span>'+
    '</div>'+
    '<div class="card-body">'+
      '<div class="question-text">'+q.question+'</div>'+
      '<div class="options-list" id="optionsList">'+optsHtml+'</div>'+
      mhHtml+fbHtml+expHtml+
      '<div class="actions">'+
        (!isAnswered||inExam
          ? '<button class="btn btn-primary" id="btnSubmit"'+(isMulti||isJudge||inExam?'':' disabled')+'>📝 提交</button>'+
            (!inExam?'<button class="btn btn-outline" id="btnReveal">👁 看答案</button>':'')
          : '<button class="btn btn-outline" id="btnReveal">👁 看答案</button>')+
        '<button class="btn btn-ghost" id="btnPrev"'+(idx===0?' disabled':'')+'>⬅ 上一题</button>'+
        '<button class="btn btn-primary" id="btnNext"'+(idx>=total-1?' disabled':'')+'>下一题 ➡</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function renderEssayMode(tabState) {
  var essayTab = tabState.essayTab || 'short';
  var questions = essayTab === 'short' ? DATA.shortAnswerQuestions : DATA.longEssayQuestions;
  var idx = tabState.currentIndex || 0;
  if (idx >= questions.length) idx = questions.length - 1;
  if (idx < 0) idx = 0;
  var q = questions[idx];
  var total = questions.length;
  var label = essayTab === 'short' ? '简答题' : '论述题';

  var toggleHtml = '<div class="toggle-group" id="essayToggle" style="margin-bottom:12px;">'+
    '<button class="toggle-btn'+(essayTab==='short'?' active':'')+'" data-essay="short">📝 简答题 (1-13)</button>'+
    '<button class="toggle-btn'+(essayTab==='long'?' active':'')+'" data-essay="long">📖 论述题 (14-21)</button>'+
    '</div>';

  var qnavHtml = '<button class="qnav-toggle" id="btnQNavEssay" title="答题卡" style="position:static;display:inline-flex;margin-left:8px;">⊞</button>';

  return '<div class="card"><div class="card-header">'+
    '<span class="q-num">📄 大题抽取 · '+label+'</span>'+
    '<span class="q-type essay">共 '+total+' 题</span>'+
    '</div>'+
    '<div class="card-body essay-card">'+
    toggleHtml +
    '<div class="essay-question"><strong>#'+q.id + '</strong> ' + q.question + '</div>'+
    '<div class="essay-meta">第 '+(idx+1)+' / '+total+' 题</div>'+
    '<div class="actions" style="justify-content:center;">'+
      '<button class="btn btn-outline" id="btnEssayRand">🎲 随机抽一题</button>'+
      '<button class="btn btn-ghost" id="btnPrev"'+(idx===0?' disabled':'')+'>⬅ 上一题</button>'+
      '<button class="btn btn-primary" id="btnNext"'+(idx>=total-1?' disabled':'')+'>下一题 ➡</button>'+
    '</div>'+
    '<div style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;">'+
      qnavHtml + '<span style="font-size:.72rem;color:var(--text-secondary);">答题卡</span>'+
    '</div>'+
    '</div></div>';
}

function renderEmpty() {
  document.getElementById('mainContent').innerHTML = '<div class="empty-state"><div class="emoji">📚</div><h3>暂无内容</h3></div>';
}

// ===== EXAM MODE =====
function startExam() {
  var singleQ = shuffle(DATA.singleChoice).slice(0, 18);
  var multiQ = shuffle(DATA.multiChoice).slice(0, 12);
  var judgeQ = shuffle(DATA.judgeQuestions).slice(0, 10);
  var shortQ = shuffle(DATA.shortAnswerQuestions).slice(0, 3);
  var longQ = shuffle(DATA.longEssayQuestions)[0];

  state.examMode = true;
  state.examQuestions = { single: singleQ, multi: multiQ, judge: judgeQ, short: shortQ, long: longQ };
  state.examAnswers = {};
  state.examSubmitted = false;
  state.currentTab = 'single'; // exam starts on first single-choice
  state.examCurrentType = 'single'; // which section we're in
  state.examTypeIdx = 0; // index within the section
  saveState();
  render();
}

function exitExam() {
  if (Object.keys(state.examAnswers).length > 0) {
    if (!confirm('确定要退出考试吗？已作答的答案将丢失！')) return;
  }
  state.examMode = false;
  state.examQuestions = null;
  state.examAnswers = {};
  state.examSubmitted = false;
  saveState();
  render();
}

function submitExam() {
  var totalAnswered = Object.keys(state.examAnswers).length;
  var allQ = getAllExamQuestions();
  var msg = '确定要交卷吗？';
  if (totalAnswered < allQ.length) msg += '还有 '+(allQ.length-totalAnswered)+' 道题未作答。';
  if (!confirm(msg)) return;
  state.examSubmitted = true;
  saveState();
  render();
}

function getAllExamQuestions() {
  if (!state.examQuestions) return [];
  var eq = state.examQuestions;
  return eq.single.concat(eq.multi).concat(eq.judge).concat(eq.short).concat(eq.long ? [eq.long] : []);
}

function getCurrentExamSection() {
  var eq = state.examQuestions;
  if (!eq) return null;
  var sections = [
    { key: 'single', label: '单选题', questions: eq.single, total: 18 },
    { key: 'multi', label: '多选题', questions: eq.multi, total: 12 },
    { key: 'judge', label: '判断题', questions: eq.judge, total: 10 },
    { key: 'short', label: '简答题', questions: eq.short, total: 3 },
    { key: 'long', label: '论述题', questions: eq.long ? [eq.long] : [], total: 1 }
  ];
  return sections;
}

function renderExamMode() {
  var sections = getCurrentExamSection();
  var main = document.getElementById('mainContent');
  var html = buildToolbar(true);
  html += '<div class="exam-banner active">⚠ 考试模式：18单选 + 12多选 + 10判断 + 3简答 + 1论述 | '+
    '已答：'+Object.keys(state.examAnswers).length+'/'+(18+12+10+3+1)+
    ' <button class="exam-btn exam-btn-submit" id="btnSubmitExam">交卷</button>'+
    '</div>';

  // Progress
  html += '<div class="progress-section">'+
    '<div class="progress-header"><span class="progress-title">📝 考试进度</span></div>'+
    '<div class="progress-numbers" style="margin-bottom:8px;">';
  sections.forEach(function(sec) {
    var done = sec.questions.filter(function(q) { return state.examAnswers[q.id] !== undefined; }).length;
    html += '<span style="margin-right:10px;">'+sec.label+': <strong>'+done+'/'+sec.total+'</strong></span>';
  });
  html += '</div>'+
    '<div class="progress-bar-outer"><div class="progress-bar-inner" style="width:'+
    Math.round(Object.keys(state.examAnswers).length/(18+12+10+3+1)*100)+'%"></div></div>'+
    '<button class="qnav-toggle" id="btnQNavExam" title="答题卡" style="position:static;display:inline-flex;margin-top:8px;">⊞ 答题卡</button>'+
    '</div>';

  // Current question
  var currentType = state.examCurrentType || 'single';
  var currentIdx = state.examTypeIdx || 0;
  var allSections = getCurrentExamSection();
  var currentSec = allSections.find(function(s) { return s.key === currentType; });
  if (!currentSec) currentSec = allSections[0];
  if (currentIdx >= currentSec.questions.length) currentIdx = currentSec.questions.length - 1;
  if (currentIdx < 0) currentIdx = 0;
  var q = currentSec.questions[currentIdx];

  var isEssay = (currentType === 'short' || currentType === 'long');
  if (isEssay) {
    html += '<div class="card"><div class="card-header">'+
      '<span class="q-num">'+currentSec.label+' 第 '+(currentIdx+1)+' / '+currentSec.total+' 题</span>'+
      '<span class="q-type essay">'+(currentType==='short'?'简答题':'论述题')+'</span>'+
      '</div>'+
      '<div class="card-body essay-card">'+
      '<div class="essay-question"><strong>#'+q.id+'</strong> '+q.question+'</div>'+
      '<div style="margin-top:10px;font-size:.85rem;color:var(--text-secondary);">（本题需在纸质试卷上作答，此处仅作浏览）</div>'+
      '<div class="actions" style="justify-content:center;">'+
        (!state.examAnswers[q.id]
          ? '<button class="btn btn-primary" id="btnMarkDone">✅ 标记已浏览</button>'
          : '<span style="color:var(--success);font-weight:600;">✅ 已浏览</span>')+
        buildExamNavButtons(currentType, currentIdx, allSections)+
      '</div></div></div>';
  } else {
    html += renderQuestionCard(q, currentIdx, currentSec.total, null, true, currentType, currentSec.questions);
  }

  main.innerHTML = html;
  updateHeaderStats();
  updateNav();
  updateMobileNav();
  bindExamEvents(allSections);
}

function buildExamNavButtons(currentType, currentIdx, allSections) {
  var html = '';
  var currentSecIdx = -1;
  for (var i = 0; i < allSections.length; i++) {
    if (allSections[i].key === currentType) { currentSecIdx = i; break; }
  }

  // Prev button
  var prevDisabled = true;
  if (currentIdx > 0) prevDisabled = false;
  else if (currentSecIdx > 0) prevDisabled = false;
  html += '<button class="btn btn-ghost" id="btnPrev"'+(prevDisabled?' disabled':'')+'>⬅ 上一题</button>';

  // Next button
  var isLastQ = currentIdx >= allSections[currentSecIdx].total - 1;
  var isLastSection = currentSecIdx >= allSections.length - 1;
  var nextDisabled = isLastQ && isLastSection;
  html += '<button class="btn btn-primary" id="btnNext"'+(nextDisabled?' disabled':'')+'>下一题 ➡</button>';

  return html;
}

function renderExamResults() {
  var eq = state.examQuestions;
  if (!eq) return;
  var allChoice = eq.single.concat(eq.multi).concat(eq.judge);
  var totalObj = allChoice.length;
  var correctCount = 0;
  var details = [];

  allChoice.forEach(function(q) {
    var ua = state.examAnswers[q.id] || '';
    if (ua === '(revealed)') ua = '';
    var ok = ua === q.answer;
    if (ok) correctCount++;
    details.push({ q: q, user: ua, ok: ok, type: q.type });
  });

  var score = correctCount;
  var html = '<div class="results-panel show">'+
    '<div class="results-score">'+
      '<div class="big-score">'+correctCount+' / '+totalObj+'</div>'+
      '<div class="score-label">客观题得分（每题1分，共'+totalObj+'分）</div>'+
      '<div style="margin-top:8px;color:var(--text-secondary);font-size:.85rem;">简答题3道 + 论述题1道 需在纸质试卷上作答</div>'+
    '</div>'+
    '<div class="results-bar"><div class="results-bar-fill" style="width:'+Math.round(correctCount/totalObj*100)+'%;background:'+(correctCount/totalObj>=0.6?'var(--success)':'var(--error)')+'"></div></div>'+
    '<div style="text-align:center;font-weight:600;margin-bottom:12px;">'+(['😢 继续加油！','📖 还需努力！','👍 表现不错！','🎉 非常优秀！'][Math.min(3, Math.floor(correctCount/totalObj*4))])+'</div>'+
    '<div class="results-grid">';

  details.forEach(function(d, i) {
    html += '<button class="results-dot '+(d.ok?'correct':'wrong')+'" title="\u9898#'+(i+1)+' '+(d.ok?'\u6b63\u786e':'\u9519\u8bef')+'" data-detail="'+i+'">'+(i+1)+'</button>';
  });

  window._examDetails = details;

  html += '</div><div style="text-align:center;margin-top:16px;">'+
    '<button class="btn btn-primary" id="btnExitResults">\ud83d\udd04 \u9000\u51fa\u6210\u7ee9\u5355</button>'+
    '</div></div>';

  document.getElementById('mainContent').innerHTML = html;

  document.querySelectorAll('.results-dot[data-detail]').forEach(function(btn) {
    btn.onclick = function() {
      var d = window._examDetails[parseInt(this.dataset.detail)];
      if (d) {
        var parts = [];
        parts.push('\u9898#' + d.q.id + '\uff1a' + d.q.question.substring(0, 80) + '...');
        parts.push('');
        parts.push('\u4f60\u7684\u7b54\u6848\uff1a' + d.user);
        parts.push('\u6b63\u786e\u7b54\u6848\uff1a' + d.q.answer);
        parts.push('');
        parts.push(d.ok ? '\u56de\u7b54\u6b63\u786e \u2713' : '\u56de\u7b54\u9519\u8bef \u2717');
        alert(parts.join(String.fromCharCode(10)));
      }
    };
  });

  document.getElementById('btnExitResults').onclick = function() {
    state.examMode=false; state.examQuestions=null; state.examAnswers={}; state.examSubmitted=false; saveState(); render();
  };
  updateHeaderStats();
}

// ===== NAVIGATION =====
function updateNav() {
  var tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === state.currentTab);
  });
  // Hide footer hints during exam
  var footer = document.getElementById('footerHints');
  if (footer) footer.style.display = state.examMode ? 'none' : '';
}

function updateMobileNav() {
  var btns = document.querySelectorAll('.mob-btn[data-mob]');
  btns.forEach(function(b) {
    b.classList.toggle('active', b.dataset.mob === state.currentTab);
  });
}

function updateHeaderStats() {
  var totalCorrect = 0, totalWrong = 0, totalDone = 0;
  ['single','multi','judge'].forEach(function(k) {
    var ts = state[k];
    if (!ts) return;
    var questions = getQuestionsForTab(k);
    for (var qid in ts.answers) {
      totalDone++;
      if (ts.answers[qid] !== '(revealed)') {
        var q = questions.find(function(x) { return x.id == qid; });
        if (q && ts.answers[qid] === q.answer) totalCorrect++;
        else totalWrong++;
      }
    }
  });
  document.getElementById('totalCorrect').textContent = totalCorrect;
  document.getElementById('totalWrong').textContent = totalWrong;
  document.getElementById('totalDone').textContent = totalDone;
}

// ===== OPEN QUESTION NAVIGATOR =====
function openQNav(questions, tabState, mode, inExam) {
  var overlay = document.getElementById('qnavOverlay');
  var panel = document.getElementById('qnavPanel');
  var total = questions.length;
  var currentIdx = inExam ? (state.examTypeIdx || 0) : (tabState.currentIndex || 0);

  var orderedQ = questions;
  if (!inExam && tabState && tabState.shuffled) {
    orderedQ = tabState.shuffled.map(function(i) { return questions[i]; });
  }

  var html = '<h3>📋 答题卡 <button class="qnav-close" id="qnavClose">✕</button></h3>';
  html += '<div class="qnav-grid">';
  for (var i = 0; i < total; i++) {
    var q = orderedQ[i];
    var cls = 'qnav-dot';
    if (i === currentIdx) cls += ' current';
    if (!inExam && tabState && tabState.answers[q.id]) {
      if (tabState.answers[q.id] === '(revealed)') cls += ' done-seen';
      else if (tabState.answers[q.id] === q.answer) cls += ' done-correct';
      else cls += ' done-wrong';
    }
    if (inExam && state.examAnswers[q.id]) cls += ' done-correct';
    html += '<button class="'+cls+'" data-idx="'+i+'">'+(i+1)+'</button>';
  }
  html += '</div>';
  panel.innerHTML = html;
  overlay.classList.add('open');

  // Bind close
  document.getElementById('qnavClose').onclick = function() { overlay.classList.remove('open'); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.classList.remove('open'); };

  // Bind click
  panel.querySelectorAll('.qnav-dot').forEach(function(dot) {
    dot.onclick = function() {
      var newIdx = parseInt(this.dataset.idx);
      overlay.classList.remove('open');
      if (inExam) {
        state.examTypeIdx = newIdx;
        saveState(); render();
      } else {
        tabState.currentIndex = newIdx;
        saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
      }
    };
  });
}

// ===== EVENTS =====
function bindEvents() {
  if (state.examMode) return;
  var tab = state.currentTab;
  var tabState = getTabState();
  if (!tabState) return;

  // Tab navigation
  document.querySelectorAll('.nav-tab').forEach(function(t) {
    t.onclick = function() {
      state.currentTab = this.dataset.tab;
      saveState(); render();
    };
  });

  // Mobile nav
  document.querySelectorAll('.mob-btn[data-mob]').forEach(function(b) {
    b.onclick = function() {
      state.currentTab = this.dataset.mob;
      saveState(); render();
    };
  });

  // Order toggle
  var orderBtns = document.querySelectorAll('#orderToggle .toggle-btn');
  if (orderBtns.length > 0) {
    orderBtns.forEach(function(btn) {
      btn.onclick = function() {
        var newOrder = this.dataset.order;
        if (tabState.orderMode === newOrder) return;
        tabState.orderMode = newOrder;
        if (newOrder === 'rand') {
          var questions = getQuestionsForTab(tab);
          tabState.shuffled = shuffle(questions.map(function(_,i){return i;}));
        }
        tabState.currentIndex = 0;
        saveState(); render();
      };
    });
  }

  // Exam button
  var btnStartExam = document.getElementById('btnStartExam');
  if (btnStartExam) btnStartExam.onclick = startExam;

  if (tab === 'essay') {
    bindEssayEvents(tabState);
    return;
  }

  // Choice events
  bindChoiceEvents(tab, tabState, false);
}

function bindEssayEvents(tabState) {
  // Essay toggle
  document.querySelectorAll('#essayToggle .toggle-btn').forEach(function(btn) {
    btn.onclick = function() {
      tabState.essayTab = this.dataset.essay;
      tabState.currentIndex = 0;
      saveState(); render();
    };
  });

  // Prev/Next
  var essayQuestions = tabState.essayTab === 'short' ? DATA.shortAnswerQuestions : DATA.longEssayQuestions;
  document.getElementById('btnPrev').onclick = function() {
    if (tabState.currentIndex > 0) { tabState.currentIndex--; saveState(); render(); }
  };
  document.getElementById('btnNext').onclick = function() {
    if (tabState.currentIndex < essayQuestions.length - 1) { tabState.currentIndex++; saveState(); render(); }
  };
  document.getElementById('btnEssayRand').onclick = function() {
    tabState.currentIndex = Math.floor(Math.random() * essayQuestions.length);
    saveState(); render();
  };
  document.getElementById('btnQNavEssay').onclick = function() {
    openQNav(essayQuestions, tabState, 'essay', false);
  };

  document.getElementById('btnResetMode').onclick = function() {
    if (confirm('确定要重置大题进度吗？')) { state.essay = { essayTab:'short',currentIndex:0 }; saveState(); render(); }
  };
  document.getElementById('btnResetAll').onclick = function() {
    if (confirm('确定要清除全部学习记录吗？此操作不可恢复！')) { localStorage.removeItem(STORAGE_KEY); state=loadState(); render(); }
  };
}

function bindChoiceEvents(tab, tabState, inExam) {
  var questions = getQuestionsForTab(tab);
  var orderedQ = (!inExam && tabState.orderMode === 'rand' && tabState.shuffled)
    ? tabState.shuffled.map(function(i) { return questions[i]; })
    : questions;
  var idx = tabState.currentIndex || 0;
  if (idx >= orderedQ.length) idx = orderedQ.length - 1;
  if (idx < 0) idx = 0;
  var currentQ = orderedQ[idx];
  var isMulti = currentQ.type === 'multi';
  var isJudge = currentQ.type === 'judge';
  var userAnswer = inExam ? (state.examAnswers[currentQ.id]) : (tabState.answers[currentQ.id]);
  var isAnswered = userAnswer !== undefined && userAnswer !== null;
  var selected = isMulti || isJudge ? [] : '';

  if (inExam && isAnswered) {
    if (isMulti || isJudge) selected = (userAnswer || '').split('');
    else selected = userAnswer;
  }

  // Single-select click
  if (!isMulti && !isJudge && (!isAnswered || inExam)) {
    document.querySelectorAll('.option-btn').forEach(function(btn) {
      btn.onclick = function() {
        document.querySelectorAll('.option-btn').forEach(function(b){b.classList.remove('selected');});
        this.classList.add('selected');
        selected = this.dataset.letter;
        var sb = document.getElementById('btnSubmit');
        if(sb) sb.disabled = false;
      };
    });
    if (inExam && selected) {
      var selBtn = document.querySelector('.option-btn[data-letter="'+selected+'"]');
      if (selBtn) selBtn.classList.add('selected');
    }
  }

  // Multi/judge select click
  if ((isMulti || isJudge) && (!isAnswered || inExam)) {
    document.querySelectorAll('.option-btn').forEach(function(btn) {
      btn.onclick = function() {
        var letter = this.dataset.letter;
        if (isJudge) {
          document.querySelectorAll('.option-btn').forEach(function(b){b.classList.remove('selected');});
          this.classList.add('selected');
          selected = [letter];
        } else {
          var pos = selected.indexOf(letter);
          if (pos >= 0) { selected.splice(pos,1); this.classList.remove('selected'); }
          else { selected.push(letter); this.classList.add('selected'); }
        }
        var sb = document.getElementById('btnSubmit');
        if (sb) sb.disabled = selected.length === 0;
        var labelsEl = document.getElementById('selectedLabels');
        if (labelsEl) labelsEl.textContent = selected.length > 0 ? selected.join(', ') : '-';
      };
    });
    if (inExam && selected.length > 0) {
      document.querySelectorAll('.option-btn').forEach(function(btn) {
        if (selected.indexOf(btn.dataset.letter) >= 0) btn.classList.add('selected');
      });
    }
  }

  // Submit
  var btnSubmit = document.getElementById('btnSubmit');
  if (btnSubmit) btnSubmit.onclick = function() { doSubmit(); };

  // Reveal
  var btnReveal = document.getElementById('btnReveal');
  if (btnReveal) btnReveal.onclick = function() { doReveal(); };

  // Navigation
  document.getElementById('btnPrev').onclick = function() { navigate(-1); };
  document.getElementById('btnNext').onclick = function() { navigate(1); };

  // Question navigator
  document.getElementById('btnQNav').onclick = function() {
    openQNav(orderedQ, tabState, tab, inExam);
  };

  // Reset buttons
  document.getElementById('btnResetMode').onclick = function() {
    if (confirm('确定要重置当前模式的所有进度吗？')) {
      tabState.currentIndex = 0; tabState.answers = {}; tabState.shuffled = null;
      state.examMode = false; state.examAnswers = {}; state.examSubmitted = false;
      saveState(); render();
    }
  };
  document.getElementById('btnResetAll').onclick = function() {
    if (confirm('确定要清除全部学习记录吗？此操作不可恢复！')) {
      localStorage.removeItem(STORAGE_KEY); state = loadState(); render();
    }
  };

  function doSubmit() {
    if (isAnswered && !inExam) return;
    var ua = isMulti ? selected.slice().sort().join('') : (isJudge ? (selected[0]||'') : selected);
    if (!ua || (isMulti && ua.length === 0)) return;

    if (inExam) {
      state.examAnswers[currentQ.id] = ua;
      saveState();
      if (idx < orderedQ.length - 1) {
        tabState.currentIndex = idx + 1;
        saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
      } else {
        advanceExamSection();
      }
    } else {
      tabState.answers[currentQ.id] = ua;
      saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
    }
  }

  function doReveal() {
    if (isAnswered) return;
    if (inExam) {
      state.examAnswers[currentQ.id] = '(revealed)';
    } else {
      tabState.answers[currentQ.id] = '(revealed)';
    }
    saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
  }

  function navigate(dir) {
    if (inExam && selected && (typeof selected==='string'?selected.length>0:selected.length>0)) {
      var ua = isMulti ? selected.slice().sort().join('') : (isJudge?(selected[0]||''):selected);
      state.examAnswers[currentQ.id] = ua;
      saveState();
    }
    var newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < orderedQ.length) {
      tabState.currentIndex = newIdx;
      saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
    }
  }

  // Keyboard
  if (window._kbCleanup) window._kbCleanup();
  var handler = function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key >= '1' && e.key <= '5') {
      var idx2 = parseInt(e.key) - 1;
      var btns = document.querySelectorAll('.option-btn');
      if (btns[idx2]) btns[idx2].click();
    }
    if ((e.key === 'Enter' || e.key === ' ') && !isAnswered) { e.preventDefault(); doSubmit(); }
    if ((e.key === 'ArrowLeft' || (e.key === 'ArrowUp' && e.ctrlKey))) { e.preventDefault(); navigate(-1); }
    if (e.key === 'ArrowRight' || (e.key === 'ArrowDown' && e.ctrlKey)) { e.preventDefault(); navigate(1); }
    if ((e.key === 'r' || e.key === 'R') && !isAnswered && !inExam) { e.preventDefault(); doReveal(); }
  };
  document.addEventListener('keydown', handler);
  window._kbCleanup = function() { document.removeEventListener('keydown', handler); };
}

// ===== EXAM EVENTS =====
function bindExamEvents(allSections) {
  var currentType = state.examCurrentType || 'single';
  var currentIdx = state.examTypeIdx || 0;
  var currentSec = allSections.find(function(s) { return s.key === currentType; });
  if (!currentSec) return;

  var isEssay = (currentType === 'short' || currentType === 'long');

  // Tab nav during exam: switch between sections
  document.querySelectorAll('.nav-tab').forEach(function(t) {
    t.onclick = function() {
      var newType = this.dataset.tab;
      if (newType === 'essay') {
        // Toggle between short/long
        var essaySub = this.dataset.essay || 'short';
        newType = essaySub;
      }
      // Map tab to exam section
      if (newType === 'single' || newType === 'multi' || newType === 'judge' || newType === 'short' || newType === 'long') {
        state.examCurrentType = newType;
        state.examTypeIdx = 0;
        saveState(); render();
      }
    };
  });

  // Exit exam
  document.getElementById('btnExitExam').onclick = exitExam;

  // Submit exam
  document.getElementById('btnSubmitExam').onclick = submitExam;

  // Question navigator
  document.getElementById('btnQNavExam').onclick = function() {
    openQNav(currentSec.questions, null, currentType, true);
  };

  if (isEssay) {
    // Mark done
    var btnMark = document.getElementById('btnMarkDone');
    if (btnMark) btnMark.onclick = function() {
      state.examAnswers[currentSec.questions[currentIdx].id] = '(seen)';
      saveState(); render();
    };

    // Navigation
    document.getElementById('btnPrev').onclick = function() { examNavigate(-1, allSections); };
    document.getElementById('btnNext').onclick = function() { examNavigate(1, allSections); };
  } else {
    // Choice mode within exam
    bindChoiceEventsForExam(allSections);
  }
}

function examNavigate(dir, allSections) {
  var currentType = state.examCurrentType || 'single';
  var currentIdx = state.examTypeIdx || 0;
  var currentSecIdx = -1;
  for (var i = 0; i < allSections.length; i++) {
    if (allSections[i].key === currentType) { currentSecIdx = i; break; }
  }

  var newIdx = currentIdx + dir;
  if (newIdx >= 0 && newIdx < allSections[currentSecIdx].total) {
    state.examTypeIdx = newIdx;
  } else if (dir > 0 && currentSecIdx < allSections.length - 1) {
    state.examCurrentType = allSections[currentSecIdx + 1].key;
    state.examTypeIdx = 0;
  } else if (dir < 0 && currentSecIdx > 0) {
    state.examCurrentType = allSections[currentSecIdx - 1].key;
    state.examTypeIdx = allSections[currentSecIdx - 1].total - 1;
  }
  saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
}

function advanceExamSection() {
  var allSections = getCurrentExamSection();
  examNavigate(1, allSections);
}

function bindChoiceEventsForExam(allSections) {
  var currentType = state.examCurrentType || 'single';
  var currentIdx = state.examTypeIdx || 0;
  var currentSec = allSections.find(function(s) { return s.key === currentType; });
  if (!currentSec) return;
  var currentQ = currentSec.questions[currentIdx];
  var isMulti = currentQ.type === 'multi';
  var isJudge = currentQ.type === 'judge';
  var userAnswer = state.examAnswers[currentQ.id];
  var isAnswered = userAnswer !== undefined && userAnswer !== null;
  var selected = isMulti || isJudge ? [] : '';

  if (isAnswered) {
    if (isMulti || isJudge) selected = (userAnswer || '').split('');
    else selected = userAnswer;
  }

  // Single
  if (!isMulti && !isJudge) {
    document.querySelectorAll('.option-btn').forEach(function(btn) {
      btn.onclick = function() {
        document.querySelectorAll('.option-btn').forEach(function(b){b.classList.remove('selected');});
        this.classList.add('selected');
        selected = this.dataset.letter;
        document.getElementById('btnSubmit').disabled = false;
      };
    });
    if (selected) {
      var selBtn = document.querySelector('.option-btn[data-letter="'+selected+'"]');
      if (selBtn) selBtn.classList.add('selected');
    }
  }

  // Multi/judge
  if (isMulti || isJudge) {
    document.querySelectorAll('.option-btn').forEach(function(btn) {
      btn.onclick = function() {
        var letter = this.dataset.letter;
        if (isJudge) {
          document.querySelectorAll('.option-btn').forEach(function(b){b.classList.remove('selected');});
          this.classList.add('selected');
          selected = [letter];
        } else {
          var pos = selected.indexOf(letter);
          if (pos >= 0) { selected.splice(pos,1); this.classList.remove('selected'); }
          else { selected.push(letter); this.classList.add('selected'); }
        }
        document.getElementById('btnSubmit').disabled = selected.length === 0;
        var labelsEl = document.getElementById('selectedLabels');
        if (labelsEl) labelsEl.textContent = selected.length > 0 ? selected.join(', ') : '-';
      };
    });
    if (selected.length > 0) {
      document.querySelectorAll('.option-btn').forEach(function(btn) {
        if (selected.indexOf(btn.dataset.letter) >= 0) btn.classList.add('selected');
      });
    }
  }

  // Submit
  document.getElementById('btnSubmit').onclick = function() {
    var ua = isMulti ? selected.slice().sort().join('') : (isJudge ? (selected[0]||'') : selected);
    if (!ua || (isMulti && ua.length === 0)) return;
    state.examAnswers[currentQ.id] = ua;
    saveState();
    // Auto-advance
    if (currentIdx < currentSec.total - 1) {
      state.examTypeIdx = currentIdx + 1;
    } else {
      advanceExamSection();
    }
    saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
  };

  // Reveal in exam (marks as seen)
  var btnReveal2 = document.getElementById('btnReveal');
  if (btnReveal2) btnReveal2.onclick = function() {
    if (isAnswered) return;
    state.examAnswers[currentQ.id] = '(revealed)';
    saveState(); render(); window.scrollTo({top:150,behavior:'smooth'});
  };

  // Navigation
  document.getElementById('btnPrev').onclick = function() { examNavigate(-1, allSections); };
  document.getElementById('btnNext').onclick = function() { examNavigate(1, allSections); };

  // Keyboard
  if (window._kbCleanup) window._kbCleanup();
  var handler = function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key >= '1' && e.key <= '5') {
      var idx2 = parseInt(e.key) - 1;
      var btns = document.querySelectorAll('.option-btn');
      if (btns[idx2]) btns[idx2].click();
    }
    if (e.key === 'Enter' && !isAnswered) { e.preventDefault(); document.getElementById('btnSubmit').click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); examNavigate(-1, allSections); }
    if (e.key === 'ArrowRight') { e.preventDefault(); examNavigate(1, allSections); }
    if ((e.key === 'r' || e.key === 'R') && !isAnswered) { e.preventDefault(); document.getElementById('btnReveal').click(); }
  };
  document.addEventListener('keydown', handler);
  window._kbCleanup = function() { document.removeEventListener('keydown', handler); };
}

// ===== INIT =====
render();
</script>
</body>
</html>`;

fs.writeFileSync('毛概题库复习系统.html', html, 'utf8');
console.log('HTML generated: 毛概题库复习系统.html');
console.log('Size:', (html.length / 1024).toFixed(1), 'KB');
console.log('Questions:', singleChoice.length, 'single +', multiChoice.length, 'multi +', judgeQuestions.length, 'judge +', essayQuestions.length, 'essay');
console.log('Layout: 4 tabs (单选/多选/判断/大题) with 顺序/随机 toggle');
console.log('Exam: 18 single + 12 multi + 10 judge + 3 short + 1 long');
