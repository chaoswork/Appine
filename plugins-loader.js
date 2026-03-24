// PluginLoader - 极简插件系统
// 用法: PluginLoader.load(['./plugins/link-hints/index.js'])

const PluginLoader = (() => {
  const plugins = new Map(); // name -> { meta, teardown }

  async function load(paths) {
    for (const path of paths) {
      const mod = await import(path);          // 动态 import
      const plugin = mod.default;
      plugin.setup(api(plugin.name));          // 注入 API
      plugins.set(plugin.name, plugin);
      console.log(`[Plugin] ✅ ${plugin.name} loaded`);
    }
  }

  function unload(name) {
    const p = plugins.get(name);
    p?.teardown?.();                           // 清理副作用
    plugins.delete(name);
  }

  // 每个插件获得的沙箱 API（可按需扩展）
  function api(name) {
    return {
      // ⚠️ 核心修改：必须使用 window 和 true (捕获阶段)，防止被网页拦截
      on:  (evt, fn) => window.addEventListener(evt, fn, true),
      off: (evt, fn) => window.removeEventListener(evt, fn, true),
      log: (...a)    => console.log(`[${name}]`, ...a),
    };
  }

  return { load, unload, plugins };
})();

export default PluginLoader;
