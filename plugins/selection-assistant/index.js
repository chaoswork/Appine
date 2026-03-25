// Selection Assistant Plugin v4 (Gemini Style UI & Thinking Models)
// 现代 UI，支持 reasoning_content，支持修改重试，移除发送按钮

let pluginApi = null;
let actionCard, transResultCard, popChatCard, sidebarPanel, floatingBtn, settingsModal;
let currentSelectionText = '';
let currentSelectionRect = null;

let abortController = null;

// ── 配置与状态 ──
let aiConfig = {
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  models: ['gpt-3.5-turbo', 'gpt-4o', 'deepseek-reasoner'],
  trans_model: 'gpt-3.5-turbo',
  target_lang: '中文'
};

// Session: { id, title, context, model, messages: [{role, content, reasoning_content}], updatedAt }
let chatSessions = []; 
let activePopSessionId = null;
let activeSidebarSessionId = null;

// ── 数据持久化 ──
function loadData() {
  try {
    const cData = localStorage.getItem('appine_assistant_config');
    if (cData) aiConfig = { ...aiConfig, ...JSON.parse(cData) };
    const sData = localStorage.getItem('appine_assistant_sessions');
    if (sData) chatSessions = JSON.parse(sData);
  } catch (e) { console.log('[selection-assistant] 读取数据失败', e); }
}

function saveConfig() {
  try { localStorage.setItem('appine_assistant_config', JSON.stringify(aiConfig)); } catch (e) {}
}

function saveSessions() {
  if (chatSessions.length > 20) chatSessions = chatSessions.slice(0, 20);
  try { localStorage.setItem('appine_assistant_sessions', JSON.stringify(chatSessions)); } catch (e) {}
}

