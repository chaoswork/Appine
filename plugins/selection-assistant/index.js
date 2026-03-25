// Selection Assistant Plugin v2 (Real AI Integration)
// 划词弹出翻译/AI卡片，支持 OpenAI 兼容接口，流式输出

let pluginApi = null;
let actionCard, resultCard, floatingBtn, historyPanel, settingsModal;
let currentSelectionText = '';
let currentSelectionRect = null;
let historyData = [];
let abortController = null; // 用于中断请求

// ── 默认配置 ──
let aiConfig = {
  base_url: 'https://api.openai.com/v1',
  api_key: '',
  models: ['gpt-3.5-turbo', 'gpt-4o', 'claude-3-haiku'],
  trans_model: 'gpt-3.5-turbo',
  target_lang: '中文'
};

// ── 数据持久化 (LocalStorage) ──
function loadData() {
  try {
    const hData = localStorage.getItem('appine_assistant_history');
    if (hData) historyData = JSON.parse(hData);
    
    const cData = localStorage.getItem('appine_assistant_config');
    if (cData) aiConfig = { ...aiConfig, ...JSON.parse(cData) };
  } catch (e) {
    console.log('[selection-assistant] 读取数据失败', e);
  }
}

function saveHistory(item) {
  historyData.unshift(item);
  if (historyData.length > 50) historyData.pop();
  try { localStorage.setItem('appine_assistant_history', JSON.stringify(historyData)); } catch (e) {}
}

function saveConfig() {
  try { localStorage.setItem('appine_assistant_config', JSON.stringify(aiConfig)); } catch (e) {}
}

