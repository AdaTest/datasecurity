/**
 * Portal JS — 旅程管理门户逻辑
 */

(function() {
  'use strict';

  // ═══════════════ JOURNEY REGISTRY ═══════════════
  // 注册所有预置的旅程（从 local journey HTML 中提取的元数据）
  var BUILTIN_JOURNEYS = [
    {
      id: 'overview',
      title: '数据安全全流程未来旅程',
      file: 'journeys/总览_数据安全全流程未来旅程.html',
      phases: 3,
      stages: 9,
      color: '#3b82f6'
    },
    {
      id: 'sub1',
      title: '子旅程1：上架部署——从手工逐条配置到自动化接入与资产纳管',
      file: 'journeys/子旅程1_上架部署.html',
      phases: 3,
      stages: 10,
      color: '#8b5cf6'
    },
    {
      id: 'sub2',
      title: '子旅程2：数据暴露面盘点——从不知道敏感数据在哪到全面掌握暴露面',
      file: 'journeys/子旅程2_数据暴露面盘点.html',
      phases: 4,
      stages: 12,
      color: '#06b6d4'
    },
    {
      id: 'sub3',
      title: '子旅程3：数据风险运营——从告警泛滥难追溯到精准研判闭环处置',
      file: 'journeys/子旅程3_数据风险运营.html',
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
    // Load journeys from localStorage (includes user-uploaded ones)
    loadJourneys();
    renderCards();
    setupUpload();
    checkCloudStatus();
  }

  function loadJourneys() {
    // Start with built-in journeys
    journeys = BUILTIN_JOURNEYS.map(function(j) { return Object.assign({}, j); });

    // Add user-uploaded journeys from localStorage
    try {
      var saved = localStorage.getItem('portal_journeys');
      if (saved) {
        var extra = JSON.parse(saved);
        extra.forEach(function(j) {
          // Avoid duplicates
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

    // Journey cards
    journeys.forEach(function(j) {
      html +=
        '<div class="journey-card" onclick="location.href=\'' + j.file + '\'">' +
          '<div class="card-accent" style="background:' + j.color + '"></div>' +
          '<div class="card-title">' + escHtml(j.title) + '</div>' +
          '<div class="card-meta">' +
            '<span>📊 ' + j.phases + ' 阶段</span>' +
            '<span>🔷 ' + j.stages + ' 环节</span>' +
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

    // Drag and drop on the whole page
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
        portalToast('无法解析 HTML 文件，请确认是有效的旅程文件');
        return;
      }

      // Generate a unique ID
      var id = 'custom_' + Date.now();
      var fileName = file.name.replace('.html', '');

      // Save the HTML file to localStorage (so the journey page can load it)
      localStorage.setItem('journey_html_' + id, html);

      // Add to journey list
      var newJourney = {
        id: id,
        title: parsed.title || fileName,
        file: 'journeys/custom.html?id=' + id,
        phases: parsed.phases || 1,
        stages: parsed.stages || 3,
        color: randomColor()
      };
      journeys.push(newJourney);
      saveJourneyList();
      renderCards();
      portalToast('✅ 旅程 "' + newJourney.title + '" 已添加');
    };
    reader.readAsText(file);
  }

  function parseJourneyHtml(html) {
    // Try to extract DEFAULT_DATA from the HTML
    var match = html.match(/const\s+DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
    if (!match) {
      // Try alternate pattern
      match = html.match(/DEFAULT_DATA\s*=\s*(\{[\s\S]*?\});/);
    }
    if (!match) return null;

    try {
      var data = JSON.parse(match[1]);
      return {
        title: extractTitle(html),
        phases: data.phases ? data.phases.length : 1,
        stages: data.stages ? data.stages.length : 3
      };
    } catch(e) {
      return null;
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
    if (typeof supabase !== 'undefined' && supabase) {
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
    el._to = setTimeout(function() { el.classList.remove('show'); }, 2500);
  }

  // ═══════════════ START ═══════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
