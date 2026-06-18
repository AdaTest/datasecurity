/**
 * Supabase Client v2
 * 简化版 — 直接初始化，SDK 通过 <script> 标签提前加载
 */
(function(global) {
  'use strict';

  var SUPABASE_URL = 'https://ztyuxgtmlewvcsbylhtc.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0eXV4Z3RtbGV3dmNzYnlsaHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTk3MjEsImV4cCI6MjA5NzMzNTcyMX0.IKbn1YOt51JvzOQxOa64PUeYuGoO3cEB-0abJ0HVyMI';

  function init() {
    if (typeof global.supabase === 'undefined' || !global.supabase.createClient) {
      console.warn('Supabase SDK not loaded');
      global._supabaseClient = null;
      document.dispatchEvent(new CustomEvent('supabase-ready', { detail: { connected: false } }));
      return;
    }

    try {
      global._supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log('✅ Supabase connected');
      document.dispatchEvent(new CustomEvent('supabase-ready', { detail: { connected: true } }));

      // Update portal status
      setTimeout(function() {
        var dot = document.querySelector('.sync-status .dot');
        var text = document.querySelector('.sync-status .status-text');
        if (dot) dot.classList.remove('offline');
        if (text) text.textContent = '☁️ 云端已连接';
      }, 300);
    } catch(e) {
      console.warn('Supabase init failed:', e);
      global._supabaseClient = null;
      document.dispatchEvent(new CustomEvent('supabase-ready', { detail: { connected: false } }));
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also try immediately in case SDK already loaded
  if (typeof global.supabase !== 'undefined' && global.supabase.createClient) {
    init();
  }
})(window);
