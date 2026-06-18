/**
 * Journey Engine v2.0
 * 共用旅程渲染引擎 — 提取自 4 个旅程 HTML 的重复逻辑
 *
 * 用法：
 *   JourneyEngine.init('journey-table', {
 *     journeyId: 'overview',
 *     storageKey: 'jm_999521',
 *     defaultData: DEFAULT_DATA,
 *     title: '数据安全全流程未来旅程'
 *   });
 */

(function(global) {
  'use strict';

  var JourneyEngine = {};
  var appData;
  var config = {};
  var editMode = false;
  var hasUnsavedChanges = false;
  var remoteUpdatePending = false;

  // ═══════════════ UTILS ═══════════════
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function setStatus(msg) {
    var el = document.getElementById('tb-status');
    if (el) el.textContent = msg;
  }

  function toast(msg) {
    var el = document.getElementById('journey-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._to);
    el._to = setTimeout(function() { el.classList.remove('show'); }, 2000);
  }

  // ═══════════════ ENSURE STRUCTURE ═══════════════
  function ensureStructure() {
    if (!appData.phases || appData.phases.length === 0) appData.phases = deepClone(config.defaultData.phases);
    if (!appData.stages) appData.stages = deepClone(config.defaultData.stages);
    if (!appData.doings) appData.doings = deepClone(config.defaultData.doings);
    if (!appData.thinkFeels) appData.thinkFeels = deepClone(config.defaultData.thinkFeels);
    if (!appData.emotions) appData.emotions = deepClone(config.defaultData.emotions);
    if (!appData.needs) appData.needs = deepClone(config.defaultData.needs);
    var n = appData.stages.length;
    ['doings','thinkFeels','needs','emotions'].forEach(function(k) {
      while (appData[k].length < n) {
        if (k === 'emotions') appData[k].push({ score: "3", label: "一般" });
        else appData[k].push([]);
      }
      if (appData[k].length > n) appData[k] = appData[k].slice(0, n);
    });
    appData.phases.forEach(function(p) {
      if (p.important === undefined) p.important = false;
      if (p.stageCount === undefined) p.stageCount = 1;
    });
    var totalSC = appData.phases.reduce(function(s, p) { return s + (p.stageCount || 0); }, 0);
    if (totalSC !== appData.stages.length && appData.phases.length > 0) {
      var base = Math.floor(appData.stages.length / appData.phases.length);
      var rem = appData.stages.length % appData.phases.length;
      appData.phases.forEach(function(p, i) { p.stageCount = base + (i < rem ? 1 : 0); });
    }
    appData.stages.forEach(function(s) { if (s.important === undefined) s.important = false; });
    ['doings','thinkFeels','needs'].forEach(function(k) {
      appData[k].forEach(function(col) { col.forEach(function(item) { if (item.important === undefined) item.important = false; }); });
    });
    appData.emotions.forEach(function(e) { if (e.important === undefined) e.important = false; });
  }

  // ═══════════════ RENDER ═══════════════
  function renderAll() {
    var container = document.getElementById(config.containerId);
    if (!container) return;
    var n = appData.stages.length;
    var colPct = (100 / n).toFixed(10);
    var phaseCols = appData.phases.map(function(p) { return p.stageCount || 0; });

    // Phase row
    var phaseHTML = '';
    var phaseNames = appData.phases.map(function(p) { return p.name; });
    var phaseBgs = appData.phases.map(function(p) { return p.bg; });
    phaseCols.forEach(function(cnt, pi) {
      var w = (parseFloat(colPct) * cnt).toFixed(6);
      var isFirst = pi === 0;
      var isLast = pi === phaseCols.length - 1;
      var phasesLen = phaseCols.length;
      var clip;
      if (phasesLen === 1) clip = 'none';
      else if (isFirst) clip = 'polygon(0% 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 0% 100%)';
      else if (isLast) clip = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 10px 50%)';
      else clip = 'polygon(0% 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 0% 100%, 10px 50%)';
      var ml = isFirst ? '' : 'ml-2';
      var insertBeforeBtn = '<button class="add-item-btn" style="position:absolute;left:3px;bottom:2px;width:16px;height:16px;border-radius:50%;margin:0;padding:0;font-size:12px;line-height:1;z-index:200;" onclick="event.stopPropagation();JourneyEngine.addPhaseAt(' + pi + ')" title="在此前插入阶段">+</button>';
      var insertAfterBtn = isLast ? '<button class="add-item-btn" style="position:absolute;right:14px;bottom:2px;width:16px;height:16px;border-radius:50%;margin:0;padding:0;font-size:12px;line-height:1;z-index:200;" onclick="event.stopPropagation();JourneyEngine.addPhaseAt(' + (pi+1) + ')" title="在末尾追加阶段">+</button>' : '';
      phaseHTML += '<div style="width: ' + w + '%; clip-path: ' + clip + '" class="h-full relative text-white flex items-center justify-center shadow-sm ' + phaseBgs[pi] + '" data-section="phases" data-idx="' + pi + '">' + insertBeforeBtn + insertAfterBtn + '<div class="text-[11px] font-bold whitespace-nowrap ' + ml + ' mr-2 editable-text" contenteditable="false" data-section="phases" data-idx="' + pi + '" data-field="name" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">' + escHtml(phaseNames[pi]) + '</div><div class="item-ctrl" style="top:1px;right:4px;z-index:200;"><button class="btn-del" title="删除阶段" onclick="event.stopPropagation();JourneyEngine.deletePhase(' + pi + ')">×</button></div></div>';
    });

    // Stage row
    var stageHTML = '<div class="stage-sep"><button class="stage-add-btn" onclick="JourneyEngine.addColumnAt(0,0)" title="在开头插入">+</button></div>';
    appData.stages.forEach(function(s, i) {
      stageHTML += '<div style="width: ' + colPct + '%" class="border-r border-slate-200 last:border-r-0 flex items-center justify-center h-full relative px-2 editable-cell" data-section="stages" data-idx="' + i + '"><div class="w-full truncate text-center bg-white border border-slate-200 shadow-sm rounded py-1 px-1.5 text-[11px] font-bold text-slate-700 editable-text" contenteditable="false" data-section="stages" data-idx="' + i + '" data-field="text" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">' + escHtml(s.text) + '</div><div class="item-ctrl"><button class="btn-del" title="删除环节" onclick="event.stopPropagation();JourneyEngine.deleteColumn(' + i + ')">×</button></div></div>';
      stageHTML += '<div class="stage-sep"><button class="stage-add-btn" onclick="JourneyEngine.addColumnAt(' + (i+1) + ',' + i + ')" title="在此后插入">+</button></div>';
    });

    // Doing row
    var doingHTML = '';
    appData.doings.forEach(function(col, ci) {
      var itemsHTML = col.map(function(item, ii) {
        return '<div class="text-left py-0.5 text-[11px] text-slate-700 font-medium flex items-start gap-1 leading-snug relative editable-card" data-section="doings" data-col="' + ci + '" data-idx="' + ii + '"><span class="text-[#3b82f6] mt-[1px] leading-none shrink-0 font-bold">▪</span><span class="editable-text" contenteditable="false" data-section="doings" data-col="' + ci + '" data-idx="' + ii + '" data-field="text" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">' + escHtml(item.text) + '</span><div class="item-ctrl"><button class="btn-del" title="删除" onclick="event.stopPropagation();JourneyEngine.deleteItem(\'doings\',' + ci + ',' + ii + ')">×</button></div></div>';
      }).join('');
      doingHTML += '<div style="width: ' + colPct + '%" class="p-1.5 border-r border-slate-200 border-dashed last:border-r-0 flex flex-col gap-0.5" data-section="doings-col" data-col="' + ci + '">' + itemsHTML + '<button class="add-item-btn" onclick="JourneyEngine.addItem(\'doings\',' + ci + ')">+ 添加行为</button></div>';
    });

    // Think & Feel row
    var tfHTML = '';
    appData.thinkFeels.forEach(function(col, ci) {
      var cardsHTML = col.map(function(item, ii) {
        return '<div class="backdrop-blur-sm border shadow-sm rounded p-2 mb-1.5 w-[98%] max-w-[200px] relative group transition-colors hover:z-50 bg-white/90 border-slate-200 hover:border-blue-300 editable-card" data-section="thinkFeels" data-col="' + ci + '" data-idx="' + ii + '"><div class="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 border-b border-r rotate-45 transition-colors border-slate-200 bg-white group-hover:border-blue-300"></div><div class="text-[10px] leading-snug break-words relative z-10 flex flex-col gap-0.5 text-left"><div class="flex items-start gap-1 font-bold text-slate-700"><span class="editable-text" contenteditable="false" data-section="thinkFeels" data-col="' + ci + '" data-idx="' + ii + '" data-field="title" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">' + escHtml(item.title) + '</span></div><div class="leading-relaxed mt-0.5 text-slate-600 editable-text" contenteditable="false" data-section="thinkFeels" data-col="' + ci + '" data-idx="' + ii + '" data-field="desc" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();this.blur();}">' + escHtml(item.desc) + '</div></div><div class="item-ctrl"><button class="btn-del" title="删除" onclick="event.stopPropagation();JourneyEngine.deleteItem(\'thinkFeels\',' + ci + ',' + ii + ')">×</button></div></div>';
      }).join('');
      tfHTML += '<div style="width: ' + colPct + '%" class="px-1.5 flex flex-col items-center relative z-10 hover:z-50">' + cardsHTML + '<button class="add-item-btn" onclick="JourneyEngine.addItem(\'thinkFeels\',' + ci + ')" style="max-width:200px">+ 添加想法</button></div>';
    });

    // Emotion chart
    var emotionPathPoints = appData.emotions.map(function(e, i) {
      var x = (parseFloat(colPct) * i + parseFloat(colPct) / 2);
      var score = parseFloat(e.score) || 3;
      var y = Math.max(5, Math.min(95, 100 - score * 15));
      return { x: x, y: y };
    });
    var pathD = '';
    emotionPathPoints.forEach(function(p, i) {
      if (i === 0) pathD += 'M ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
      else {
        var prev = emotionPathPoints[i-1];
        var cp = prev.x + (p.x - prev.x) / 2;
        pathD += ' C ' + cp.toFixed(2) + ' ' + prev.y.toFixed(2) + ', ' + cp.toFixed(2) + ' ' + p.y.toFixed(2) + ', ' + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
      }
    });
    var lp = emotionPathPoints[emotionPathPoints.length-1];
    var fp = emotionPathPoints[0];
    var areaD = pathD + ' L ' + lp.x.toFixed(2) + ' 100 L ' + fp.x.toFixed(2) + ' 100 Z';

    var emotionLabelsHTML = '';
    appData.emotions.forEach(function(e, i) {
      var x = (parseFloat(colPct) * i + parseFloat(colPct) / 2).toFixed(2);
      var score = parseFloat(e.score) || 3;
      var y = Math.max(5, Math.min(95, 100 - score * 15));
      emotionLabelsHTML += '<div class="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 editable-cell pointer-events-auto" style="left: ' + x + '%; top: ' + y + '%;" data-section="emotions" data-idx="' + i + '"><div class="text-[9px] font-bold text-slate-600 leading-none editable-text pointer-events-auto" contenteditable="false" data-section="emotions" data-idx="' + i + '" data-field="score" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">' + escHtml(e.score) + '</div><div class="text-[11px] whitespace-nowrap text-slate-800 mt-0.5 editable-text pointer-events-auto" contenteditable="false" data-section="emotions" data-idx="' + i + '" data-field="label" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">' + escHtml(e.label) + '</div></div>';
    });

    var gridLinesHTML = Array.from({length: n}, function(_, i) {
      return '<div style="width: ' + colPct + '%" class="h-full border-r border-dashed border-slate-200 last:border-r-0 relative"></div>';
    }).join('');

    // Needs row
    var needsHTML = '';
    appData.needs.forEach(function(col, ci) {
      var cardsHTML = col.map(function(item, ii) {
        var isAmber = item.type === 'amber';
        var bgClass = isAmber ? 'bg-amber-50/80 border-amber-300 hover:border-amber-400' : 'bg-blue-50/50 border-blue-100 hover:border-blue-300';
        var textClass = isAmber ? 'text-amber-700 font-bold' : 'text-slate-800 font-medium';
        var iconHTML = isAmber ? '<span class="text-amber-500 mr-1 text-[10px] mt-[1px]">💡</span>' : '<span class="text-blue-500 font-bold mr-1 mt-[1px]">•</span>';
        var descHTML = item.desc ? '<div class="mt-0.5 pl-3 ' + (isAmber?'text-amber-700/80':'text-slate-600') + ' editable-text" contenteditable="false" data-section="needs" data-col="' + ci + '" data-idx="' + ii + '" data-field="desc" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();this.blur();}">' + escHtml(item.desc) + '</div>' : '';
        return '<div class="group relative border rounded p-1.5 text-left text-[10px] leading-relaxed transition-colors hover:z-50 ' + bgClass + ' editable-card" data-section="needs" data-col="' + ci + '" data-idx="' + ii + '"><div class="flex items-start ' + textClass + '">' + iconHTML + '<span class="editable-text" contenteditable="false" data-section="needs" data-col="' + ci + '" data-idx="' + ii + '" data-field="title" onblur="JourneyEngine.onTextBlur(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}">' + escHtml(item.title) + '</span></div>' + descHTML + '<div class="item-ctrl"><button class="btn-star' + (item.type==='amber'?' on':'') + '" title="' + (item.type==='amber'?'取消重点':'标记重点') + '" onclick="event.stopPropagation();JourneyEngine.toggleImportant(\'needs\',' + ci + ',' + ii + ')">⭐</button><button class="btn-del" title="删除" onclick="event.stopPropagation();JourneyEngine.deleteItem(\'needs\',' + ci + ',' + ii + ')">×</button></div></div>';
      }).join('');
      needsHTML += '<div style="width: ' + colPct + '%" class="p-1.5 border-r border-[#cbd5e1] border-dashed last:border-r-0 flex flex-col gap-1" data-section="needs-col" data-col="' + ci + '">' + cardsHTML + '<button class="add-item-btn" onclick="JourneyEngine.addItem(\'needs\',' + ci + ')">+ 添加需求</button></div>';
    });

    function rowLabel(cn, en) {
      return '<div class="w-20 flex-shrink-0 flex flex-col justify-center items-center text-center border-r border-[#e2e8f0] bg-[#f8fafc] z-10 relative"><span class="text-[11px] font-bold text-slate-800 tracking-wide">' + cn + '</span><span class="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">' + en + '</span></div>';
    }

    container.innerHTML =
      '<div class="flex relative border-b border-slate-200 bg-white h-9">' + rowLabel('阶段', 'Phase') + '<div class="flex-1 flex overflow-hidden">' + phaseHTML + '</div></div>' +
      '<div class="flex border-b border-slate-200 bg-slate-50 h-10">' + rowLabel('环节', 'Stage') + '<div class="flex-1 flex">' + stageHTML + '</div></div>' +
      '<div class="flex border-b border-slate-200 min-h-[64px] bg-white">' + rowLabel('行为', 'Doing') + '<div class="flex-1 flex">' + doingHTML + '</div></div>' +
      '<div class="flex bg-[#f8fafc] border-b border-slate-200">' + rowLabel('想法与情绪', 'Think & Feel') + '<div class="flex-1 relative flex flex-col"><div class="absolute inset-0 flex pointer-events-none z-0">' + gridLinesHTML + '</div><div class="flex w-full relative pt-1.5 z-10" style="padding-bottom: 108px">' + tfHTML + '</div><div class="absolute left-0 right-0 bottom-1.5 h-[100px] pointer-events-none z-0"><svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100"><defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.4"/><stop offset="50%" stop-color="#fbbf24" stop-opacity="0.2"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0.1"/></linearGradient></defs><path d="' + areaD + '" fill="url(#areaG)" stroke="none"/><path d="' + pathD + '" fill="none" stroke="#6a1b9a" stroke-width="0.4" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="absolute left-0 right-0 bottom-1.5 h-[100px] pointer-events-none z-20">' + emotionLabelsHTML + '</div></div></div>' +
      '<div class="flex border-b border-slate-200 min-h-[80px] bg-white rounded-b-sm">' + rowLabel('需求', 'Needs') + '<div class="flex-1 flex">' + needsHTML + '</div></div>';

    applyEditMode();
  }

  // ═══════════════ EDIT MODE ═══════════════
  function toggleEditMode() {
    if (editMode && hasUnsavedChanges) {
      if (confirm('有未保存的修改，是否保存后再退出？')) saveData();
    }
    editMode = !editMode;
    hasUnsavedChanges = false;
    applyEditMode();
    var btn = document.getElementById('btn-edit');
    if (btn) {
      if (editMode) {
        btn.textContent = '退出编辑';
        btn.classList.add('active');
      } else {
        btn.textContent = '编辑模式';
        btn.classList.remove('active');
        setStatus('就绪');
      }
    }
  }

  function applyEditMode() {
    if (editMode) document.body.classList.add('editing');
    else document.body.classList.remove('editing');
    document.querySelectorAll('.editable-text').forEach(function(el) { el.contentEditable = editMode ? 'true' : 'false'; });
  }

  // ═══════════════ TEXT CHANGE ═══════════════
  function onTextBlur(el) {
    if (!editMode) return;
    var section = el.dataset.section;
    var field = el.dataset.field || 'text';
    var newVal = el.textContent.trim();
    if (section === 'stages') { var idx = parseInt(el.dataset.idx); appData.stages[idx][field] = newVal; }
    else if (section === 'phases') { var idx = parseInt(el.dataset.idx); appData.phases[idx][field] = newVal; }
    else if (section === 'doings' || section === 'thinkFeels' || section === 'needs') {
      var col = parseInt(el.dataset.col); var idx = parseInt(el.dataset.idx);
      if (appData[section] && appData[section][col] && appData[section][col][idx]) appData[section][col][idx][field] = newVal;
    }
    else if (section === 'emotions') {
      var idx = parseInt(el.dataset.idx); appData.emotions[idx][field] = newVal;
      clearTimeout(window._emRedraw); window._emRedraw = setTimeout(function() { renderAll(); }, 250);
    }
    hasUnsavedChanges = true;
    setStatus('已修改 (未保存)');
  }

  // ═══════════════ PHASE-STAGE HELPERS ═══════════════
  function findPhaseForStage(stageIdx) {
    var cum = 0;
    for (var i = 0; i < appData.phases.length; i++) { cum += (appData.phases[i].stageCount || 0); if (stageIdx < cum) return i; }
    return appData.phases.length - 1;
  }

  // ═══════════════ ADD / DELETE ═══════════════
  function addColumnAt(atIndex, refStageIdx) {
    if (!editMode) return;
    var ref = (refStageIdx !== undefined && refStageIdx < appData.stages.length) ? refStageIdx : Math.min(atIndex, appData.stages.length - 1);
    var pi = findPhaseForStage(ref);
    if (pi >= 0) appData.phases[pi].stageCount = (appData.phases[pi].stageCount || 1) + 1;
    appData.stages.splice(atIndex, 0, { text: '新环节', important: false });
    appData.doings.splice(atIndex, 0, []);
    appData.thinkFeels.splice(atIndex, 0, []);
    appData.emotions.splice(atIndex, 0, { score: '3', label: '一般' });
    appData.needs.splice(atIndex, 0, []);
    hasUnsavedChanges = true;
    renderAll();
    setStatus('已添加环节 (未保存)');
  }

  function deleteColumn(idx) {
    if (!editMode) return;
    if (appData.stages.length <= 1) { toast('至少保留一个环节'); return; }
    if (!confirm('确定要删除环节"' + appData.stages[idx].text + '"及其所有数据吗？')) return;
    var pi = findPhaseForStage(idx);
    if (pi >= 0 && appData.phases[pi].stageCount > 1) appData.phases[pi].stageCount--;
    else if (pi >= 0 && appData.phases.length > 1) appData.phases.splice(pi, 1);
    appData.stages.splice(idx, 1); appData.doings.splice(idx, 1); appData.thinkFeels.splice(idx, 1);
    appData.emotions.splice(idx, 1); appData.needs.splice(idx, 1);
    hasUnsavedChanges = true;
    renderAll();
    setStatus('已删除环节 (未保存)');
  }

  function addPhaseAt(atIndex) {
    if (!editMode) return;
    var stagePos = 0;
    for (var p = 0; p < atIndex && p < appData.phases.length; p++) stagePos += (appData.phases[p].stageCount || 0);
    var bgOptions = ['bg-slate-700', 'bg-slate-600'];
    appData.phases.splice(atIndex, 0, { name: '新场景', bg: bgOptions[atIndex % 2], stageCount: 1, important: false });
    appData.stages.splice(stagePos, 0, { text: '新环节', important: false });
    appData.doings.splice(stagePos, 0, []); appData.thinkFeels.splice(stagePos, 0, []);
    appData.emotions.splice(stagePos, 0, { score: '3', label: '一般' }); appData.needs.splice(stagePos, 0, []);
    hasUnsavedChanges = true;
    renderAll();
    setStatus('已添加阶段+环节 (未保存)');
  }

  function deletePhase(idx) {
    if (!editMode) return;
    if (appData.phases.length <= 1) { toast('至少保留一个阶段'); return; }
    var count = appData.phases[idx].stageCount || 0;
    var stageStart = 0;
    for (var p = 0; p < idx; p++) stageStart += (appData.phases[p].stageCount || 0);
    if (!confirm('确定要删除阶段"' + appData.phases[idx].name + '"及其 ' + count + ' 个环节吗？')) return;
    appData.stages.splice(stageStart, count); appData.doings.splice(stageStart, count);
    appData.thinkFeels.splice(stageStart, count); appData.emotions.splice(stageStart, count);
    appData.needs.splice(stageStart, count);
    appData.phases.splice(idx, 1);
    hasUnsavedChanges = true;
    renderAll();
    setStatus('已删除阶段及环节 (未保存)');
  }

  function addItem(section, colIndex) {
    if (!editMode) return;
    var newItem;
    if (section === 'doings') newItem = { text: '新行为', important: false };
    else if (section === 'thinkFeels') newItem = { title: '新想法', desc: '描述内容', important: false };
    else if (section === 'needs') newItem = { title: '新需求', desc: '', type: 'blue', important: false };
    appData[section][colIndex].push(newItem);
    hasUnsavedChanges = true;
    renderAll();
    setStatus('已添加 (未保存)');
  }

  function deleteItem(section, colIndex, itemIndex) {
    if (!editMode) return;
    if (!confirm('确定要删除此项吗？')) return;
    appData[section][colIndex].splice(itemIndex, 1);
    hasUnsavedChanges = true;
    renderAll();
    setStatus('已删除 (未保存)');
  }

  function toggleImportant(section, colIndex, itemIndex) {
    if (!editMode) return;
    if (section === 'needs') {
      var item = appData.needs[colIndex][itemIndex];
      item.type = item.type === 'amber' ? 'blue' : 'amber';
    }
    hasUnsavedChanges = true;
    renderAll();
    setStatus('已修改 (未保存)');
  }

  // ═══════════════ SAVE ═══════════════
  function saveData(silent) {
    if (document.activeElement && document.activeElement.contentEditable === 'true') document.activeElement.blur();
    setTimeout(function() {
      // Always save to localStorage
      localStorage.setItem(config.storageKey, JSON.stringify(appData));
      hasUnsavedChanges = false;
      setStatus('已保存 ' + new Date().toLocaleTimeString());
      if (!silent) toast('数据已保存到本地');

      // Try to save to Supabase if available
      if (typeof supabase !== 'undefined' && supabase && config.journeyId) {
        saveToSupabase();
      }
    }, 100);
  }

  function saveToSupabase() {
    if (!config.journeyId) return;
    setStatus('正在同步到云端...');
    supabase
      .from('journeys')
      .upsert({
        id: config.journeyId,
        title: config.title || config.journeyId,
        data: appData,
        updated_at: new Date().toISOString()
      })
      .then(function(res) {
        if (res.error) {
          console.warn('Supabase save failed:', res.error);
          setStatus('已保存到本地 (云端同步失败)');
        } else {
          setStatus('已保存到本地 + 云端 ' + new Date().toLocaleTimeString());
        }
      })
      .catch(function(err) {
        console.warn('Supabase save error:', err);
        setStatus('已保存到本地 (云端同步失败)');
      });
  }

  function loadFromCloud() {
    if (typeof supabase === 'undefined' || !supabase || !config.journeyId) return;
    setStatus('正在从云端加载...');
    supabase
      .from('journeys')
      .select('data, updated_at')
      .eq('id', config.journeyId)
      .single()
      .then(function(res) {
        if (res.data && res.data.data) {
          var localUpdated = localStorage.getItem(config.storageKey + '_cloud_ts');
          var cloudUpdated = res.data.updated_at;
          if (localUpdated && cloudUpdated && localUpdated === cloudUpdated) return;
          appData = res.data.data;
          ensureStructure();
          localStorage.setItem(config.storageKey, JSON.stringify(appData));
          localStorage.setItem(config.storageKey + '_cloud_ts', cloudUpdated || '');
          renderAll();
          setStatus('已从云端加载最新数据');
        }
      })
      .catch(function(err) {
        console.warn('Supabase load error:', err);
      });
  }

  function subscribeToCloud() {
    if (typeof supabase === 'undefined' || !supabase || !config.journeyId) return;
    supabase
      .channel('journey-' + config.journeyId)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'journeys', filter: 'id=eq.' + config.journeyId },
        function(payload) {
          if (remoteUpdatePending) return;
          var newData = payload.new.data;
          if (!newData) return;
          remoteUpdatePending = true;
          var currentJSON = JSON.stringify(appData);
          var remoteJSON = JSON.stringify(newData);
          if (currentJSON === remoteJSON) { remoteUpdatePending = false; return; }
          appData = deepClone(newData);
          ensureStructure();
          renderAll();
          localStorage.setItem(config.storageKey, JSON.stringify(appData));
          toast('📡 数据已被他人更新，已自动同步');
          setStatus('已自动同步远程更新');
          remoteUpdatePending = false;
        }
      )
      .subscribe();
  }

  // ═══════════════ YAML ═══════════════
  function yamlStr(s) {
    s = String(s);
    if (/[:\{\}\[\],&\*\?#\|<>=!%@`'"]/.test(s) || s.includes('#') || s.includes('"') || s.trim() !== s)
      return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    return s;
  }

  function buildYamlContent() {
    var n = appData.stages.length;
    var phaseCols = appData.phases.map(function(p) { return p.stageCount || 0; });
    var lines = [];
    lines.push('# ============================================================');
    lines.push('# 未来旅程数据文件（YAML）');
    lines.push('# ============================================================');
    lines.push('');
    var titleEl = document.querySelector('h2');
    lines.push('title: ' + yamlStr(titleEl ? titleEl.textContent.replace(/^JOB[：:]\s*/, '').trim() : ''));
    lines.push('');
    lines.push('phases:');
    var si = 0;
    phaseCols.forEach(function(cnt, pi) {
      var phase = appData.phases[pi] || { name: '场景' };
      lines.push('  - name: ' + yamlStr(phase.name));
      lines.push('    stages:');
      for (var j = 0; j < cnt && si < n; j++, si++) {
        var s = appData.stages[si]; var d = appData.doings[si] || [];
        var t = appData.thinkFeels[si] || []; var e = appData.emotions[si] || {};
        var nd = appData.needs[si] || [];
        lines.push('      - name: ' + yamlStr(s.text));
        if (d.length > 0) { lines.push('        behaviors:'); d.forEach(function(x) { lines.push('          - ' + yamlStr(x.text)); }); }
        else lines.push('        behaviors: []');
        if (t.length > 0) { lines.push('        thoughts:'); t.forEach(function(x) { lines.push('          - summary: ' + yamlStr(x.title)); if (x.desc && x.desc !== x.title) lines.push('            detail: ' + yamlStr(x.desc)); }); }
        else lines.push('        thoughts: []');
        lines.push('        feeling_value: ' + (parseFloat(e.score) || 3));
        lines.push('        feeling_label: ' + yamlStr(e.label || ''));
        if (nd.length > 0) { lines.push('        needs:'); nd.forEach(function(x) { lines.push('          - summary: ' + yamlStr(x.title)); if (x.type === 'amber') lines.push('            is_important: true'); if (x.desc && x.desc !== x.title) lines.push('            detail: ' + yamlStr(x.desc)); }); }
        else lines.push('        needs: []');
      }
    });
    return lines.join('\n');
  }

  function downloadYaml(text) {
    var blob = new Blob([text], { type: 'text/yaml;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'journey_export.yaml'; a.click(); URL.revokeObjectURL(a.href);
  }

  var yamlFileHandle = null;
  function syncYaml() {
    if (document.activeElement && document.activeElement.contentEditable === 'true') document.activeElement.blur();
    setTimeout(function() {
      var yamlText = buildYamlContent();
      if (!window.showOpenFilePicker) { downloadYaml(yamlText); toast('已下载 YAML 文件'); return; }
      if (yamlFileHandle) {
        try { yamlFileHandle.queryPermission({ mode: 'readwrite' }).then(function(p) { if (p !== 'granted') yamlFileHandle = null; }); } catch(e) { yamlFileHandle = null; }
      }
      if (!yamlFileHandle) {
        window.showOpenFilePicker({ types: [{ description: 'YAML', accept: { 'text/yaml': ['.yaml', '.yml'] } }] })
          .then(function(arr) { yamlFileHandle = arr[0]; writeYaml(yamlFileHandle, yamlText); })
          .catch(function(e) { if (e.name !== 'AbortError') { downloadYaml(yamlText); toast('已下载 YAML 文件'); } });
        return;
      }
      writeYaml(yamlFileHandle, yamlText);
    }, 150);
  }

  function writeYaml(handle, text) {
    handle.createWritable().then(function(w) {
      w.write(text).then(function() { w.close(); setStatus('YAML 已同步 ' + new Date().toLocaleTimeString()); toast('YAML 文件已更新'); });
    }).catch(function() { downloadYaml(text); toast('写入失败，已下载文件'); });
  }

  // ═══════════════ RESET ═══════════════
  function resetData() {
    if (!confirm('确定要重置为默认数据吗？所有修改将丢失！')) return;
    appData = deepClone(config.defaultData);
    ensureStructure();
    localStorage.removeItem(config.storageKey);
    hasUnsavedChanges = false;
    renderAll();
    toast('已重置为默认数据');
  }

  // ═══════════════ INIT ═══════════════
  function init(containerId, cfg) {
    config.containerId = containerId;
    config.journeyId = cfg.journeyId || '';
    config.storageKey = cfg.storageKey || 'jm_default';
    config.defaultData = cfg.defaultData || {};
    config.title = cfg.title || '';

    // Load data: localStorage first (fast), then try cloud
    try {
      var saved = localStorage.getItem(config.storageKey);
      appData = saved ? JSON.parse(saved) : deepClone(config.defaultData);
    } catch(e) { appData = deepClone(config.defaultData); }

    ensureStructure();
    renderAll();
    setStatus('就绪 — 点击「编辑模式」开始编辑');

    // Async: try to load from cloud
    loadFromCloud();
    // Subscribe to real-time updates
    subscribeToCloud();

    // Ctrl+S to save
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveData(); }
    });
  }

  // ═══════════════ PUBLIC API ═══════════════
  JourneyEngine.init = init;
  JourneyEngine.renderAll = renderAll;
  JourneyEngine.toggleEditMode = toggleEditMode;
  JourneyEngine.onTextBlur = onTextBlur;
  JourneyEngine.addColumnAt = addColumnAt;
  JourneyEngine.deleteColumn = deleteColumn;
  JourneyEngine.addPhaseAt = addPhaseAt;
  JourneyEngine.deletePhase = deletePhase;
  JourneyEngine.addItem = addItem;
  JourneyEngine.deleteItem = deleteItem;
  JourneyEngine.toggleImportant = toggleImportant;
  JourneyEngine.saveData = saveData;
  JourneyEngine.syncYaml = syncYaml;
  JourneyEngine.resetData = resetData;
  JourneyEngine.loadFromCloud = loadFromCloud;
  JourneyEngine.getData = function() { return appData; };

  global.JourneyEngine = JourneyEngine;
})(window);
