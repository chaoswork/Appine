// Link Hints Plugin
// 按 F 激活 → 显示字母标签 → 按字母跳转链接

const TRIGGER_KEY = 'f';                      // 激活键
const HINT_KEYS   = 'ASDFGHJKLQWERTYUIOP';   // 标签字母池

let hints = [];                               // 当前所有 hint 对象 { label, el, hintEl }
let active = false;
let currentInput = '';                        // 当前已输入的字母

// ── 辅助函数：精准判断元素是否在屏幕上真正可见 ──────────────────────
function isElementVisible(el) {
  const rect = el.getBoundingClientRect();

  // 1. 基础尺寸检查 (过滤 display: none 或未渲染的元素)
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  // 2. 视口(Viewport)检查 (只给当前屏幕内可见的元素打标签)
  // 这样可以避免给页面底部还没滚动到的几百个链接打标签，极大提升性能并减少字母消耗
  if (
    rect.bottom <= 0 || 
    rect.top >= (window.innerHeight || document.documentElement.clientHeight) ||
    rect.right <= 0 || 
    rect.left >= (window.innerWidth || document.documentElement.clientWidth)
  ) {
    return false;
  }

  // 3. 计算样式检查 (过滤透明、隐藏、不可交互的元素)
  const style = window.getComputedStyle(el);
  if (
    style.visibility === 'hidden' || 
    style.opacity === '0' || 
    style.display === 'none' ||
    style.pointerEvents === 'none' // GitHub 的隐藏菜单经常用这个
  ) {
    return false;
  }

  // 4. (可选) 检查元素中心点是否被其他背景遮挡
  // const elementFromPoint = document.elementFromPoint(
  //   rect.left + rect.width / 2,
  //   rect.top + rect.height / 2
  // );
  // if (elementFromPoint && !el.contains(elementFromPoint) && !elementFromPoint.contains(el)) {
  //   return false;
  // }

  return true;
}

// ── 核心逻辑 ──────────────────────────────────────────────

function getTargets() {
  // 可互动元素：链接 + 按钮 + 输入框 + 文本域 + 下拉框 + 带有 tabindex 的可聚焦元素
  const selectors = 'a[href], button, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';
  
  return [...document.querySelectorAll(selectors)]
    .filter(isElementVisible);
}

// 核心算法：生成无前缀冲突的标签数组 (Vimium 算法)
// 保证当你输入 A 时，不会因为存在 AA 而产生歧义
function generateHintStrings(linkCount, keys) {
  let hintStrings = [""];
  let offset = 0;
  // 不断将最短的字符串弹出，并在其后追加所有可能的字母
  while (hintStrings.length - offset < linkCount || hintStrings.length === 1) {
    let hint = hintStrings[offset++];
    for (let ch of keys) {
      hintStrings.push(hint + ch);
    }
  }
  // 截取需要的数量
  return hintStrings.slice(offset, offset + linkCount);
}

function showHints() {
  const targets = getTargets();
  console.log(`[link-hints] 开始显示标签，找到 ${targets.length} 个可交互元素`);
  if (targets.length === 0) return;

  // 生成对应数量的标签字符串
  const hintStrings = generateHintStrings(targets.length, HINT_KEYS);
  
  targets.forEach((el, i) => {
    const label = hintStrings[i];
    const r = el.getBoundingClientRect();
    const hintEl = Object.assign(document.createElement('div'), {
      textContent: label,
      className: '__hint__',
    });
    Object.assign(hintEl.style, {
      position: 'absolute',
      left: (window.scrollX + r.left) + 'px', 
      top: (window.scrollY + r.top) + 'px',
      background: '#ffeb3b', color: '#000',
      font: 'bold 13px monospace',
      padding: '2px 6px', borderRadius: '3px',
      zIndex: 2147483647, pointerEvents: 'none',
      boxShadow: '0 2px 4px rgba(0,0,0,.2)',
      border: '1px solid #f57f17'
    });
    document.body.appendChild(hintEl);
    hints.push({ label, el, hintEl }); // 保存对象以便后续过滤
  });
  active = true;
  currentInput = '';
}

function clearHints() {
  hints.forEach(h => h.hintEl.remove());
  hints = [];
  active = false;
  currentInput = '';
}

// 更新标签的显示状态（隐藏不匹配的，高亮已输入的）
function updateHintsDisplay() {
  hints.forEach(h => {
    if (h.label.startsWith(currentInput)) {
      h.hintEl.style.display = 'block';
      const typed = h.label.substring(0, currentInput.length);
      const rest = h.label.substring(currentInput.length);
      // 已输入的字母变灰，未输入的保持黑色
      h.hintEl.innerHTML = currentInput.length > 0 ? `<span style="opacity:0.4">${typed}</span>${rest}` : h.label;
    } else {
      h.hintEl.style.display = 'none';
    }
  });
}

function handleInput(key) {
  key = key.toUpperCase();
  if (!HINT_KEYS.includes(key)) {
    // 输入了非标签池的按键，直接退出
    return clearHints();
  }
  
  currentInput += key;
  console.log(`[link-hints] 当前输入: ${currentInput}`);
  
  // 筛选出前缀匹配的标签
  const matchedHints = hints.filter(h => h.label.startsWith(currentInput));
  
  if (matchedHints.length === 0) {
    console.log(`[link-hints] 无匹配标签，退出`);
    return clearHints();
  }
  
  // 如果只剩下一个匹配项，直接触发（不需要敲完剩下的字母）
  if (matchedHints.length === 1) {
    const el = matchedHints[0].el;
    clearHints();
    console.log(`[link-hints] 唯一匹配，激活元素:`, el.tagName);
    if (el.tagName === 'A') {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } else {
        el.focus?.() || el.click();
    }
    return;
  }
  
  // 还有多个匹配项，更新界面显示
  updateHintsDisplay();
}

// ── 键盘事件处理 ──────────────────────────────────────────

function onKeydown(e) {
  console.log(`[link-hints] 收到按键: ${e.key}, active: ${active}, target: ${e.target.tagName}, isContentEditable: ${e.target.isContentEditable}`);
  
  // 防止在输入框打字时触发
  if (!active && (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable)) {
      console.log(`[link-hints] ⚠️ 焦点在输入框，忽略按键`);
      return;
  }    
  
  if (e.key === 'Escape') return clearHints();
  
  if (!active && e.key === TRIGGER_KEY && !e.ctrlKey && !e.metaKey) {
    console.log(`[link-hints] 触发激活键 ${TRIGGER_KEY}！`);
    e.preventDefault();
    e.stopPropagation();
    showHints();
    return;
  }
  
  if (active) {
    e.preventDefault();
    e.stopPropagation();
    
    // 处理退格键，允许撤销输入
    if (e.key === 'Backspace') {
      if (currentInput.length > 0) {
        currentInput = currentInput.slice(0, -1);
        updateHintsDisplay();
      } else {
        clearHints();
      }
      return;
    }
    
    // 忽略单独的修饰键
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    
    handleInput(e.key);
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
