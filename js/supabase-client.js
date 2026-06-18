/**
 * Supabase Client
 * 连接 Supabase 云端数据库，实现多人实时协作
 * 如果连接失败，自动降级为本地 localStorage 模式
 */

(function(global) {
  'use strict';

  // ═══════════════ SUPABASE CONFIG ═══════════════
  var SUPABASE_URL = 'https://ztyuxgtmlewvcsbylhtc.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0eXV4Z3RtbGV3dmNzYnlsaHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTk3MjEsImV4cCI6MjA5NzMzNTcyMX0.IKbn1YOt51JvzOQxOa64PUeYuGoO3cEB-0abJ0HVyMI';

  // Try to load Supabase SDK from CDN
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = function() {
    initSupabase();
  };
  script.onerror = function() {
    console.warn('Supabase SDK failed to load, running in offline mode');
    global.supabase = null;
    document.dispatchEvent(new CustomEvent('supabase-ready', { detail: { connected: false } }));
  };
  document.head.appendChild(script);

  function initSupabase() {
    // Allow override via global config
    var url = (global.SUPABASE_CONFIG && global.SUPABASE_CONFIG.url) || SUPABASE_URL;
    var key = (global.SUPABASE_CONFIG && global.SUPABASE_CONFIG.key) || SUPABASE_KEY;

    if (url && key && global.supabase && global.supabase.createClient) {
      try {
        global.supabase = global.supabase.createClient(url, key);
        console.log('✅ Supabase connected');
        document.dispatchEvent(new CustomEvent('supabase-ready', { detail: { connected: true } }));
        // Update portal status dot if on portal page
        updatePortalStatus(true);
      } catch(e) {
        console.warn('Supabase init failed:', e);
        global.supabase = null;
        document.dispatchEvent(new CustomEvent('supabase-ready', { detail: { connected: false } }));
        updatePortalStatus(false);
      }
    } else {
      console.log('No Supabase SDK, running in offline mode');
      global.supabase = null;
      document.dispatchEvent(new CustomEvent('supabase-ready', { detail: { connected: false } }));
      updatePortalStatus(false);
    }
  }

  function updatePortalStatus(connected) {
    setTimeout(function() {
      var dot = document.querySelector('.sync-status .dot');
      var text = document.querySelector('.sync-status .status-text');
      if (dot) {
        if (connected) dot.classList.remove('offline');
        else dot.classList.add('offline');
      }
      if (text) {
        text.textContent = connected ? '☁️ 云端已连接' : '离线模式';
      }
    }, 500);
  }
})(window);
