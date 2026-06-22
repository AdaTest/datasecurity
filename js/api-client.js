/**
 * API Client v2.0
 * 前后端分离架构 — 所有数据操作通过 REST API，不再直连 Supabase
 *
 * 用法：
 *   window._apiClient.listJourneys().then(...)
 *   window._apiClient.updateJourney(id, title, data).then(...)
 *   window._apiClient.subscribe(function(event, payload) { ... })
 */
(function(global) {
  'use strict';

  // ═══════════════ 配置 ═══════════════
  var BASE = global.API_BASE_URL || '/api';
  var _versionCache = {};   // journeyId → latest version number
  var _connected = false;
  var _eventSource = null;
  var _listeners = [];

  // ═══════════════ 底层请求 ═══════════════
  function request(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }

    return fetch(BASE + path, opts).then(function(r) {
      return r.json().then(function(data) {
        if (!r.ok) {
          var err = new Error(data.detail || data.error || 'Request failed');
          err.status = r.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  // ═══════════════ 公开 API ═══════════════

  var api = {

    // ─── 查询 ───────────────────────────────

    /**
     * 获取所有旅程摘要列表（不含完整 data）
     */
    listJourneys: function() {
      return request('GET', '/journeys').then(function(res) {
        // 缓存 version 信息
        var journeys = res.journeys || [];
        journeys.forEach(function(j) {
          _versionCache[j.id] = j.version;
        });
        return res;
      });
    },

    /**
     * 获取单个旅程完整数据
     */
    getJourney: function(id) {
      return request('GET', '/journeys/' + encodeURIComponent(id)).then(function(res) {
        if (res.journey) {
          _versionCache[id] = res.journey.version;
        }
        return res;
      });
    },

    // ─── 创建 ───────────────────────────────

    /**
     * 创建新旅程
     */
    createJourney: function(id, title, data) {
      return request('POST', '/journeys', {
        id: id,
        title: title,
        data: data
      }).then(function(res) {
        if (res.journey) {
          _versionCache[id] = res.journey.version;
        }
        return res;
      });
    },

    // ─── 更新（乐观锁）────────────────────

    /**
     * 更新旅程（自动附带 version 做乐观锁）
     * 如果本地没有 version，先 GET 再重试
     */
    updateJourney: function(id, title, data) {
      var version = _versionCache[id];

      if (version === undefined) {
        // 未知版本 → 先获取最新版本，然后重试
        console.log('⚠️ 本地无版本号，先获取最新数据...');
        return api.getJourney(id).then(function() {
          return api.updateJourney(id, title, data);
        });
      }

      return request('PUT', '/journeys/' + encodeURIComponent(id), {
        title: title,
        data: data,
        version: version
      }).then(function(res) {
        if (res.journey) {
          _versionCache[id] = res.journey.version;
        }
        return res;
      }).catch(function(err) {
        if (err.status === 409) {
          // 版本冲突！提取冲突信息
          var detail = err.data && err.data.detail;
          var conflictInfo = {
            journeyId: id,
            currentVersion: detail ? detail.current_version : null,
            currentData: detail ? detail.current_data : null,
            ourVersion: detail ? detail.your_version : null
          };

          console.warn('⚠️ 版本冲突:', conflictInfo);

          // 触发冲突事件，让 UI 层处理
          document.dispatchEvent(new CustomEvent('journey-conflict', {
            detail: conflictInfo
          }));
        }
        throw err;
      });
    },

    // ─── 删除 ───────────────────────────────

    /**
     * 删除旅程
     */
    deleteJourney: function(id) {
      return request('DELETE', '/journeys/' + encodeURIComponent(id)).then(function() {
        delete _versionCache[id];
      });
    },

    // ─── 版本管理 ───────────────────────────

    /**
     * 获取本地缓存的版本号
     */
    getVersion: function(id) {
      return _versionCache[id];
    },

    /**
     * 手动设置版本号（冲突解决后使用）
     */
    setVersion: function(id, v) {
      _versionCache[id] = v;
    },

    // ─── SSE 实时订阅 ───────────────────────

    /**
     * 订阅实时更新事件
     * @param {function} callback  - callback(eventType, payload)
     *   eventType: 'updated' | 'created' | 'deleted' | 'connected'
     * @returns {EventSource} 可调用 .close() 取消订阅
     */
    subscribe: function(callback) {
      _listeners.push(callback);

      // 只创建一个 EventSource 连接
      if (_eventSource) {
        return _eventSource;
      }

      var es = new EventSource(BASE + '/events');

      es.addEventListener('connected', function() {
        _connected = true;
        _notifyAll('connected', {});
      });

      es.addEventListener('journey-updated', function(e) {
        var data = JSON.parse(e.data);
        _versionCache[data.id] = data.version;
        _notifyAll('updated', data);
      });

      es.addEventListener('journey-created', function(e) {
        var data = JSON.parse(e.data);
        _notifyAll('created', data);
      });

      es.addEventListener('journey-deleted', function(e) {
        var data = JSON.parse(e.data);
        delete _versionCache[data.id];
        _notifyAll('deleted', data);
      });

      es.onerror = function() {
        _connected = false;
        console.warn('⚠️ SSE 连接断开，自动重连中...');
      };

      _eventSource = es;
      return es;
    },

    // ─── 状态 ───────────────────────────────

    /**
     * 是否已连接到后端
     */
    isConnected: function() {
      return _connected;
    }
  };

  function _notifyAll(eventType, payload) {
    _listeners.forEach(function(fn) {
      try { fn(eventType, payload); } catch(e) { console.warn('SSE callback error:', e); }
    });
  }

  // ═══════════════ 健康检查 ═══════════════
  function healthCheck() {
    fetch(BASE + '/health')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _connected = data.ok === true;
        if (_connected) {
          console.log('✅ API 后端已连接:', BASE);
          document.dispatchEvent(new CustomEvent('api-ready', { detail: { connected: true } }));
        }
      })
      .catch(function() {
        _connected = false;
        console.warn('⚠️ API 后端未连接，使用离线模式');
        document.dispatchEvent(new CustomEvent('api-ready', { detail: { connected: false } }));
      });
  }

  // ═══════════════ 初始化 ═══════════════
  healthCheck();

  // 暴露到全局
  global._apiClient = api;

  console.log('🔌 API Client v2.0 已加载，端点:', BASE);

})(window);
