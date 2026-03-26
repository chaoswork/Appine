// content.js

// 1. 核心 PluginLoader 逻辑 (双端共用)
const PluginLoader = (() => {
  const plugins = new Map();

  function register(plugin) {
    if (!plugin) {
      console.log(`[PluginLoader] ❌ 错误: 插件对象为空`);
      return;
    }
    try {
      plugin.setup(api(plugin.name));
      plugins.set(plugin.name, plugin);
      console.log(`[PluginLoader] ✅ ${plugin.name} loaded and setup`);
    } catch (err) {
      console.log(`[PluginLoader] 💥 setup failed for ${plugin.name}: ${err.message || err}`);
    }
  }

  function unload(name) {
    const p = plugins.get(name);
    p?.teardown?.();
    plugins.delete(name);
  }

  function api(name) {
    return {
      on:  (evt, fn) => window.addEventListener(evt, fn, true),
      off: (evt, fn) => window.removeEventListener(evt, fn, true),
      log: (...a)    => console.log(`[${name}]`, ...a),
    };
  }

  return { register, unload, plugins };
})();

// 2. 暴露给全局 (专门为 iOS WKWebView 准备)
window.PluginLoader = PluginLoader;

// 3. 环境嗅探：如果是 Chrome 插件环境，则自动加载插件
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
  
  // 💡 在这里配置 Chrome 插件需要加载的目录
  const PLUGINS = [
    "selection-assistant",
    "link-hints"
  ];

  async function initChrome() {
    for (const name of PLUGINS) {
      try {
        const pluginUrl = chrome.runtime.getURL(`plugins/${name}/index.js`);
        const module = await import(pluginUrl);
        const pluginObj = module.default;
        
        if (pluginObj) {
          console.log(`[Appine-Plugin] ⏳ 开始注册插件: ${name}`);
          PluginLoader.register(pluginObj);
        }
      } catch (e) {
        console.log(`[Appine-Plugin] ❌ 加载插件 ${name} 失败:`, e);
      }
    }
  }

  initChrome();
}
