/**
 * Portal JS — 旅程管理门户逻辑
 */

(function() {
  'use strict';

  // ═══════════════ JOURNEY REGISTRY ═══════════════
  var BUILTIN_JOURNEYS = [
    {
      id: 'overview',
      title: '数据安全全流程未来旅程',
      file: 'journeys/总览_数据安全全流程未来旅程.html',
      storageKey: 'jm_999521',
      phases: 3,
      stages: 9,
      color: '#3b82f6'
    },
    {
      id: 'sub1',
      title: '子旅程1：上架部署——从手工逐条配置到自动化接入与资产纳管',
      file: 'journeys/子旅程1_上架部署.html',
      storageKey: 'jm_455472',
      phases: 3,
      stages: 10,
      color: '#8b5cf6'
    },
    {
      id: 'sub2',
      title: '子旅程2：数据暴露面盘点——从不知道敏感数据在哪到全面掌握暴露面',
      file: 'journeys/子旅程2_数据暴露面盘点.html',
      storageKey: 'jm_621069',
      phases: 4,
      stages: 12,
      color: '#06b6d4'
    },
    {
      id: 'sub3',
      title: '子旅程3：数据风险运营——从告警泛滥难追溯到精准研判闭环处置',
      file: 'journeys/子旅程3_数据风险运营.html',
      storageKey: 'jm_956133',
      phases: 4,
      stages: 14,
      color: '#f59e0b'
    }
  ];

  // ═══════════════ STATE ═══════════════
  var journeys = [];
  var cloudConnected = false;

  // ═══════════════ INIT ═══════════════
  function init() {
    loadJourneys();
    renderCards();
    setupUpload();
    checkCloudStatus();
  }

  function loadJourneys() {
    var hidden = [];
    try {
      var h = localStorage.getItem('portal_hidden_journeys');
      if (h) hidden = JSON.parse(h);
    } catch(e) {}

    journeys = BUILTIN_JOURNEYS
      .filter(function(j) { return hidden.indexOf(j.id) === -1; })
      .map(function(j) { return Object.assign({}, j); });

    try {
      var saved = localStorage.getItem('portal_journeys');
      if (saved) {
        var extra = JSON.parse(saved);
        extra.forEach(function(j) {
          if (!journeys.find(function(b) { return b.id === j.id; })) {
            journeys.push(j);
          }
        });
      }
    } catch(e) {}
  }

  function saveJourneyList() {
    var extra = journeys.filter(function(j) {
      return !BUILTIN_JOURNEYS.find(function(b) { return b.id === j.id; });
    });
    localStorage.setItem('portal_journeys', JSON.stringify(extra));
  }

  // ═══════════════ RENDER ═══════════════
  function renderCards() {
    var grid = document.getElementById('cards-grid');
    if (!grid) return;

    var html = '';

    journeys.forEach(function(j) {
      var isBuiltin = BUILTIN_JOURNEYS.some(function(b) { return b.id === j.id; });
      html +=
        '<div class="journey-card" onclick="location.href=\'' + j.file + '\'">' +
          '<button class="card-delete-btn" title="删除此旅程" onclick="event.stopPropagation();deleteJourney(\'' + j.id + '\')">×</button>' +
          (isBuiltin ? '<button class="card-copy-btn" title="复制当前编辑版" onclick="event.stopPropagation();copyBuiltinJourney(\'' + j.id + '\')">📋</button>' : '') +
          '<div class="card-accent" style="background:' + j.color + '"></div>' +
          '<div class="card-title">' + escHtml(j.title) + '</div>' +
          '<div class="card-meta">' +
            '<span>📊 ' + j.phases + ' 阶段</span>' +
            '<span>🔷 ' + j.stages + ' 环节</span>' +
            (isBuiltin ? '<span class="card-badge">内置</span>' : '<span class="card-badge custom">上传</span>') +
          '</div>' +
          '<div class="card-arrow">→</div>' +
        '</div>';
    });

    // Upload card
    html +=
      '<div class="journey-card upload-card" onclick="document.getElementById(\'html-file-input\').click()">' +
        '<div class="upload-icon">📤</div>' +
        '<div class="upload-text">上传新旅程 HTML</div>' +
        '<div class="upload-hint">支持现有旅程 HTML 文件</div>' +
      '</div>';

    grid.innerHTML = html;
  }

  // ═══════════════ DELETE ═══════════════
  function deleteJourney(id) {
    var j = journeys.find(function(b) { return b.id === id; });
    if (!j) return;
    if (!confirm('确定要删除旅程 "' + j.title + '" 吗？上传的旅程将永久删除。')) return;

    var isBuiltin = BUILTIN_JOURNEYS.some(function(b) { return b.id === id; });
    if (isBuiltin) {
      var hidden = [];
      try {
        var h = localStorage.getItem('portal_hidden_journeys');
        if (h) hidden = JSON.parse(h);
      } catch(e) {}
      if (hidden.indexOf(id) === -1) hidden.push(id);
      localStorage.setItem('portal_hidden_journeys', JSON.stringify(hidden));
    } else {
      localStorage.removeItem('journey_html_' + id);
      localStorage.removeItem('jm_custom_' + id);
      localStorage.removeItem('jm_custom_' + id + '_cloud_ts');
      // Also delete from Supabase
      if (window._supabaseClient) {
        window._supabaseClient.from('journeys').delete().eq('id', id).then(function() {});
      }
    }

    journeys = journeys.filter(function(x) { return x.id !== id; });
    saveJourneyList();
    renderCards();
    portalToast('已删除旅程 "' + j.title + '"');
  }

  window.deleteJourney = deleteJourney;

  // ═══════════════ COPY BUILTIN ═══════════════
  function copyBuiltinJourney(builtinId) {
    var bj = BUILTIN_JOURNEYS.find(function(b) { return b.id === builtinId; });
    if (!bj) return;
    var editedData = localStorage.getItem(bj.storageKey);
    var newId = 'custom_' + Date.now();

    if (editedData) {
      localStorage.setItem('jm_custom_' + newId, editedData);
      if (window._supabaseClient) {
        window._supabaseClient.from('journeys').upsert({
          id: newId, title: bj.title + ' (副本)',
          data: JSON.parse(editedData),
          updated_at: new Date().toISOString()
        }).then(function() {});
      }
    }

    var newJourney = {
      id: newId, title: bj.title + ' (副本)',
      file: 'journeys/custom.html?id=' + newId,
      phases: bj.phases, stages: bj.stages, color: bj.color
    };
    journeys.push(newJourney);
    saveJourneyList();
    renderCards();
    portalToast('✅ 已创建副本并同步云端');
  }

  window.copyBuiltinJourney = copyBuiltinJourney;

  // ═══════════════ UPLOAD ═══════════════
  function setupUpload() {
    var input = document.getElementById('html-file-input');
    if (!input) return;

    input.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      handleUpload(file);
      input.value = '';
    });

    document.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.addEventListener('drop', function(e) {
      e.preventDefault();
      var file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.html') || file.name.endsWith('.htm'))) {
        handleUpload(file);
      }
    });
  }

  function handleUpload(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var html = e.target.result;
      var parsed = parseJourneyHtml(html);
      if (!parsed) {
        portalToast('❌ 无法解析 HTML 文件，请确认是有效的旅程 HTML');
        return;
      }

      var id = 'custom_' + Date.now();
      var fileName = file.name.replace(/\.(html|htm)$/i, '');
      var title = parsed.title || fileName;

      // Save HTML to localStorage
      localStorage.setItem('journey_html_' + id, html);

      // Extract and save uploaded DEFAULT_DATA as journey data
      var dataMatch = html.match(/const\s+DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
      var uploadedData = null;
      if (dataMatch) {
        try {
          uploadedData = JSON.parse(dataMatch[1]);
          localStorage.setItem('jm_custom_' + id, JSON.stringify(uploadedData));
        } catch(ex) {}
      }

      // Auto-sync to Supabase
      if (window._supabaseClient && uploadedData) {
        window._supabaseClient.from('journeys').upsert({
          id: id, title: title, data: uploadedData,
          updated_at: new Date().toISOString()
        }).then(function(res) {
          if (res.error) console.warn('Sync failed:', res.error);
          else console.log('☁️ 已同步到云端:', title);
        });
      }

      var newJourney = {
        id: id, title: title,
        file: 'journeys/custom.html?id=' + id,
        phases: parsed.phases || 1, stages: parsed.stages || 3,
        color: randomColor()
      };
      journeys.push(newJourney);
      saveJourneyList();
      renderCards();
      portalToast('✅ 旅程 "' + title + '" 已添加并同步云端');
    };
    reader.readAsText(file);
  }

  function parseJourneyHtml(html) {
    var match = html.match(/const\s+DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (!match) match = html.match(/DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;

    try {
      var data = JSON.parse(match[1]);
      return {
        title: extractTitle(html),
        phases: data.phases ? data.phases.length : 1,
        stages: data.stages ? data.stages.length : 3
      };
    } catch(e) {
      try {
        var cleaned = match[1]
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/'/g, '"');
        var data = JSON.parse(cleaned);
        return {
          title: extractTitle(html),
          phases: data.phases ? data.phases.length : 1,
          stages: data.stages ? data.stages.length : 3
        };
      } catch(e2) { return null; }
    }
  }

  function extractTitle(html) {
    var match = html.match(/<title>([^<]+)<\/title>/);
    if (match) return match[1];
    match = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
    if (match) return match[1].replace(/^JOB[：:]\s*/, '').trim();
    return '未命名旅程';
  }

  function randomColor() {
    var colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ═══════════════ CLOUD STATUS ═══════════════
  function checkCloudStatus() {
    if (window._supabaseClient) {
      cloudConnected = true;
      updateStatusDot(true);
    } else {
      cloudConnected = false;
      updateStatusDot(false);
    }
    document.addEventListener('supabase-ready', function(e) {
      cloudConnected = e.detail.connected;
      updateStatusDot(cloudConnected);
    });
  }

  function updateStatusDot(connected) {
    var dot = document.querySelector('.sync-status .dot');
    var text = document.querySelector('.sync-status .status-text');
    if (dot) {
      if (connected) dot.classList.remove('offline');
      else dot.classList.add('offline');
    }
    if (text) {
      text.textContent = connected ? '云端已连接' : '离线模式';
    }
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

  // ═══════════════ START ═══════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
