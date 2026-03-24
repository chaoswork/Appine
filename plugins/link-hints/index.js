// Link Hints Plugin
// 按 F 激活 → 显示字母标签 → 按字母跳转链接

const TRIGGER_KEY = 'f';                      // 激活键
const HINT_KEYS   = 'ASDFGHJKLQWERTYUIOP';   // 标签字母池

let hints = [];                               // 当前所有 hint 元素
let active = false;

// ── 核心逻辑 ──────────────────────────────────────────────

function getTargets() {
  // 可互动元素：链接 + 按钮 + 输入框
  return [...document.querySelectorAll('a[href], button, input, [role="button"]')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;    // 过滤不可见元素
    });
}

function showHints() {
  const targets = getTargets();
  console.log(`[link-hints] 开始显示标签，找到 ${targets.length} 个可交互元素`);
  
  targets.slice(0, HINT_KEYS.length).forEach((el, i) => {
    const label = HINT_KEYS[i];
    const r = el.getBoundingClientRect();
    const hint = Object.assign(document.createElement('div'), {
      textContent: label,
      className: '__hint__',
    });
    Object.assign(hint.style, {
      position: 'absolute', // ⚠️ 改为 absolute 适应网页滚动
      left: (window.scrollX + r.left) + 'px', 
      top: (window.scrollY + r.top) + 'px',
      background: '#ffeb3b', color: '#000',
      font: 'bold 13px monospace',
      padding: '2px 6px', borderRadius: '3px',
      zIndex: 2147483647, pointerEvents: 'none',
      boxShadow: '0 2px 4px rgba(0,0,0,.2)',
      border: '1px solid #f57f17'
    });
    hint._target = el;                        // 关联目标元素
    document.body.appendChild(hint);
    hints.push(hint);
  });
  active = true;
}

function clearHints() {
  hints.forEach(h => h.remove());
  hints = [];
  active = false;
}

function activate(key) {
  const hint = hints.find(h => h.textContent === key.toUpperCase());
  if (!hint) return clearHints();             // 无匹配 → 退出
  const el = hint._target;
  clearHints();
  
  console.log(`[link-hints] 激活元素:`, el.tagName);
  if (el.tagName === 'A') {
      // 模拟真实点击，兼容性更好
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  } else {
      el.focus?.() || el.click();
  }
}

// ── 键盘事件处理 ──────────────────────────────────────────

function onKeydown(e) {
  console.log(`[link-hints] 收到按键: ${e.key}, active: ${active}, target: ${e.target.tagName}`);
  
  // 防止在输入框打字时触发
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;

  if (e.key === 'Escape') return clearHints();
  
  if (!active && e.key === TRIGGER_KEY && !e.ctrlKey && !e.metaKey) {
    console.log(`[link-hints] 触发激活键 ${TRIGGER_KEY}！`);
    e.preventDefault();
    e.stopPropagation(); // 阻止网页原有逻辑
    showHints();
    return;
  }
  
  if (active) {
    e.preventDefault();
    e.stopPropagation();
    activate(e.key);
  }
}

// ── 插件接口（PluginLoader 约定）────────────────────────────

let pluginApi = null;

export default {
  name: 'link-hints',

  setup(api) {
    pluginApi = api;
    api.on('keydown', onKeydown);
    api.log('ready — press [F] to activate hints');
  },

  teardown() {
    clearHints();
    if (pluginApi) {
        pluginApi.off('keydown', onKeydown);
    }
  },
};
