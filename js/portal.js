/**
 * Portal JS v2.0 — 旅程管理门户
 * 所有旅程来自 API，无内置旅程
 */
(function() {
  'use strict';

  var journeys = [];
  var cloudConnected = false;

  // ═══════════════ INIT ═══════════════
  function init() {
    renderCards();
    setupUpload();
    checkCloudStatus();
    loadFromCloud();
  }

  // ═══════════════ RENDER ═══════════════
  function renderCards() {
    var grid = document.getElementById('cards-grid');
    if (!grid) return;

    var html = '';
    journeys.forEach(function(j) {
      html +=
        '<div class="journey-card" onclick="sessionStorage.setItem(\'current_journey_id\',\'' + j.id + '\');location.href=\'' + j.file + '\'">' +
          '<button class="card-delete-btn" title="删除此旅程" onclick="event.stopPropagation();deleteJourney(\'' + j.id + '\')">×</button>' +
          '<div class="card-accent" style="background:' + j.color + '"></div>' +
          '<div class="card-title">' + escHtml(j.title) + '</div>' +
          '<div class="card-meta">' +
            '<span>📊 ' + j.phases + ' 阶段</span>' +
            '<span>🔷 ' + j.stages + ' 环节</span>' +
          '</div>' +
          '<div class="card-arrow">→</div>' +
        '</div>';
    });

    html +=
      '<div class="journey-card upload-card" onclick="document.getElementById(\'html-file-input\').click()">' +
        '<div class="upload-icon">📤</div>' +
        '<div class="upload-text">上传新旅程 HTML</div>' +
        '<div class="upload-hint">支持旅程 HTML 文件</div>' +
      '</div>';

    grid.innerHTML = html;
  }

  // ═══════════════ DELETE ═══════════════
  function deleteJourney(id) {
    var j = journeys.find(function(b) { return b.id === id; });
    if (!j) return;
    if (!confirm('确定要删除旅程 "' + j.title + '" 吗？')) return;

    if (!window._apiClient) { portalToast('❌ 云端未连接'); return; }

    window._apiClient.deleteJourney(id).then(function() {
      journeys = journeys.filter(function(x) { return x.id !== id; });
      sortJourneys();
      renderCards();
      portalToast('已删除旅程 "' + j.title + '"');
    }).catch(function(err) {
      portalToast('删除失败: ' + err.message);
    });
  }
  window.deleteJourney = deleteJourney;

  // ═══════════════ UPLOAD ═══════════════
  function setupUpload() {
    var input = document.getElementById('html-file-input');
    if (!input) return;
    input.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) { handleUpload(file); input.value = ''; }
    });
    document.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.addEventListener('drop', function(e) {
      e.preventDefault();
      var file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.html') || file.name.endsWith('.htm'))) handleUpload(file);
    });
  }

  function handleUpload(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var html = e.target.result;
      var parsed = parseJourneyHtml(html);
      if (!parsed) { portalToast('❌ 无法解析 HTML 文件'); return; }

      var id = 'custom_' + Date.now();
      var title = parsed.title || file.name.replace(/\.(html|htm)$/i, '');

      var dataMatch = html.match(/const\s+DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
      var uploadedData = null;
      if (dataMatch) {
        try { uploadedData = JSON.parse(dataMatch[1]); } catch(ex) {}
      }
      if (!uploadedData) { portalToast('❌ 无法解析旅程数据'); return; }
      if (!window._apiClient) { portalToast('❌ 云端未连接'); return; }

      window._apiClient.createJourney(id, title, uploadedData).then(function() {
        journeys.push({ id: id, title: title, file: 'journeys/custom.html?id=' + id, phases: parsed.phases || 1, stages: parsed.stages || 3, color: randomColor() });
        sortJourneys();
        renderCards();
        portalToast('✅ "' + title + '" 已上传到云端');
      }).catch(function(err) {
        portalToast('❌ 上传失败: ' + err.message);
      });
    };
    reader.readAsText(file);
  }

  function parseJourneyHtml(html) {
    var match = html.match(/const\s+DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (!match) match = html.match(/DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;
    try {
      var data = JSON.parse(match[1]);
      return { title: extractTitle(html), phases: data.phases ? data.phases.length : 1, stages: data.stages ? data.stages.length : 3 };
    } catch(e) {
      try {
        var cleaned = match[1].replace(/,(\s*[}\]])/g, '$1').replace(/'/g, '"');
        var data = JSON.parse(cleaned);
        return { title: extractTitle(html), phases: data.phases ? data.phases.length : 1, stages: data.stages ? data.stages.length : 3 };
      } catch(e2) { return null; }
    }
  }

  function extractTitle(html) {
    var m = html.match(/<title>([^<]+)<\/title>/);
    if (m) return m[1];
    m = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
    return m ? m[1].replace(/^JOB[：:]\s*/, '').trim() : '未命名旅程';
  }

  function randomColor() {
    var colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ═══════════════ CLOUD ═══════════════
  function checkCloudStatus() {
    if (window._apiClient && window._apiClient.isConnected()) { cloudConnected = true; updateStatusDot(true); }
    else { cloudConnected = false; updateStatusDot(false); }
    document.addEventListener('api-ready', function(e) { cloudConnected = e.detail.connected; updateStatusDot(cloudConnected); });
  }

  function updateStatusDot(connected) {
    var dot = document.querySelector('.sync-status .dot');
    var text = document.querySelector('.sync-status .status-text');
    if (dot) { if (connected) dot.classList.remove('offline'); else dot.classList.add('offline'); }
    if (text) { text.textContent = connected ? '☁️ 云端已连接' : '离线模式'; }
  }

  function sortJourneys() {
    journeys.sort(function(a, b) { return a.title.localeCompare(b.title, 'zh'); });
  }

  function loadFromCloud() {
    if (!window._apiClient) return;
    window._apiClient.listJourneys().then(function(res) {
      if (!res.journeys) return;
      var ids = {};
      journeys.forEach(function(j) { ids[j.id] = true; });
      var changed = false;
      res.journeys.forEach(function(record) {
        if (ids[record.id]) return;
        journeys.push({ id: record.id, title: record.title || '未命名旅程', file: 'journeys/custom.html?id=' + record.id, phases: record.phases || 1, stages: record.stages || 3, color: randomColor() });
        ids[record.id] = true;
        changed = true;
      });
      if (changed) { sortJourneys(); renderCards(); }
    }).catch(function(err) { console.warn('云端加载失败:', err.message); });
  }

  // ═══════════════ UTILS ═══════════════
  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function portalToast(msg) {
    var el = document.getElementById('portal-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._to);
    el._to = setTimeout(function() { el.classList.remove('show'); }, 4000);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