// ── 简易 Markdown 渲染器 ──
function renderMD(text) {
  if (!text) return '';
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => `<pre class="appine-md-pre"><code>${code}</code></pre>`);
  html = html.replace(/`([^`\n]+)`/g, '<code class="appine-md-code">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return html;
}

// ── UI 构建 ──
function initUI() {
  if (document.getElementById('appine-assistant-style')) return;

  const style = document.createElement('style');
  style.id = 'appine-assistant-style';
  style.textContent = `
    .appine-pop-card { position: absolute; z-index: 2147483647; background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: none; }
    .appine-action-btn { border: none; background: transparent; padding: 8px 12px; cursor: pointer; font-size: 14px; border-radius: 4px; color: #333; }
    .appine-action-btn:hover { background: #f0f0f0; }
    
    /* 翻译卡片 */
    .appine-trans-card { width: 320px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .appine-trans-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; font-size: 14px; }
    .appine-trans-close { cursor: pointer; color: #999; font-size: 16px; }
    .appine-trans-content { font-size: 14px; line-height: 1.6; max-height: 300px; overflow-y: auto; color: #333; word-wrap: break-word; white-space: pre-wrap; }
    
    /* Gemini 风格聊天窗口 */
    .appine-chat-container { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .appine-chat-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fff; font-size: 15px; font-weight: 500; color: #202124; }
    .appine-chat-messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; min-height: 300px; max-height: 500px; }
    
    /* 输入框区域 (Gemini 风格) */
    .appine-chat-input-wrapper { padding: 0 16px 16px 16px; background: #fff; }
    .appine-chat-input-box { background: #f0f4f9; border-radius: 24px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; transition: background 0.2s; }
    .appine-chat-input-box:focus-within { background: #e9eef6; }
    .appine-chat-textarea { width: 100%; box-sizing: border-box; border: none; outline: none; resize: none; background: transparent; font-family: inherit; font-size: 15px; line-height: 1.5; color: #202124; min-height: 24px; max-height: 120px; overflow-y: auto; }
    .appine-chat-textarea::placeholder { color: #5f6368; }
    .appine-chat-toolbar { display: flex; justify-content: space-between; align-items: center; }
    .appine-chat-tools-left { display: flex; align-items: center; gap: 12px; color: #5f6368; font-size: 14px; }
    .appine-tool-icon { cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 16px; transition: background 0.2s; }
    .appine-tool-icon:hover { background: rgba(0,0,0,0.05); }
    .appine-blue-dot { width: 6px; height: 6px; background: #1a73e8; border-radius: 50%; display: inline-block; }
    .appine-model-select { appearance: none; background: transparent; border: none; outline: none; font-size: 13px; color: #5f6368; cursor: pointer; padding: 4px 8px; border-radius: 12px; }
    .appine-model-select:hover { background: rgba(0,0,0,0.05); }

    /* User Message */
    .appine-msg-user-row { display: flex; justify-content: flex-end; align-items: flex-start; gap: 8px; width: 100%; }
    .appine-msg-user-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; margin-top: 8px; }
    .appine-msg-user-row:hover .appine-msg-user-actions { opacity: 1; }
    .appine-action-icon { cursor: pointer; color: #5f6368; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .appine-action-icon:hover { background: #f0f4f9; color: #202124; }
    .appine-msg-user-bubble { background: #f0f4f9; color: #202124; padding: 12px 16px; border-radius: 18px; font-size: 15px; line-height: 1.5; max-width: 80%; word-wrap: break-word; white-space: pre-wrap; }
    
    /* Context Message */
    .appine-msg-context { background: #f8f9fa; color: #5f6368; padding: 10px 14px; border-radius: 12px; font-size: 13px; font-style: italic; border-left: 4px solid #dadce0; margin-bottom: -10px; }

    /* AI Message */
    .appine-msg-ai-row { display: flex; align-items: flex-start; gap: 12px; width: 100%; }
    .appine-ai-avatar { font-size: 20px; margin-top: 2px; user-select: none; }
    .appine-ai-content-area { flex: 1; min-width: 0; }
    
    /* Thinking Block */
    .appine-thinking-details { margin-bottom: 12px; }
    .appine-thinking-summary { cursor: pointer; color: #5f6368; font-size: 13px; display: flex; align-items: center; gap: 6px; user-select: none; }
    .appine-thinking-summary:hover { color: #202124; }
    .appine-thinking-content { padding: 10px 14px; border-left: 2px solid #e8eaed; color: #5f6368; font-size: 14px; margin-top: 8px; white-space: pre-wrap; line-height: 1.6; background: #fcfcfc; border-radius: 0 8px 8px 0; }
    
    /* AI Text */
    .appine-ai-text { color: #202124; font-size: 15px; line-height: 1.6; word-wrap: break-word; }
    
    /* Markdown */
    .appine-md-pre { background: #f8f9fa; border: 1px solid #e8eaed; color: #202124; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0; font-family: Consolas, monospace; font-size: 13px; }
    .appine-md-code { background: #f1f3f4; padding: 2px 6px; border-radius: 4px; color: #d93025; font-family: Consolas, monospace; font-size: 13px; }

    /* 悬浮球 & 侧边栏 */
    .appine-floating-btn { position: fixed; right: -20px; bottom: 50px; width: 44px; height: 44px; background: #fff; border: 1px solid #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2147483646; transition: right 0.3s, box-shadow 0.3s; box-shadow: -2px 2px 8px rgba(0,0,0,0.1); font-size: 20px; user-select: none; }
    .appine-floating-btn:hover { right: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    
    .appine-sidebar-panel { position: fixed; right: 20px; bottom: 105px; width: 700px; height: 600px; background: #fff; border: 1px solid #ddd; border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.15); z-index: 2147483647; display: none; overflow: hidden; font-family: inherit; }
    .appine-sidebar-layout { display: flex; width: 100%; height: 100%; }
    .appine-sidebar-left { width: 220px; background: #f8f9fa; border-right: 1px solid #e8eaed; display: flex; flex-direction: column; }
    .appine-sidebar-left-header { padding: 16px; font-weight: 500; border-bottom: 1px solid #e8eaed; display: flex; justify-content: space-between; align-items: center; color: #202124; }
    .appine-session-list { flex: 1; overflow-y: auto; }
    .appine-session-item { padding: 12px 16px; border-bottom: 1px solid #f1f3f4; cursor: pointer; font-size: 14px; color: #3c4043; transition: background 0.2s; }
    .appine-session-item:hover { background: #f1f3f4; }
    .appine-session-item.active { background: #e8f0fe; color: #1a73e8; font-weight: 500; }
    .appine-session-item-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
    .appine-sidebar-right { flex: 1; display: flex; flex-direction: column; background: #fff; }
    
    /* Settings Modal */
    .appine-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2147483648; display: none; align-items: center; justify-content: center; }
    .appine-settings-box { background: #fff; width: 400px; padding: 24px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); font-family: inherit; }
    .appine-settings-row { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
    .appine-settings-row label { font-size: 13px; font-weight: 500; color: #5f6368; }
    .appine-settings-row input, .appine-settings-row select { padding: 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; outline: none; }
    .appine-settings-row input:focus { border-color: #1a73e8; }
    .appine-settings-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
    .appine-btn { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
    .appine-btn-primary { background: #1a73e8; color: white; }
    .appine-btn-primary:hover { background: #1557b0; }
  `;
  document.head.appendChild(style);

  // SVG Icons
  const iconCopy = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const iconEdit = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

  // 1. Action Card
  actionCard = document.createElement('div');
  actionCard.className = 'appine-pop-card';
  actionCard.innerHTML = `
    <div style="padding: 6px; display: flex; gap: 4px;">
      <button class="appine-action-btn" id="appine-btn-trans">🌐 翻译</button>
      <button class="appine-action-btn" id="appine-btn-ai">✨ 问AI</button>
    </div>
  `;
  document.body.appendChild(actionCard);

  // 2. Trans Result Card
  transResultCard = document.createElement('div');
  transResultCard.className = 'appine-pop-card appine-trans-card';
  transResultCard.innerHTML = `
    <div class="appine-trans-header">
      <span id="appine-trans-title">翻译</span>
      <span class="appine-trans-close" id="appine-trans-close">✕</span>
    </div>
    <div class="appine-trans-content" id="appine-trans-content"></div>
  `;
  document.body.appendChild(transResultCard);

  // 3. Pop Chat Card
  popChatCard = document.createElement('div');
  popChatCard.className = 'appine-pop-card appine-chat-container';
  popChatCard.style.width = '420px';
  popChatCard.innerHTML = `
    <div class="appine-chat-header">
      <span>✨ 问问 AI</span>
      <span style="cursor:pointer; color:#999; font-size:18px;" id="appine-pop-close">✕</span>
    </div>
    <div class="appine-chat-messages" id="appine-pop-messages"></div>
    <div class="appine-chat-input-wrapper">
      <div class="appine-chat-input-box">
        <textarea class="appine-chat-textarea" id="appine-pop-textarea" placeholder="输入指令... (Enter 发送, Shift+Enter 换行)"></textarea>
        <div class="appine-chat-toolbar">
          <div class="appine-chat-tools-left">
            <div class="appine-tool-icon">＋</div>
            <div class="appine-tool-icon">⚯ 工具 <span class="appine-blue-dot"></span></div>
          </div>
          <select class="appine-model-select" id="appine-pop-model"></select>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(popChatCard);

  // 4. Floating Button
  floatingBtn = document.createElement('div');
  floatingBtn.className = 'appine-floating-btn';
  floatingBtn.innerHTML = '✨';
  document.body.appendChild(floatingBtn);

  // 5. Sidebar Panel
  sidebarPanel = document.createElement('div');
  sidebarPanel.className = 'appine-sidebar-panel';
  sidebarPanel.innerHTML = `
    <div class="appine-sidebar-layout">
      <div class="appine-sidebar-left">
        <div class="appine-sidebar-left-header">
          <span>会话记录</span>
          <span style="cursor:pointer; font-size:16px;" id="appine-btn-settings">⚙️</span>
        </div>
        <div class="appine-session-list" id="appine-session-list"></div>
      </div>
      <div class="appine-sidebar-right appine-chat-container" style="border-radius:0;">
        <div class="appine-chat-header">
          <span id="appine-sidebar-chat-title">选择或新建会话</span>
          <span style="cursor:pointer; color:#999; font-size:18px;" id="appine-sidebar-close">✕</span>
        </div>
        <div class="appine-chat-messages" id="appine-sidebar-messages">
          <div style="text-align:center; color:#999; margin-top:50px;">请在左侧选择会话</div>
        </div>
        <div class="appine-chat-input-wrapper">
          <div class="appine-chat-input-box">
            <textarea class="appine-chat-textarea" id="appine-sidebar-textarea" placeholder="输入指令... (Enter 发送, Shift+Enter 换行)" disabled></textarea>
            <div class="appine-chat-toolbar">
              <div class="appine-chat-tools-left">
                <div class="appine-tool-icon">＋</div>
                <div class="appine-tool-icon">⚯ 工具 <span class="appine-blue-dot"></span></div>
              </div>
              <select class="appine-model-select" id="appine-sidebar-model"></select>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(sidebarPanel);

  // 6. Settings Modal
  settingsModal = document.createElement('div');
  settingsModal.className = 'appine-modal-overlay';
  settingsModal.innerHTML = `
    <div class="appine-settings-box">
      <h3 style="margin-top:0; color:#202124;">API 设置</h3>
      <div class="appine-settings-row">
        <label>Base URL (OpenAI 兼容)</label>
        <input type="text" id="appine-cfg-baseurl" placeholder="https://api.openai.com/v1">
      </div>
      <div class="appine-settings-row">
        <label>API Key</label>
        <input type="password" id="appine-cfg-apikey" placeholder="sk-...">
      </div>
      <div class="appine-settings-row">
        <label>模型列表 (逗号分隔)</label>
        <input type="text" id="appine-cfg-models" placeholder="gpt-3.5-turbo,deepseek-reasoner">
      </div>
      <div class="appine-settings-row">
        <label>默认翻译模型</label>
        <select id="appine-cfg-transmodel"></select>
      </div>
      <div class="appine-settings-row">
        <label>翻译目标语言</label>
        <input type="text" id="appine-cfg-lang" placeholder="中文">
      </div>
      <div class="appine-settings-actions">
        <button class="appine-btn" style="background:#f1f3f4; color:#3c4043;" id="appine-cfg-cancel">取消</button>
        <button class="appine-btn appine-btn-primary" id="appine-cfg-save">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(settingsModal);

  // 挂载全局图标变量供渲染使用
  window.appineIcons = { copy: iconCopy, edit: iconEdit };
}

function updateModelSelects() {
  ['appine-pop-model', 'appine-sidebar-model', 'appine-cfg-transmodel'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    aiConfig.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.innerText = m;
      if (m === currentVal || (id === 'appine-cfg-transmodel' && m === aiConfig.trans_model)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// ── API 调用 (支持 reasoning_content) ──
async function fetchAIStream(messages, model, onChunk, onDone, onError) {
  if (!aiConfig.api_key) return onError("未配置 API Key！");
  if (abortController) abortController.abort();
  abortController = new AbortController();
  
  const requestUrl = `${aiConfig.base_url.replace(/\/+$/, '')}/chat/completions`;
  
  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.api_key}` },
      body: JSON.stringify({ model: model, messages: messages, stream: true }),
      signal: abortController.signal
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.substring(6));
              const delta = data.choices?.[0]?.delta;
              if (delta) onChunk(delta);
            } catch (e) {}
          }
        }
      }
    }
    onDone();
  } catch (error) {
    if (error.name !== 'AbortError') onError(error.message);
  }
}

// ── 聊天渲染逻辑 ──
function renderChatMessages(containerId, session) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!session) return;

  if (session.context) {
    const ctxDiv = document.createElement('div');
    ctxDiv.className = 'appine-msg-context';
    ctxDiv.innerHTML = `📌 引用：${session.context}`;
    container.appendChild(ctxDiv);
  }

  session.messages.forEach((msg, index) => {
    if (msg.role === 'user') {
      renderUserMessage(containerId, msg.content, session.id, index);
    } else {
      renderAIMessage(containerId, msg.content, msg.reasoning_content);
    }
  });
  container.scrollTop = container.scrollHeight;
}

function renderUserMessage(containerId, text, sessionId, msgIndex) {
  const container = document.getElementById(containerId);
  const msgDiv = document.createElement('div');
  msgDiv.className = 'appine-msg-user-row';
  
  // Actions (Copy & Edit)
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'appine-msg-user-actions';
  
  const copyBtn = document.createElement('div');
  copyBtn.className = 'appine-action-icon';
  copyBtn.title = '复制';
  copyBtn.innerHTML = window.appineIcons.copy;
  copyBtn.onclick = () => navigator.clipboard.writeText(text);
  
  const editBtn = document.createElement('div');
  editBtn.className = 'appine-action-icon';
  editBtn.title = '修改并重新生成';
  editBtn.innerHTML = window.appineIcons.edit;
  editBtn.onclick = () => handleEditMessage(sessionId, msgIndex, containerId);

  actionsDiv.appendChild(copyBtn);
  actionsDiv.appendChild(editBtn);

  const bubble = document.createElement('div');
  bubble.className = 'appine-msg-user-bubble';
  bubble.innerText = text;

  msgDiv.appendChild(actionsDiv);
  msgDiv.appendChild(bubble);
  container.appendChild(msgDiv);
}

function renderAIMessage(containerId, content, reasoning) {
  const container = document.getElementById(containerId);
  const msgDiv = document.createElement('div');
  msgDiv.className = 'appine-msg-ai-row';
  
  const avatar = document.createElement('div');
  avatar.className = 'appine-ai-avatar';
  avatar.innerHTML = '✨';
  
  const contentArea = document.createElement('div');
  contentArea.className = 'appine-ai-content-area';
  
  if (reasoning) {
    const details = document.createElement('details');
    details.className = 'appine-thinking-details';
    details.innerHTML = `
      <summary class="appine-thinking-summary">显示思路 ⌄</summary>
      <div class="appine-thinking-content">${reasoning}</div>
    `;
    contentArea.appendChild(details);
  }
  
  const textDiv = document.createElement('div');
  textDiv.className = 'appine-ai-text';
  textDiv.innerHTML = renderMD(content);
  contentArea.appendChild(textDiv);
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentArea);
  container.appendChild(msgDiv);
}

function appendAIStreamBubble(containerId) {
  const container = document.getElementById(containerId);
  const msgDiv = document.createElement('div');
  msgDiv.className = 'appine-msg-ai-row';
  
  msgDiv.innerHTML = `
    <div class="appine-ai-avatar">✨</div>
    <div class="appine-ai-content-area">
      <details class="appine-thinking-details" style="display:none;" open>
        <summary class="appine-thinking-summary">思考中...</summary>
        <div class="appine-thinking-content"></div>
      </details>
      <div class="appine-ai-text"><span style="color:#999;">...</span></div>
    </div>
  `;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  
  return {
    detailsEl: msgDiv.querySelector('.appine-thinking-details'),
    summaryEl: msgDiv.querySelector('.appine-thinking-summary'),
    reasoningEl: msgDiv.querySelector('.appine-thinking-content'),
    contentEl: msgDiv.querySelector('.appine-ai-text')
  };
}

// ── 核心交互逻辑 ──
function handleEditMessage(sessionId, msgIndex, containerId) {
  const session = chatSessions.find(s => s.id === sessionId);
  if (!session) return;
  
  const textToEdit = session.messages[msgIndex].content;
  // 截断历史记录到这一条之前
  session.messages = session.messages.slice(0, msgIndex);
  saveSessions();
  
  renderChatMessages(containerId, session);
  
  const inputId = containerId === 'appine-pop-messages' ? 'appine-pop-textarea' : 'appine-sidebar-textarea';
  const inputEl = document.getElementById(inputId);
  inputEl.value = textToEdit;
  inputEl.focus();
}

async function handleSendChat(sessionId, containerId, inputId, modelSelectId) {
  const inputEl = document.getElementById(inputId);
  const text = inputEl.value.trim();
  if (!text) return;

  const session = chatSessions.find(s => s.id === sessionId);
  if (!session) return;

  inputEl.value = '';
  inputEl.disabled = true;
  
  const msgIndex = session.messages.length;
  renderUserMessage(containerId, text, sessionId, msgIndex);
  
  session.messages.push({ role: 'user', content: text });
  session.updatedAt = Date.now();
  saveSessions();
  if (containerId === 'appine-sidebar-messages') renderSessionList();

  let apiMessages = [{ role: "system", content: "You are a helpful assistant. Use markdown for formatting." }];
  if (session.context) {
    apiMessages.push({ role: "user", content: `Context:\n"""\n${session.context}\n"""` });
    apiMessages.push({ role: "assistant", content: "I have received the context. What would you like to ask?" });
  }
  apiMessages = apiMessages.concat(session.messages.map(m => ({role: m.role, content: m.content})));

  const model = document.getElementById(modelSelectId).value || aiConfig.models[0];
  const streamEls = appendAIStreamBubble(containerId);
  const messagesContainer = document.getElementById(containerId);

  let fullText = '';
  let fullReasoning = '';

  fetchAIStream(apiMessages, model,
    (delta) => {
      if (delta.reasoning_content) {
        fullReasoning += delta.reasoning_content;
        streamEls.detailsEl.style.display = 'block';
        streamEls.reasoningEl.innerText = fullReasoning;
      }
      if (delta.content) {
        fullText += delta.content;
        streamEls.contentEl.innerHTML = renderMD(fullText);
        if (fullReasoning) {
          streamEls.summaryEl.innerText = '显示思路 ⌄';
          streamEls.detailsEl.removeAttribute('open'); // 开始输出正文时折叠思路
        }
      }
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },
    () => {
      inputEl.disabled = false;
      inputEl.focus();
      session.messages.push({ role: 'assistant', content: fullText, reasoning_content: fullReasoning });
      saveSessions();
    },
    (err) => {
      inputEl.disabled = false;
      streamEls.contentEl.innerHTML = `<span style="color:red;">错误: ${err}</span>`;
    }
  );
}

function renderSessionList() {
  const listEl = document.getElementById('appine-session-list');
  listEl.innerHTML = '';
  const sorted = [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt);
  
  sorted.forEach(session => {
    const div = document.createElement('div');
    div.className = `appine-session-item ${session.id === activeSidebarSessionId ? 'active' : ''}`;
    div.innerHTML = `<div class="appine-session-item-title">${session.title}</div>`;
    
    div.addEventListener('click', () => {
      activeSidebarSessionId = session.id;
      renderSessionList();
      document.getElementById('appine-sidebar-chat-title').innerText = session.title;
      document.getElementById('appine-sidebar-textarea').disabled = false;
      renderChatMessages('appine-sidebar-messages', session);
    });
    listEl.appendChild(div);
  });
}

function hideAllCards() {
  actionCard.style.display = 'none';
  transResultCard.style.display = 'none';
  popChatCard.style.display = 'none';
  if (abortController) abortController.abort();
}

function positionCard(card) {
  const leftPos = Math.max(0, window.scrollX + currentSelectionRect.left);
  card.style.left = `${leftPos}px`;
  card.style.top = `${window.scrollY + currentSelectionRect.bottom + 10}px`;
}

function startAskAI() {
  actionCard.style.display = 'none';
  const newSession = {
    id: Date.now().toString(),
    title: currentSelectionText.substring(0, 15) + '...',
    context: currentSelectionText,
    messages: [],
    updatedAt: Date.now()
  };
  chatSessions.unshift(newSession);
  saveSessions();
  activePopSessionId = newSession.id;
  
  positionCard(popChatCard);
  popChatCard.style.display = 'flex';
  document.getElementById('appine-pop-textarea').value = '';
  document.getElementById('appine-pop-textarea').focus();
  renderChatMessages('appine-pop-messages', newSession);
}

function startTranslation() {
  actionCard.style.display = 'none';
  document.getElementById('appine-trans-title').innerText = `翻译 (${aiConfig.trans_model})`;
  const contentDiv = document.getElementById('appine-trans-content');
  contentDiv.innerHTML = '<span style="color:#999;">正在翻译...</span>';
  
  positionCard(transResultCard);
  transResultCard.style.display = 'flex';

  fetchAIStream([{ role: "system", content: `Translate to ${aiConfig.target_lang}. Only output translation.` }, { role: "user", content: currentSelectionText }], 
    aiConfig.trans_model, 
    (delta) => { if(delta.content) { contentDiv.innerText += delta.content; } },
    () => {},
    (err) => { contentDiv.innerHTML = `<span style="color:red;">错误: ${err}</span>`; }
  );
}

function openSettings() {
  document.getElementById('appine-cfg-baseurl').value = aiConfig.base_url;
  document.getElementById('appine-cfg-apikey').value = aiConfig.api_key;
  document.getElementById('appine-cfg-models').value = aiConfig.models.join(',');
  document.getElementById('appine-cfg-lang').value = aiConfig.target_lang;
  updateModelSelects();
  settingsModal.style.display = 'flex';
}

function saveSettings() {
  aiConfig.base_url = document.getElementById('appine-cfg-baseurl').value.trim();
  aiConfig.api_key = document.getElementById('appine-cfg-apikey').value.trim();
  aiConfig.models = document.getElementById('appine-cfg-models').value.split(',').map(s => s.trim()).filter(s => s);
  aiConfig.trans_model = document.getElementById('appine-cfg-transmodel').value;
  aiConfig.target_lang = document.getElementById('appine-cfg-lang').value.trim();
  if (!aiConfig.models.includes(aiConfig.trans_model) && aiConfig.models.length > 0) aiConfig.trans_model = aiConfig.models[0];
  saveConfig();
  updateModelSelects();
  settingsModal.style.display = 'none';
}

// ── 事件绑定 ──
function onMouseUp(e) {
  if (actionCard.contains(e.target) || transResultCard.contains(e.target) || 
      popChatCard.contains(e.target) || sidebarPanel.contains(e.target) || 
      floatingBtn.contains(e.target) || settingsModal.contains(e.target)) return;

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 0) {
      currentSelectionText = text;
      currentSelectionRect = selection.getRangeAt(0).getBoundingClientRect();
      if (!aiConfig.api_key) return openSettings();
      actionCard.style.display = 'block';
      positionCard(actionCard);
      transResultCard.style.display = 'none';
      popChatCard.style.display = 'none';
      if (abortController) abortController.abort();
    } else {
      hideAllCards();
    }
  }, 50);
}

function bindEvents() {
  document.getElementById('appine-btn-trans').addEventListener('click', (e) => { e.stopPropagation(); startTranslation(); });
  document.getElementById('appine-btn-ai').addEventListener('click', (e) => { e.stopPropagation(); startAskAI(); });

  document.getElementById('appine-trans-close').addEventListener('click', () => { transResultCard.style.display = 'none'; if(abortController) abortController.abort(); });
  document.getElementById('appine-pop-close').addEventListener('click', () => { popChatCard.style.display = 'none'; if(abortController) abortController.abort(); });
  document.getElementById('appine-sidebar-close').addEventListener('click', () => { sidebarPanel.style.display = 'none'; if(abortController) abortController.abort(); });

  floatingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = sidebarPanel.style.display === 'none' || sidebarPanel.style.display === '';
    if (isHidden) { renderSessionList(); sidebarPanel.style.display = 'flex'; } 
    else { sidebarPanel.style.display = 'none'; }
  });

  document.getElementById('appine-btn-settings').addEventListener('click', openSettings);
  document.getElementById('appine-cfg-cancel').addEventListener('click', () => settingsModal.style.display = 'none');
  document.getElementById('appine-cfg-save').addEventListener('click', saveSettings);
  document.getElementById('appine-cfg-models').addEventListener('input', (e) => {
    aiConfig.models = e.target.value.split(',').map(s => s.trim()).filter(s => s);
    updateModelSelects();
  });

  // Enter 发送逻辑
  const bindEnterSend = (inputId, containerId, selectId, sessionIdVar) => {
    const input = document.getElementById(inputId);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const sid = containerId === 'appine-pop-messages' ? activePopSessionId : activeSidebarSessionId;
        handleSendChat(sid, containerId, inputId, selectId);
      }
    });
  };
  bindEnterSend('appine-pop-textarea', 'appine-pop-messages', 'appine-pop-model');
  bindEnterSend('appine-sidebar-textarea', 'appine-sidebar-messages', 'appine-sidebar-model');
}

export default {
  name: 'selection-assistant',
  setup(api) {
    pluginApi = api;
    loadData();
    initUI();
    updateModelSelects();
    bindEvents(); 
    api.on('mouseup', onMouseUp);
    api.log('Selection Assistant v4 loaded');
  },
  teardown() {
    if (pluginApi) pluginApi.off('mouseup', onMouseUp);
    if (abortController) abortController.abort();
    [actionCard, transResultCard, popChatCard, sidebarPanel, floatingBtn, settingsModal].forEach(el => { if (el) el.remove(); });
    const style = document.getElementById('appine-assistant-style');
    if (style) style.remove();
  }
};