// ── UI 构建 ──
function initUI() {
  if (document.getElementById('appine-assistant-style')) return;

  const style = document.createElement('style');
  style.id = 'appine-assistant-style';
  style.textContent = `
    .appine-pop-card { position: absolute; z-index: 2147483647; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: none; }
    .appine-action-btn { border: none; background: transparent; padding: 8px 12px; cursor: pointer; font-size: 14px; border-radius: 4px; color: #333; }
    .appine-action-btn:hover { background: #f0f0f0; }
    
    .appine-result-card { width: 360px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .appine-result-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; font-size: 14px; }
    .appine-result-close { cursor: pointer; color: #999; font-size: 16px; }
    .appine-result-close:hover { color: #333; }
    .appine-result-content { font-size: 14px; line-height: 1.6; max-height: 400px; overflow-y: auto; color: #333; word-wrap: break-word; white-space: pre-wrap; }
    
    /* Ask AI Form */
    .appine-ask-context { font-size: 12px; color: #666; background: #f5f5f5; padding: 6px; border-radius: 4px; border-left: 3px solid #ccc; margin-bottom: 8px; max-height: 60px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .appine-ask-input { width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; min-height: 60px; font-family: inherit; margin-bottom: 8px; }
    .appine-ask-select { width: 100%; padding: 6px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; }
    .appine-ask-submit { width: 100%; padding: 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .appine-ask-submit:hover { background: #0056b3; }
    
    .appine-floating-btn { position: fixed; right: -20px; bottom: 50px; width: 44px; height: 44px; background: #fff; border: 1px solid #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2147483646; transition: right 0.3s, box-shadow 0.3s; box-shadow: -2px 2px 8px rgba(0,0,0,0.1); font-size: 20px; user-select: none; }
    .appine-floating-btn:hover { right: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    
    .appine-history-panel { position: fixed; right: 20px; bottom: 105px; width: 340px; height: 450px; background: #fff; border: 1px solid #ddd; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 2147483647; display: none; flex-direction: column; font-family: inherit; }
    .appine-history-header { padding: 12px 16px; background: #f8f9fa; border-bottom: 1px solid #eee; font-weight: bold; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; }
    .appine-history-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
    .appine-history-item { background: #f4f6f8; padding: 10px; border-radius: 8px; font-size: 13px; }
    .appine-history-q { font-weight: bold; margin-bottom: 6px; color: #111; }
    .appine-history-a { color: #555; line-height: 1.5; white-space: pre-wrap; }
    
    /* Settings Modal */
    .appine-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2147483648; display: none; align-items: center; justify-content: center; }
    .appine-settings-box { background: #fff; width: 400px; padding: 20px; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.2); font-family: inherit; }
    .appine-settings-box h3 { margin-top: 0; margin-bottom: 16px; }
    .appine-settings-row { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
    .appine-settings-row label { font-size: 13px; font-weight: bold; color: #555; }
    .appine-settings-row input, .appine-settings-row select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    .appine-settings-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
    .appine-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .appine-btn-primary { background: #007bff; color: white; }
    .appine-btn-default { background: #e0e0e0; color: #333; }
  `;
  document.head.appendChild(style);

  // 1. Action Card
  actionCard = document.createElement('div');
  actionCard.className = 'appine-pop-card';
  actionCard.innerHTML = `
    <div style="padding: 4px; display: flex; gap: 4px;">
      <button class="appine-action-btn" id="appine-btn-trans">🌐 翻译</button>
      <button class="appine-action-btn" id="appine-btn-ai">✨ 问AI</button>
    </div>
  `;
  document.body.appendChild(actionCard);

  // 2. Result Card
  resultCard = document.createElement('div');
  resultCard.className = 'appine-pop-card appine-result-card';
  resultCard.innerHTML = `
    <div class="appine-result-header">
      <span id="appine-result-title">结果</span>
      <span class="appine-result-close" id="appine-result-close">✕</span>
    </div>
    <div class="appine-result-content" id="appine-result-content"></div>
  `;
  document.body.appendChild(resultCard);

  // 3. Floating Button
  floatingBtn = document.createElement('div');
  floatingBtn.className = 'appine-floating-btn';
  floatingBtn.innerHTML = '🤖';
  document.body.appendChild(floatingBtn);

  // 4. History Panel
  historyPanel = document.createElement('div');
  historyPanel.className = 'appine-history-panel';
  historyPanel.innerHTML = `
    <div class="appine-history-header">
      <span>历史记录</span>
      <div>
        <span style="cursor:pointer; margin-right: 12px; font-size: 14px;" id="appine-btn-settings">⚙️ 设置</span>
        <span style="cursor:pointer; color:#999;" id="appine-history-close">✕</span>
      </div>
    </div>
    <div class="appine-history-list" id="appine-history-list"></div>
  `;
  document.body.appendChild(historyPanel);

  // 5. Settings Modal
  settingsModal = document.createElement('div');
  settingsModal.className = 'appine-modal-overlay';
  settingsModal.innerHTML = `
    <div class="appine-settings-box">
      <h3>API 设置</h3>
      <div class="appine-settings-row">
        <label>Base URL (OpenAI 兼容)</label>
        <input type="text" id="appine-cfg-baseurl" placeholder="https://api.openai.com/v1">
      </div>
      <div class="appine-settings-row">
        <label>API Key</label>
        <input type="password" id="appine-cfg-apikey" placeholder="sk-...">
      </div>
      <div class="appine-settings-row">
        <label>模型列表 (用逗号分隔添加/删除)</label>
        <input type="text" id="appine-cfg-models" placeholder="gpt-3.5-turbo,gpt-4">
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
        <button class="appine-btn appine-btn-default" id="appine-cfg-cancel">取消</button>
        <button class="appine-btn appine-btn-primary" id="appine-cfg-save">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(settingsModal);
}

// ── AI API 调用 (支持流式) ──
async function fetchAIStream(messages, model, onChunk, onDone, onError) {
  if (!aiConfig.api_key) {
    onError("未配置 API Key，请先设置！");
    return;
  }

  abortController = new AbortController();
  
  // 【修复点】：自动移除 base_url 末尾的斜杠，防止拼接出 //chat/completions
  const baseUrl = aiConfig.base_url.replace(/\/+$/, '');
  const requestUrl = `${baseUrl}/chat/completions`;
  
  // 【调试日志】：打印请求详情，你可以在 Emacs 的 *Messages* 或终端里看到
  pluginApi.log(`🚀 发起 AI 请求`);
  pluginApi.log(`URL: ${requestUrl}`);
  pluginApi.log(`Model: ${model}`);
  pluginApi.log(`Messages: ${JSON.stringify(messages)}`);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.api_key}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      pluginApi.log(`❌ 请求失败: HTTP ${response.status} - ${errText}`);
      throw new Error(`HTTP Error ${response.status}: ${errText}`);
    }

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
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                onChunk(data.choices[0].delta.content);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    }
    onDone();
  } catch (error) {
    if (error.name === 'AbortError') {
      pluginApi.log('⚠️ 请求被用户取消');
    } else {
      pluginApi.log(`❌ 发生异常: ${error.message}`);
      onError(error.message);
    }
  }
}


// ── 逻辑与交互 ──
function hideAllCards() {
  actionCard.style.display = 'none';
  resultCard.style.display = 'none';
  if (abortController) abortController.abort();
}

function positionCard(card) {
  const leftPos = Math.max(0, window.scrollX + currentSelectionRect.left);
  card.style.left = `${leftPos}px`;
  card.style.top = `${window.scrollY + currentSelectionRect.bottom + 10}px`;
}

function openSettings() {
  document.getElementById('appine-cfg-baseurl').value = aiConfig.base_url;
  document.getElementById('appine-cfg-apikey').value = aiConfig.api_key;
  document.getElementById('appine-cfg-models').value = aiConfig.models.join(',');
  document.getElementById('appine-cfg-lang').value = aiConfig.target_lang;
  
  const select = document.getElementById('appine-cfg-transmodel');
  select.innerHTML = '';
  aiConfig.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.innerText = m;
    if (m === aiConfig.trans_model) opt.selected = true;
    select.appendChild(opt);
  });
  
  settingsModal.style.display = 'flex';
}

function saveSettings() {
  aiConfig.base_url = document.getElementById('appine-cfg-baseurl').value.trim();
  aiConfig.api_key = document.getElementById('appine-cfg-apikey').value.trim();
  aiConfig.models = document.getElementById('appine-cfg-models').value.split(',').map(s => s.trim()).filter(s => s);
  aiConfig.trans_model = document.getElementById('appine-cfg-transmodel').value;
  aiConfig.target_lang = document.getElementById('appine-cfg-lang').value.trim();
  
  // 如果 trans_model 不在 models 里，重置为第一个
  if (!aiConfig.models.includes(aiConfig.trans_model) && aiConfig.models.length > 0) {
    aiConfig.trans_model = aiConfig.models[0];
  }
  
  saveConfig();
  settingsModal.style.display = 'none';
}

function startTranslation() {
  actionCard.style.display = 'none';
  document.getElementById('appine-result-title').innerText = `翻译 (${aiConfig.trans_model})`;
  const contentDiv = document.getElementById('appine-result-content');
  contentDiv.innerHTML = '<span style="color:#999;">正在翻译...</span>';
  
  positionCard(resultCard);
  resultCard.style.display = 'flex';

  const messages = [
    { role: "system", content: `You are a professional translator. Translate the following text into ${aiConfig.target_lang}. Only output the translation, nothing else.` },
    { role: "user", content: currentSelectionText }
  ];

  let fullText = '';
  contentDiv.innerHTML = ''; // 清空 loading

  fetchAIStream(messages, aiConfig.trans_model, 
    (chunk) => {
      fullText += chunk;
      contentDiv.innerText = fullText; // 使用 innerText 防止 XSS 并保留换行
    },
    () => {
      saveHistory({ type: '翻译', query: currentSelectionText, answer: fullText, time: Date.now() });
    },
    (err) => {
      contentDiv.innerHTML = `<span style="color:red;">错误: ${err}</span>`;
    }
  );
}

function showAskAIForm() {
  actionCard.style.display = 'none';
  document.getElementById('appine-result-title').innerText = '问 AI';
  
  const contentDiv = document.getElementById('appine-result-content');
  
  // 生成模型下拉选项
  const modelOptions = aiConfig.models.map(m => `<option value="${m}">${m}</option>`).join('');
  
  contentDiv.innerHTML = `
    <div class="appine-ask-context">${currentSelectionText}</div>
    <select class="appine-ask-select" id="appine-askai-model-select">${modelOptions}</select>
    <textarea class="appine-ask-input" id="appine-askai-prompt" placeholder="输入指令 (如: 总结这段话, 解释这个概念...)"></textarea>
    <button class="appine-ask-submit" id="appine-askai-submit-btn">发送</button>
    <div id="appine-askai-stream-result" style="margin-top: 12px; display: none; border-top: 1px dashed #ccc; padding-top: 8px;"></div>
  `;
  
  positionCard(resultCard);
  resultCard.style.display = 'flex';

  // 绑定发送按钮事件
  document.getElementById('appine-askai-submit-btn').addEventListener('click', () => {
    const prompt = document.getElementById('appine-askai-prompt').value.trim();
    if (!prompt) return;
    
    const selectedModel = document.getElementById('appine-askai-model-select').value;
    const resultArea = document.getElementById('appine-askai-stream-result');
    const submitBtn = document.getElementById('appine-askai-submit-btn');
    
    submitBtn.disabled = true;
    submitBtn.innerText = '思考中...';
    resultArea.style.display = 'block';
    resultArea.innerHTML = '';

    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: `Context:\n"""\n${currentSelectionText}\n"""\n\nQuestion/Command: ${prompt}` }
    ];

    let fullText = '';
    fetchAIStream(messages, selectedModel,
      (chunk) => {
        fullText += chunk;
        resultArea.innerText = fullText;
      },
      () => {
        submitBtn.innerText = '发送完成';
        saveHistory({ type: '问AI', query: `[指令: ${prompt}]\n${currentSelectionText}`, answer: fullText, time: Date.now() });
      },
      (err) => {
        resultArea.innerHTML = `<span style="color:red;">错误: ${err}</span>`;
        submitBtn.disabled = false;
        submitBtn.innerText = '重试';
      }
    );
  });
}

function renderHistory() {
  const list = document.getElementById('appine-history-list');
  list.innerHTML = '';
  if (historyData.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:#999; margin-top:20px;">暂无记录</div>';
    return;
  }
  historyData.slice(0, 10).forEach(item => {
    const div = document.createElement('div');
    div.className = 'appine-history-item';
    // 简单截断过长的 query
    const shortQuery = item.query.length > 60 ? item.query.substring(0, 60) + '...' : item.query;
    div.innerHTML = `
      <div class="appine-history-q">[${item.type}] ${shortQuery}</div>
      <div class="appine-history-a">${item.answer}</div>
    `;
    list.appendChild(div);
  });
}

// ── 事件绑定 ──
function onMouseUp(e) {
  if (actionCard.contains(e.target) || resultCard.contains(e.target) || 
      historyPanel.contains(e.target) || floatingBtn.contains(e.target) || settingsModal.contains(e.target)) {
    return;
  }

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 0) {
      currentSelectionText = text;
      const range = selection.getRangeAt(0);
      currentSelectionRect = range.getBoundingClientRect();
      
      // 首次使用检查配置
      if (!aiConfig.api_key) {
        openSettings();
        return;
      }

      actionCard.style.display = 'block';
      positionCard(actionCard);
      resultCard.style.display = 'none';
      if (abortController) abortController.abort(); // 中断之前的请求
    } else {
      hideAllCards();
    }
  }, 50);
}

function bindEvents() {
  // 动作按钮
  document.getElementById('appine-btn-trans').addEventListener('click', (e) => {
    e.stopPropagation();
    startTranslation();
  });

  document.getElementById('appine-btn-ai').addEventListener('click', (e) => {
    e.stopPropagation();
    showAskAIForm();
  });

  // 关闭结果卡片
  document.getElementById('appine-result-close').addEventListener('click', (e) => {
    e.stopPropagation();
    resultCard.style.display = 'none';
    if (abortController) abortController.abort();
    window.getSelection().removeAllRanges();
  });

  // 悬浮球与历史面板
  floatingBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = historyPanel.style.display === 'none' || historyPanel.style.display === '';
    if (isHidden) {
      renderHistory();
      historyPanel.style.display = 'flex';
    } else {
      historyPanel.style.display = 'none';
    }
  });

  document.getElementById('appine-history-close').addEventListener('click', (e) => {
    e.stopPropagation();
    historyPanel.style.display = 'none';
  });

  // 设置面板相关
  document.getElementById('appine-btn-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    openSettings();
  });

  document.getElementById('appine-cfg-cancel').addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  document.getElementById('appine-cfg-save').addEventListener('click', () => {
    saveSettings();
  });

  // 动态更新默认翻译模型的下拉列表（当用户修改模型列表输入框时）
  document.getElementById('appine-cfg-models').addEventListener('input', (e) => {
    const models = e.target.value.split(',').map(s => s.trim()).filter(s => s);
    const select = document.getElementById('appine-cfg-transmodel');
    const currentVal = select.value;
    select.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.innerText = m;
      if (m === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  });
}

export default {
  name: 'selection-assistant',
  setup(api) {
    pluginApi = api;
    loadData();
    initUI();
    bindEvents(); 
    api.on('mouseup', onMouseUp);
    api.log('Selection Assistant v2 loaded');
  },
  teardown() {
    if (pluginApi) pluginApi.off('mouseup', onMouseUp);
    if (abortController) abortController.abort();
    [actionCard, resultCard, floatingBtn, historyPanel, settingsModal].forEach(el => {
      if (el) el.remove();
    });
    const style = document.getElementById('appine-assistant-style');
    if (style) style.remove();
  }
};