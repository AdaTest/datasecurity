/**
 * Supabase Client
 * 如果配置了 SUPABASE_URL 和 SUPABASE_ANON_KEY，则初始化 Supabase 连接
 * 否则 supabase 为 null，所有操作降级为 localStorage 模式
 *
 * 部署到 Netlify 时，在环境变量中设置 SUPABASE_URL 和 SUPABASE_ANON_KEY 即可启用云端同步
 */

(function(global) {
  'use strict';

  // Try to load Supabase SDK from CDN
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = function() {
    initSupabase();
  };
  script.onerror = function() {
    console.warn('Supabase SDK failed to load, running in offline mode');
    global.supabase = null;
    var event = new CustomEvent('supabase-ready', { detail: { connected: false } });
    document.dispatchEvent(event);
  };
  document.head.appendChild(script);

  function initSupabase() {
    // Check for config from:
    // 1. Global SUPABASE_CONFIG object (set in HTML)
    // 2. URL params (for demo/testing)
    // 3. Netlify environment (via build-time injection would need a different approach)

    var url = null;
    var key = null;

    if (global.SUPABASE_CONFIG) {
      url = global.SUPABASE_CONFIG.url;
      key = global.SUPABASE_CONFIG.key;
    }

    // Try URL params (useful for local testing)
    var params = new URLSearchParams(global.location.search);
    if (!url) url = params.get('supabase_url');
    if (!key) key = params.get('supabase_key');

    if (url && key && global.supabase && global.supabase.createClient) {
      try {
        global.supabase = global.supabase.createClient(url, key);
        console.log('Supabase connected');
        var event = new CustomEvent('supabase-ready', { detail: { connected: true } });
        document.dispatchEvent(event);
      } catch(e) {
        console.warn('Supabase init failed:', e);
        global.supabase = null;
        var event = new CustomEvent('supabase-ready', { detail: { connected: false } });
        document.dispatchEvent(event);
      }
    } else {
      console.log('No Supabase config found, running in offline mode');
      global.supabase = null;
      var event = new CustomEvent('supabase-ready', { detail: { connected: false } });
      document.dispatchEvent(event);
    }
  }
})(window);
