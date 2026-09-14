/* ==========================================================================
 * MeteoHub · 大气科学学术工作台
 * 提供 window.MeteoHubStore 单一事实源；登录态走 /api/auth/*，
 * 数据 GET/PUT 走 /api/state（409 冲突提示）。
 * 未登录或后端不可用时使用 localStorage 持久化。
 * ========================================================================== */

(function () {
    'use strict';

    /* ============================================================
     * 常量与默认示例数据
     * ============================================================ */
    var LS_STATE_ANON = 'meteohub_state_v1_anon';          // 匿名（未登录）状态
    var LS_STATE_PREFIX = 'meteohub_state_v1_user_';     // 每用户私有状态
    var LS_LAST_USER_KEY = 'meteohub_last_user';          // 记录上次登录的用户 id（仅用于键名提示）
    var LS_LEGACY_KEYS = ['meteohub_users', 'meteohub_articles', 'meteohub_friends'];
    var LS_PROFILE_DRAFT = 'meteohub_profile_draft_v1';

    function lsStateKey(userId) {
        return userId ? LS_STATE_PREFIX + userId : LS_STATE_ANON;
    }

    var DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
    var ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
    var USERNAME_REGEX = /^[A-Za-z0-9_\-]{3,24}$/;

    var DEFAULT_STATE = {
        publications: [
            {
                id: 'pub_demo_1', title: '中国地区近 20 年 PM2.5 时空演变与气象驱动因素',
                type: 'article', year: 2023, authors: ['张文清', '李晓彤'],
                venue: 'Atmospheric Chemistry and Physics', doi: '10.5194/acp-23-12345-2023',
                keywords: ['PM2.5', '时空演变', '气象驱动'], abstract: '基于 2010–2022 年全国空气质量监测数据与 ERA5 再分析资料，分析 PM2.5 的年际变化与气象驱动机制。',
                url: '', authorId: 'user_demo_zhang', createdAt: Date.now() - 86400000 * 30, updatedAt: Date.now() - 86400000 * 5
            },
            {
                id: 'pub_demo_2', title: '青藏高原夏季对流云微物理特征研究',
                type: 'preprint', year: 2024, authors: ['次仁多吉', '陈思颖'],
                venue: 'EGU preprint repository', doi: '10.5194/egusphere-2024-5678',
                keywords: ['青藏高原', '对流云', '微物理'], abstract: '结合 CloudSat 与地面雷达，分析高原夏季对流云的微物理特征差异。',
                url: '', authorId: 'user_demo_ciren', createdAt: Date.now() - 86400000 * 12, updatedAt: Date.now() - 86400000 * 2
            }
        ],
        questions: [
            {
                id: 'q_demo_1', title: 'ERA5 边界层高度数据在山区是否可信？',
                tags: ['ERA5', '边界层', '复杂地形'], body: '在横断山区使用 ERA5 BLH 与探空观测对比，发现系统性偏低 30%。各位同仁有相似经历吗？',
                authorId: 'user_demo_zhang', createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 1,
                answers: [
                    { id: 'a_demo_1', questionId: 'q_demo_1', authorId: 'user_demo_ciren', body: '山区 ERA5 BLH 确实系统性偏低，建议结合再分析 + 探空 + 通量塔做联合校正。',
                        createdAt: Date.now() - 86400000 * 3, votes: 4 }
                ],
                voters: { 'user_demo_ciren': 1 }
            },
            {
                id: 'q_demo_2', title: '如何用 Python 高效批量下载 GPM IMERG 数据？',
                tags: ['Python', 'GPM', 'IMERG'], body: '请问有推荐的批量下载脚本或库？我用 earthaccess 经常超时。',
                authorId: 'user_demo_ciren', createdAt: Date.now() - 86400000 * 7, updatedAt: Date.now() - 86400000 * 7,
                answers: [],
                voters: {}
            }
        ],
        researchers: [
            { id: 'user_demo_zhang', username: 'zhangwq', realName: '张文清', institution: '中科院大气物理研究所', title: '副研究员',
                research: '大气化学, PM2.5, 气象驱动', email: 'zhangwq@example.org', orcid: '0000-0001-2345-6789',
                website: 'https://example.org/zhangwq', bio: '关注大气污染与气象条件相互作用。',
                avatar: '张', createdAt: Date.now() - 86400000 * 60 },
            { id: 'user_demo_ciren', username: 'cirendt', realName: '次仁多吉', institution: '中国气象科学研究院', title: '研究员',
                research: '云微物理, 青藏高原', email: 'cirendt@example.org', orcid: '0000-0002-3456-7890',
                website: '', bio: '高原对流云与卫星遥感。',
                avatar: '次', createdAt: Date.now() - 86400000 * 45 }
        ],
        following: [],   // array of researcherIds the current user follows
        bookmarks: [],   // array of publicationIds
        profile: {},     // current user's profile patch (mirror of researchers entry)
        pages: [],
        projects: []
    };

    var PYTHON_EXAMPLES = {
        hello: 'print("Hello, MeteoHub!")\nprint("欢迎使用 Python 工作区（下载后在本地运行）")\n',
        fib: 'a = 0\nb = 1\nseq = "["\nn = 12\ni = 0\nseq = seq + str(a)\nwhile i < n - 1:\n    c = a + b\n    a = b\n    b = c\n    seq = seq + "," + str(a)\n    i = i + 1\nseq = seq + "]"\nprint("斐波那契前 12 项:", seq)\n',
        stats: 'data = [2.1, 3.4, 2.9, 4.1, 3.7, 2.8, 4.6, 3.3]\nmean = sum(data) / len(data)\ntotal = 0\nx = 0\nwhile x < len(data):\n    diff = (data[x] - mean) * (data[x] - mean)\n    total = total + diff\n    x = x + 1\nvariance = total / len(data)\nprint("样本数:", len(data))\nprint("均值:", round(mean, 3))\nprint("方差:", round(variance, 3))\n',
        atmos: 'theta_s = 295.0\ntheta_850 = 300.0\ndelta = theta_850 - theta_s\nstate = "稳定（θ 随高度增加）"\nif delta < 0:\n    state = "不稳定（θ 随高度减小）"\nprint("θ850 - θs =", round(delta, 1), "K →", state)\n',
        error: 'import os\nprint("这段代码尝试 import os —— 本地模式会拒绝执行")\n'
    };

    /* ============================================================
     * Storage 兼容：迁移旧的 localStorage 用户/文章条目
     * ============================================================ */
    function safeParse(key) {
        try { return JSON.parse(localStorage.getItem(key) || 'null'); }
        catch (e) { return null; }
    }

    function migrateLegacy(uid) {
        // 把旧格式的 users / articles 合并进 STATE；明确剔除 password 字段。
        if (safeParse('meteohub_legacy_migrated_v1')) return false;
        var rawUsers = safeParse('meteohub_users') || [];
        if (!Array.isArray(rawUsers)) rawUsers = [];
        var rawArticles = safeParse('meteohub_articles') || [];
        if (!Array.isArray(rawArticles)) rawArticles = [];
        if (!rawUsers.length && !rawArticles.length) return false;
        var state = loadLocalFor(uid);
        rawUsers.filter(function (u) { return u && typeof u === "object"; }).forEach(function (u) {
            if (!state.researchers.find(function (r) { return r.id === u.id; })) {
                state.researchers.push({
                    id: u.id, username: u.username, realName: u.realName || u.username,
                    institution: u.institution || '', title: u.title || '',
                    research: u.research || '', email: u.email || '',
                    orcid: u.orcid || '', website: u.website || '',
                    bio: u.bio || '',
                    avatar: u.avatar || (u.realName || u.username || 'U').substring(0, 1),
                    createdAt: u.createdAt || Date.now()
                    // 注意：password 字段刻意不写入 state
                });
            }
        });
        rawArticles.filter(function (a) { return a && typeof a === "object"; }).forEach(function (a) {
            if (!state.publications.find(function (p) { return p.id === a.id; })) {
                state.publications.push({
                    id: a.id, title: a.title, type: a.type || 'article',
                    year: a.year || new Date().getFullYear(),
                    authors: a.authors || [], venue: a.venue || '',
                    doi: a.doi || '', keywords: a.keywords || [],
                    abstract: a.abstract || a.summary || '',
                    url: a.url || '',
                    authorId: a.authorId,
                    createdAt: a.createdAt || Date.now(),
                    updatedAt: a.updatedAt || Date.now()
                });
            }
        });
        if (!saveLocalFor(state, uid)) return false;
        try { localStorage.setItem('meteohub_legacy_migrated_v1', 'true'); } catch (e) {}
        return true;
    }

    function loadLocalFor(uid) {
        var key = lsStateKey(uid);
        var raw = safeParse(key);
        if (!raw || typeof raw !== 'object') {
            return uid ? emptyState() : JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
        // 兜底补全缺失字段
        Object.keys(DEFAULT_STATE).forEach(function (k) {
            if (k === 'profile') {
                if (typeof raw[k] !== 'object' || raw[k] === null) raw[k] = {};
            } else if (!Array.isArray(raw[k])) {
                raw[k] = [];
            }
        });
        return raw;
    }

    function saveLocalFor(state, uid) {
        try {
            localStorage.setItem(lsStateKey(uid), JSON.stringify(state));
            return true;
        } catch (e) {
            console.warn('localStorage 写入失败', e);
            return false;
        }
    }

    // 兼容旧调用：未指定 uid 时落在匿名槽
    function loadLocal() { return loadLocalFor(null); }
    function saveLocal(state) { saveLocalFor(state, null); }

    /* ============================================================
     * MeteoHubStore（全局契约）
     * - 单一事实源；update 串行化；非 2xx 全部 reject。
     * - 账户状态按 user.id 隔离在 localStorage；logout 切回独立匿名槽。
     * - 拉取失败保留当前账户缓存，禁止以未知 revision 写入。
     * ============================================================ */
    var Store = {
        _state: null,
        _user: null,
        _revision: 0,
        _online: false,
        _saving: false,
        _saveQueue: [],
        _epoch: 0,
        _switching: false,
        _stateReady: false,
        _conflict: false,
        _activeJob: null,

        get: function () { return this._state; },
        getUser: function () { return this._user; },
        isOnline: function () { return this._online; },
        isSaving: function () { return this._saving; },

        _loadForCurrent: function () {
            var userId = this._user ? this._user.id : null;
            this._currentKey = userId ? ('user:' + userId) : 'anon';
            // Legacy browser data belongs to the anonymous workspace only.
            if (!userId) migrateLegacy(null);
            this._state = loadLocalFor(userId);
        },

        _notify: function (scope) {
            this._renderUserUI();
            window.dispatchEvent(new CustomEvent('meteohub:state-changed', {
                detail: { state: this._state, scope: scope, epoch: this._epoch }
            }));
        },

        _cancelPending: function (error) {
            this._saveQueue.splice(0).forEach(function (job) { job.reject(error); });
            if (this._activeJob) this._activeJob.reject(error);
        },

        _beginSessionChange: function () {
            if (this._switching) throw new Error('正在切换账户，请稍候。');
            this._switching = true;
            this._epoch += 1;
            this._cancelPending(new Error('账户已切换，旧账户的待保存操作已取消。'));
            window.dispatchEvent(new CustomEvent('meteohub:identity-changing'));
        },

        _setAnonymous: function () {
            this._user = null;
            this._online = false;
            this._revision = 0;
            this._stateReady = true;
            this._conflict = false;
            this._loadForCurrent();
            try { localStorage.removeItem(LS_LAST_USER_KEY); } catch (e) {}
            this._notify('identity');
        },

        async init() {
            this._state = loadLocalFor(null);
            try {
                var resp = await fetch('/api/auth/me', { credentials: 'same-origin' });
                var data = resp.ok ? await resp.json() : null;
                if (data && data.user) {
                    this._user = data.user;
                    this._loadForCurrent();
                    this._stateReady = await this._pullFromServer();
                    this._online = this._stateReady;
                    if (!this._stateReady) showToast('账户数据读取失败。已保留本机缓存，请刷新重试后再编辑。', 'error');
                } else this._setAnonymous();
            } catch (e) { this._setAnonymous(); }
            this._renderUserUI();
            window.dispatchEvent(new CustomEvent('meteohub:ready'));
        },

        async _pullFromServer() {
            var epoch = this._epoch;
            var userId = this._user && this._user.id;
            try {
                var resp = await fetch('/api/state', { credentials: 'same-origin' });
                if (!resp.ok) return false;
                var data = await resp.json();
                if (epoch !== this._epoch || !data || !data.state || !Number.isInteger(data.revision)) return false;
                this._state = mergeMissing(emptyState(), data.state);
                this._revision = data.revision;
                saveLocalFor(this._state, userId);
                return true;
            } catch (e) { return false; }
        },

        async update(mutator) {
            if (typeof mutator !== 'function') throw new Error('update 需要传入 mutator 函数');
            if (this._switching) throw new Error('正在切换账户，请稍候再保存。');
            if (!this._stateReady) throw new Error('尚未读取账户数据，请刷新重试后再编辑。');
            if (this._conflict) throw new Error('数据版本冲突，请先复制未保存内容，再刷新页面。');
            var self = this;
            return new Promise(function (resolve, reject) {
                self._saveQueue.push({ mutator: mutator, resolve: resolve, reject: reject,
                    epoch: self._epoch, userId: self._user ? self._user.id : null });
                self._drainQueue();
            });
        },

        async _drainQueue() {
            if (this._saving) return;
            this._saving = true;
            try {
                while (this._saveQueue.length) {
                    var job = this._saveQueue.shift();
                    this._activeJob = job;
                    try {
                        await this._runOne(job);
                        job.resolve();
                    } catch (error) {
                        job.reject(error);
                        // A failed predecessor invalidates dependent queued edits.
                        if (job.epoch === this._epoch) this._cancelPending(error);
                    }
                    this._activeJob = null;
                }
            } finally { this._saving = false; }
        },

        async _runOne(job) {
            if (job.epoch !== this._epoch) throw new Error('旧账户操作已取消。');
            var draft = JSON.parse(JSON.stringify(this._state));
            var result = job.mutator(draft);
            if (result && typeof result.then === 'function') await result;
            if (job.epoch !== this._epoch) throw new Error('旧账户操作已取消。');
            if (job.userId !== null) {
                var resp;
                try {
                    resp = await fetch('/api/state', {
                        method: 'PUT', credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state: draft, revision: this._revision })
                    });
                } catch (error) {
                    if (job.epoch === this._epoch) { this._online = false; this._renderUserUI(); }
                    throw new Error('网络错误，未保存。请保留输入并重试。');
                }
                if (job.epoch !== this._epoch) throw new Error('旧账户响应已忽略。');
                if (resp.status === 401) {
                    var expired = new Error('会话已过期，请重新登录。');
                    expired.status = 401;
                    this._epoch += 1;
                    this._cancelPending(expired);
                    window.dispatchEvent(new CustomEvent('meteohub:identity-changing'));
                    this._setAnonymous();
                    showToast(expired.message, 'error');
                    throw expired;
                }
                if (!resp.ok) {
                    var error = new Error(resp.status === 409
                        ? '数据版本冲突，请先复制未保存内容，再刷新页面。'
                        : '保存失败 (HTTP ' + resp.status + ')，请重试。');
                    error.status = resp.status;
                    this._conflict = resp.status === 409;
                    this._online = false;
                    this._renderUserUI();
                    showToast(error.message, 'error');
                    throw error;
                }
                var data = await resp.json();
                if (job.epoch !== this._epoch) throw new Error('旧账户响应已忽略。');
                if (!data || !Number.isInteger(data.revision)) throw new Error('保存响应无效，请刷新确认服务端状态。');
                this._revision = data.revision;
                this._online = true;
            }
            // Publish only a committed snapshot. Failed writes leave inputs available to retry.
            var cached = saveLocalFor(draft, job.userId);
            if (!cached && job.userId === null) throw new Error('浏览器存储不可用或已满，未保存。请先导出内容或释放空间后重试。');
            this._state = draft;
            this._notify('update');
        },

        async _authenticate(kind, payload) {
            this._beginSessionChange();
            try {
                var resp = await fetch('/api/auth/' + kind, {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
                if (!resp.ok) {
                    var failure = await safeJson(resp);
                    throw new Error((failure && failure.error) || '账户操作失败，请重试。');
                }
                var data = await resp.json();
                this._user = data.user;
                this._revision = 0;
                this._conflict = false;
                this._stateReady = false;
                this._loadForCurrent();
                this._notify('identity');
                this._stateReady = await this._pullFromServer();
                this._online = this._stateReady;
                if (!this._stateReady) showToast('账户数据读取失败。已保留本机缓存，请刷新重试后再编辑。', 'error');
                try { localStorage.setItem(LS_LAST_USER_KEY, String(this._user.id)); } catch (e) {}
                this._notify('identity');
            } finally { this._switching = false; }
        },

        async login(username, password) { return this._authenticate('login', { username: username, password: password }); },
        async register(payload) { return this._authenticate('register', payload); },

        async logout() {
            this._beginSessionChange();
            try {
                var resp = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                if (!resp.ok) throw new Error('退出失败，请重试。');
                this._setAnonymous();
            } catch (error) {
                showToast('未能退出账户，请检查网络后重试。', 'error');
                throw error;
            } finally { this._switching = false; }
        },

        _renderUserUI() {
            var authButtons = document.getElementById('authButtons');
            var userMenu = document.getElementById('userMenu');
            if (this._user) {
                authButtons.hidden = true;
                userMenu.hidden = false;
                document.getElementById('userAvatarText').textContent = (this._user.avatar || this._user.username || 'U').substring(0, 1).toUpperCase();
                document.getElementById('topbarUsername').textContent = this._user.realName || this._user.username;
                document.getElementById('dropdownUsername').textContent = this._user.realName || this._user.username;
                document.getElementById('dropdownInstitution').textContent = this._user.institution || '—';
            } else {
                authButtons.hidden = false;
                userMenu.hidden = true;
            }
            var tag = document.querySelector('.build-tag');
            if (tag) tag.textContent = this._user ? '账户私有空间 · 非公开社区' : '本机空间 · 含虚构示例';
            setBackendStatus(this._online ? 'online' : (this._user ? 'partial' : 'offline'));
        }
    };

    async function safeJson(resp) {
        try { return await resp.json(); } catch (e) { return null; }
    }

    function emptyState() {
        var s = {};
        Object.keys(DEFAULT_STATE).forEach(function (k) {
            s[k] = (k === 'profile') ? {} : [];
        });
        return s;
    }

    function mergeMissing(target, source) {
        Object.keys(target).forEach(function (key) {
            if (key === 'profile') {
                if (source.profile && typeof source.profile === 'object' && !Array.isArray(source.profile)) target.profile = source.profile;
            } else if (Array.isArray(source[key])) target[key] = source[key];
        });
        if (source.ui && typeof source.ui === 'object') target.ui = source.ui;
        return target;
    }

    window.MeteoHubStore = Store;

    /* ============================================================
     * 工具函数
     * ============================================================ */
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function sampleLabel(item) {
        return String(item.id).indexOf('_demo_') !== -1 ? '<span class="badge">虚构示例</span> ' : '';
    }

    function safeExternalUrl(value) {
        try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; }
        catch (error) { return ''; }
    }

    function uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(ts) {
        if (!ts) return '';
        var d = new Date(ts);
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function formatRelative(ts) {
        if (!ts) return '';
        var diff = Date.now() - ts;
        var sec = Math.floor(diff / 1000);
        if (sec < 60) return '刚刚';
        if (sec < 3600) return Math.floor(sec / 60) + ' 分钟前';
        if (sec < 86400) return Math.floor(sec / 3600) + ' 小时前';
        if (sec < 86400 * 30) return Math.floor(sec / 86400) + ' 天前';
        return formatDate(ts);
    }

    function debounce(fn, wait) {
        var t;
        return function () {
            var ctx = this, args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, wait);
        };
    }

    function validateDOI(doi) {
        if (!doi) return { ok: true, normalized: '' };
        var d = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
        return { ok: DOI_REGEX.test(d), normalized: d };
    }

    function validateORCID(orcid) {
        if (!orcid) return true;
        return ORCID_REGEX.test(orcid.trim());
    }

    /* ============================================================
     * Toast / 后端状态指示
     * ============================================================ */
    function showToast(message, type) {
        var container = document.getElementById('toastContainer');
        if (!container) return;
        var t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.innerHTML = '<span>' + escapeHtml(message) + '</span>';
        container.appendChild(t);
        setTimeout(function () { t.classList.add('show'); }, 10);
        setTimeout(function () {
            t.classList.remove('show');
            setTimeout(function () { t.remove(); }, 300);
        }, 3500);
    }

    function setBackendStatus(state) {
        var dot = document.getElementById('backendStatusDot');
        if (!dot) return;
        dot.dataset.state = state;
        var title = state === 'online' ? '已登录且已连接服务端' : (state === 'partial' ? '已登录，服务端未连接' : '离线模式（仅本地）');
        var btn = document.getElementById('backendStatusBtn');
        if (btn) btn.title = title;
        if (dot.parentElement) dot.parentElement.title = title;
    }

    /* ============================================================
     * 路由
     * ============================================================ */
    var Router = {
        current: null,

        init() {
            window.addEventListener('hashchange', this._sync);
            document.addEventListener('click', function (e) {
                var a = e.target.closest('[data-action="goto"]');
                if (a) {
                    e.preventDefault();
                    Router.navigate(a.dataset.page, a.dataset.arg);
                }
            });
        },

        _sync() {
            var hash = (location.hash || '#overview').replace(/^#/, '');
            var page = hash.split('?')[0];
            Router.activate(page);
            if (hash.split('?')[1] === 'new') {
                if (page === 'publications') openPublicationModal(null);
                else if (page === 'qa') openQuestionModal(null);
            }
        },

        navigate(page, arg) {
            var next = '#' + page + (arg ? '?' + arg : '');
            if (location.hash === next) this._sync();
            else location.hash = next;
        },

        activate(page) {
            page = page || 'overview';
            $$('.page').forEach(function (p) { p.hidden = p.dataset.page !== page; });
            $$('.nav-link').forEach(function (n) {
                n.classList.toggle('active', n.dataset.page === page);
            });
            document.body.dataset.page = page;
            document.body.classList.remove('sidebar-open');
            $('#sidebarToggle').setAttribute('aria-expanded', 'false');

            var pageRenderers = {
                'overview': renderOverview,
                'publications': renderPublications,
                'publication-detail': renderPublicationDetail,
                'qa': renderQuestions,
                'qa-detail': renderQuestionDetail,
                'researchers': renderResearchers,
                'researcher-detail': renderResearcherDetail,
                'workspace': mountWorkspace,
                'python': renderPythonWorkspace,
                'profile': renderProfile
            };
            var fn = pageRenderers[page];
            if (fn) fn();
            Router.current = page;
        }
    };

    /* ============================================================
     * 概览
     * ============================================================ */
    function renderOverview() {
        var s = Store.get();
        $('#ovPublications').textContent = s.publications.length;
        $('#ovResearchers').textContent = s.researchers.length;
        $('#ovQuestions').textContent = s.questions.length;
        $('#ovQuestionsTrend').textContent = s.questions.filter(function (q) { return !q.answers || q.answers.length === 0; }).length + ' 待回答';
        $('#ovCodeRuns').textContent = (s.pages || []).length;

        var pubList = $('#ovRecentPublications');
        if (!s.publications.length) {
            pubList.innerHTML = '<li class="empty-state"><p>暂无成果。请前往「成果库」创建第一条记录。</p></li>';
        } else {
            var recent = s.publications.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); }).slice(0, 5);
            pubList.innerHTML = recent.map(publicationListItem).join('');
        }

        var qList = $('#ovRecentQuestions');
        if (!s.questions.length) {
            qList.innerHTML = '<li class="empty-state"><p>还没有问题。提问可以邀请同行交流。</p></li>';
        } else {
            var recentQ = s.questions.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); }).slice(0, 5);
            qList.innerHTML = recentQ.map(function (q) {
                return '<li class="feed-item" tabindex="0" role="link" data-action="goto" data-page="qa-detail" data-arg="' + escapeHtml(q.id) + '">' +
                    '<div class="feed-title">' + sampleLabel(q) + escapeHtml(q.title) + '</div>' +
                    '<div class="feed-meta">' + (q.answers ? q.answers.length : 0) + ' 个回答 · ' + escapeHtml(formatRelative(q.updatedAt)) + '</div>' +
                    '</li>';
            }).join('');
        }

        var strip = $('#ovResearcherStrip');
        if (!s.researchers.length) {
            strip.innerHTML = '<li class="empty-state"><p>尚无公开研究者资料。</p></li>';
        } else {
            strip.innerHTML = s.researchers.slice(0, 6).map(researcherChip).join('');
        }
    }

    function publicationListItem(p) {
        var author = (Store.get().researchers.find(function (r) { return r.id === p.authorId; }) || {}).realName || '匿名研究者';
        return '<li class="feed-item" tabindex="0" role="link" data-action="goto" data-page="publication-detail" data-arg="' + escapeHtml(p.id) + '">' +
            '<div class="feed-title">' + sampleLabel(p) + escapeHtml(p.title) + '</div>' +
            '<div class="feed-meta">' + escapeHtml(p.type === 'preprint' ? '预印本' : (p.type === 'dataset' ? '数据集' : (p.type === 'report' ? '报告' : '论文'))) +
            ' · ' + escapeHtml(author) +
            (p.year ? ' · ' + escapeHtml(String(p.year)) : '') +
            (p.doi ? ' · DOI ' + escapeHtml(p.doi) : '') +
            '</div></li>';
    }

    function researcherChip(r) {
        return '<li class="chip" tabindex="0" role="link" data-action="goto" data-page="researcher-detail" data-arg="' + escapeHtml(r.id) + '">' +
            '<span class="avatar avatar-sm">' + escapeHtml((r.avatar || r.realName || r.username || 'U').substring(0, 1)) + '</span>' +
            '<div><strong>' + sampleLabel(r) + escapeHtml(r.realName || r.username) + '</strong>' +
            '<div class="chip-meta">' + escapeHtml(r.institution || '') + '</div></div>' +
            '</li>';
    }

    /* ============================================================
     * 成果库
     * ============================================================ */
    function renderPublications() {
        var s = Store.get();
        // 年份下拉
        var yearSelect = $('#pubYearFilter');
        var years = Array.from(new Set(s.publications.map(function (p) { return p.year; }).filter(Boolean))).sort(function (a, b) { return b - a; });
        yearSelect.innerHTML = '<option value="">所有年份</option>' + years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');

        var filters = readPubFilters();
        var filtered = filterPublications(s.publications, filters);
        var grid = $('#pubGrid');
        var empty = $('#pubEmpty');

        $('#pubResultCount').textContent = filtered.length + ' 条';

        if (!filtered.length) {
            grid.innerHTML = '';
            empty.hidden = false;
            return;
        }
        empty.hidden = true;
        grid.innerHTML = filtered.map(function (p) { return publicationCard(p); }).join('');
    }

    function readPubFilters() {
        return {
            q: ($('#pubSearch').value || '').toLowerCase().trim(),
            year: $('#pubYearFilter').value,
            type: $('#pubTypeFilter').value,
            sort: $('#pubSort').value,
            onlyBookmarks: $('#pubOnlyBookmarks').checked
        };
    }

    function filterPublications(list, f) {
        var bookmarks = Store.get().bookmarks || [];
        return list.filter(function (p) {
            if (f.onlyBookmarks && bookmarks.indexOf(p.id) === -1) return false;
            if (f.year && String(p.year) !== f.year) return false;
            if (f.type && p.type !== f.type) return false;
            if (f.q) {
                var haystack = [p.title, p.abstract, p.venue].concat(p.authors || []).concat(p.keywords || []).join(' ').toLowerCase();
                if (haystack.indexOf(f.q) === -1) return false;
            }
            return true;
        }).sort(function (a, b) {
            switch (f.sort) {
                case 'year_desc': return (b.year || 0) - (a.year || 0);
                case 'year_asc': return (a.year || 0) - (b.year || 0);
                case 'title_asc': return (a.title || '').localeCompare(b.title || '');
                default: return (b.updatedAt || 0) - (a.updatedAt || 0);
            }
        });
    }

    function publicationCard(p) {
        var s = Store.get();
        var author = s.researchers.find(function (r) { return r.id === p.authorId; });
        var bookmarked = (s.bookmarks || []).indexOf(p.id) !== -1;
        var doiHtml = '';
        if (p.doi) {
            var v = validateDOI(p.doi);
            doiHtml = '<a class="doi-link" href="https://doi.org/' + encodeURI(v.normalized) + '" target="_blank" rel="noopener">DOI · ' + escapeHtml(v.normalized) + (v.ok ? '' : ' ⚠') + '</a>';
        }
        return '<article class="card pub-card">' +
            '<header class="card-header-row">' +
            '<span class="badge badge-' + escapeHtml(p.type || 'article') + '">' + escapeHtml(typeLabel(p.type)) + '</span>' +
            '<button class="btn-icon bookmark-btn' + (bookmarked ? ' active' : '') + '" data-action="toggle-bookmark" data-id="' + escapeHtml(p.id) + '" aria-label="收藏">' +
            (bookmarked ? '★' : '☆') +
            '</button>' +
            '</header>' +
            '<h3 class="card-title" tabindex="0" role="link" data-action="goto" data-page="publication-detail" data-arg="' + escapeHtml(p.id) + '">' + sampleLabel(p) + escapeHtml(p.title) + '</h3>' +
            '<div class="card-meta">' +
            (author ? escapeHtml(author.realName || author.username) : '匿名') +
            (p.year ? ' · ' + p.year : '') +
            (p.venue ? ' · ' + escapeHtml(p.venue) : '') +
            '</div>' +
            (p.abstract ? '<p class="card-abstract">' + escapeHtml(truncate(p.abstract, 140)) + '</p>' : '') +
            '<footer class="card-footer">' +
            doiHtml +
            '<span class="card-tags">' + (p.keywords || []).slice(0, 3).map(function (k) { return '<span class="tag">' + escapeHtml(k) + '</span>'; }).join('') + '</span>' +
            '</footer>' +
            '</article>';
    }

    function typeLabel(t) {
        return ({ article: '论文', preprint: '预印本', dataset: '数据集', report: '技术报告' })[t] || '论文';
    }

    function truncate(s, n) {
        s = s || '';
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }

    function renderPublicationDetail() {
        var id = (location.hash.split('?')[1] || '').trim();
        var p = (Store.get().publications || []).find(function (x) { return x.id === id; });
        var body = $('#pubDetailBody');
        if (!p) {
            body.innerHTML = '<div class="empty-state-card"><h3>未找到成果</h3><p>可能已被删除。</p></div>';
            return;
        }
        var author = (Store.get().researchers || []).find(function (r) { return r.id === p.authorId; }) || {};
        var doiHtml = '';
        if (p.doi) {
            var v = validateDOI(p.doi);
            doiHtml = '<a class="doi-link" href="https://doi.org/' + encodeURI(v.normalized) + '" target="_blank" rel="noopener">' + escapeHtml(v.normalized) + '</a>' +
                (v.ok ? '' : '<span class="warn">⚠ DOI 格式异常</span>');
        }
        body.innerHTML = '<header class="detail-header">' +
            '<span class="badge badge-' + escapeHtml(p.type || 'article') + '">' + escapeHtml(typeLabel(p.type)) + '</span>' +
            '<h2>' + sampleLabel(p) + escapeHtml(p.title) + '</h2>' +
            '<div class="detail-meta">' +
            '<span>作者：' + (p.authors || []).map(escapeHtml).join(', ') + '</span>' +
            (author.id ? ' · <a href="#" tabindex="0" role="link" data-action="goto" data-page="researcher-detail" data-arg="' + escapeHtml(author.id) + '">' + escapeHtml(author.realName || author.username) + '</a>' : '') +
            (p.venue ? ' · ' + escapeHtml(p.venue) : '') +
            (p.year ? ' · ' + p.year : '') +
            '</div></header>' +
            (p.abstract ? '<section class="detail-section"><h3>摘要</h3><p>' + escapeHtml(p.abstract) + '</p></section>' : '') +
            (doiHtml ? '<section class="detail-section"><h3>DOI</h3>' + doiHtml + '</section>' : '') +
            (p.url ? '<section class="detail-section"><h3>外链</h3><a href="' + escapeHtml(safeExternalUrl(p.url)) + '" target="_blank" rel="noopener">' + escapeHtml(safeExternalUrl(p.url)) + '</a></section>' : '') +
            (p.keywords && p.keywords.length ? '<section class="detail-section detail-tags">' + p.keywords.map(function (k) { return '<span class="tag">' + escapeHtml(k) + '</span>'; }).join('') + '</section>' : '') +
            '<footer class="detail-actions">' +
            '<button class="btn btn-text" data-action="edit-publication" data-id="' + escapeHtml(p.id) + '">编辑</button>' +
            '<button class="btn btn-danger" data-action="delete-publication" data-id="' + escapeHtml(p.id) + '">删除</button>' +
            '</footer>';
    }

    /* ============================================================
     * 问答
     * ============================================================ */
    function renderQuestions() {
        var s = Store.get();
        var filters = { q: ($('#qaSearch').value || '').toLowerCase().trim(), sort: $('#qaSort').value };
        var list = (s.questions || []).filter(function (q) {
            if (filters.q) {
                var hay = [q.title, q.body].concat(q.tags || []).join(' ').toLowerCase();
                if (hay.indexOf(filters.q) === -1) return false;
            }
            return true;
        });
        list.sort(function (a, b) {
            switch (filters.sort) {
                case 'created_desc': return (b.createdAt || 0) - (a.createdAt || 0);
                case 'votes_desc': return scoreOf(b) - scoreOf(a);
                case 'unanswered':
                    return ((a.answers && a.answers.length ? 1 : 0) - (b.answers && b.answers.length ? 1 : 0)) || ((b.updatedAt || 0) - (a.updatedAt || 0));
                default: return (b.updatedAt || 0) - (a.updatedAt || 0);
            }
        });
        var ul = $('#qaList');
        var empty = $('#qaEmpty');
        $('#qaResultCount').textContent = list.length + ' 条';
        if (!list.length) { ul.innerHTML = ''; empty.hidden = false; return; }
        empty.hidden = true;
        ul.innerHTML = list.map(questionItem).join('');
    }

    function scoreOf(q) {
        var sum = 0;
        (q.answers || []).forEach(function (a) { sum += (a.votes || 0); });
        return sum;
    }

    function questionItem(q) {
        var author = (Store.get().researchers.find(function (r) { return r.id === q.authorId; }) || {});
        var ansCount = (q.answers || []).length;
        return '<article class="card qa-item" tabindex="0" role="link" data-action="goto" data-page="qa-detail" data-arg="' + escapeHtml(q.id) + '">' +
            '<div class="qa-stats">' +
            '<span class="qa-stat"><strong>' + ansCount + '</strong><span>回答</span></span>' +
            '<span class="qa-stat"><strong>' + scoreOf(q) + '</strong><span>票数</span></span>' +
            '</div>' +
            '<div class="qa-body">' +
            '<h3 class="card-title">' + sampleLabel(q) + escapeHtml(q.title) + '</h3>' +
            '<div class="card-meta">' + escapeHtml(author.realName || author.username || '匿名') + ' · ' + escapeHtml(formatRelative(q.updatedAt)) + (ansCount === 0 ? ' · <span class="warn">待回答</span>' : '') + '</div>' +
            '<p class="card-abstract">' + escapeHtml(truncate(q.body, 160)) + '</p>' +
            '<div class="card-tags">' + (q.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
            '</div>' +
            '</article>';
    }

    function renderQuestionDetail() {
        var id = (location.hash.split('?')[1] || '').trim();
        var q = (Store.get().questions || []).find(function (x) { return x.id === id; });
        var body = $('#qaDetailBody');
        if (!q) { body.innerHTML = '<div class="empty-state-card"><h3>未找到问题</h3></div>'; return; }
        var author = (Store.get().researchers.find(function (r) { return r.id === q.authorId; }) || {});
        var me = Store.getUser();
        var voted = !!(q.voters && me && q.voters[me.id]);
        body.innerHTML = '<header class="detail-header">' +
            '<h2>' + sampleLabel(q) + escapeHtml(q.title) + '</h2>' +
            '<div class="detail-meta">提问者：' + escapeHtml(author.realName || author.username || '匿名') + ' · ' + escapeHtml(formatRelative(q.createdAt)) + '</div>' +
            '<div class="card-tags">' + (q.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
            '</header>' +
            '<section class="detail-section"><p>' + escapeHtml(q.body) + '</p></section>' +
            '<section class="detail-section">' +
            '<div class="answers-header"><h3>' + (q.answers || []).length + ' 个回答</h3>' +
            '<button class="btn btn-primary" data-action="answer-question" data-id="' + escapeHtml(q.id) + '">+ 写回答</button></div>' +
            (q.answers || []).map(function (a) { return answerItem(q, a); }).join('') +
            '</section>' +
            '<footer class="detail-actions">' +
            '<button class="btn btn-text" data-action="vote-question" data-id="' + escapeHtml(q.id) + '"' + (voted ? ' disabled' : '') + '>' + (voted ? '已点赞' : '👍 点赞问题') + '</button>' +
            '<button class="btn btn-danger" data-action="delete-question" data-id="' + escapeHtml(q.id) + '">删除问题</button>' +
            '</footer>';
    }

    function answerItem(q, a) {
        var author = (Store.get().researchers.find(function (r) { return r.id === a.authorId; }) || {});
        return '<article class="answer-item">' +
            '<div class="answer-vote">' +
            '<button class="btn-icon" data-action="vote-answer" data-q="' + escapeHtml(q.id) + '" data-a="' + escapeHtml(a.id) + '" aria-label="赞同">▲</button>' +
            '<span class="vote-count">' + (a.votes || 0) + '</span>' +
            '</div>' +
            '<div class="answer-body">' +
            '<div class="detail-meta">' + escapeHtml(author.realName || author.username || '匿名') + ' · ' + escapeHtml(formatRelative(a.createdAt)) + '</div>' +
            '<p>' + escapeHtml(a.body) + '</p>' +
            '</div>' +
            '</article>';
    }

    /* ============================================================
     * 研究者
     * ============================================================ */
    function renderResearchers() {
        var s = Store.get();
        var q = ($('#resSearch').value || '').toLowerCase().trim();
        var filter = $('#resFilter').value;
        var me = Store.getUser();
        var following = s.following || [];
        var list = s.researchers.filter(function (r) {
            if (filter === 'following' && (!me || following.indexOf(r.id) === -1)) return false;
            if (q) {
                var hay = [r.realName, r.username, r.institution, r.research, r.bio].join(' ').toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
        var grid = $('#resGrid');
        var empty = $('#resEmpty');
        $('#resResultCount').textContent = list.length + ' 位';
        if (!list.length) { grid.innerHTML = ''; empty.hidden = false; return; }
        empty.hidden = true;
        grid.innerHTML = list.map(function (r) {
            var isFollowing = following.indexOf(r.id) !== -1;
            return '<article class="card researcher-card">' +
                '<div class="researcher-head">' +
                '<span class="avatar avatar-md">' + escapeHtml((r.avatar || r.realName || 'U').substring(0, 1)) + '</span>' +
                '<div><h3 class="card-title" tabindex="0" role="link" data-action="goto" data-page="researcher-detail" data-arg="' + escapeHtml(r.id) + '">' + sampleLabel(r) + escapeHtml(r.realName || r.username) + '</h3>' +
                '<div class="card-meta">' + escapeHtml(r.institution || '') + (r.title ? ' · ' + escapeHtml(r.title) : '') + '</div></div>' +
                '</div>' +
                (r.research ? '<p class="card-abstract">' + escapeHtml(r.research) + '</p>' : '') +
                '<footer class="card-footer">' +
                (r.orcid ? '<span class="tag">ORCID ' + escapeHtml(r.orcid) + '</span>' : '') +
                (me && me.id !== r.id ? '<button class="btn btn-text btn-sm" data-action="toggle-follow" data-id="' + escapeHtml(r.id) + '">' + (isFollowing ? '已关注' : '+ 关注') + '</button>' : '') +
                '</footer>' +
                '</article>';
        }).join('');
    }

    function renderResearcherDetail() {
        var id = (location.hash.split('?')[1] || '').trim();
        var r = (Store.get().researchers || []).find(function (x) { return String(x.id) === id; });
        var body = $('#resDetailBody');
        if (!r) { body.innerHTML = '<div class="empty-state-card"><h3>未找到研究者</h3></div>'; return; }
        var me = Store.getUser();
        var isFollowing = me && (Store.get().following || []).indexOf(r.id) !== -1;
        var ownPubs = (Store.get().publications || []).filter(function (p) { return p.authorId === r.id; });
        var ownQs = (Store.get().questions || []).filter(function (q) { return q.authorId === r.id; });
        body.innerHTML = '<header class="detail-header researcher-detail-head">' +
            '<span class="avatar avatar-lg">' + escapeHtml((r.avatar || r.realName || 'U').substring(0, 1)) + '</span>' +
            '<div><h2>' + sampleLabel(r) + escapeHtml(r.realName || r.username) + '</h2>' +
            '<div class="detail-meta">' + escapeHtml(r.institution || '') + (r.title ? ' · ' + escapeHtml(r.title) : '') + '</div>' +
            '<div class="detail-actions-inline">' +
            (me && me.id !== r.id ? '<button class="btn btn-primary btn-sm" data-action="toggle-follow" data-id="' + escapeHtml(r.id) + '">' + (isFollowing ? '已关注 · 取消' : '+ 关注') + '</button>' : '') +
            (me && me.id === r.id ? '<a class="btn btn-text btn-sm" href="#" tabindex="0" role="link" data-action="goto" data-page="profile">编辑我的资料</a>' : '') +
            '</div></div>' +
            '</header>' +
            (r.research ? '<section class="detail-section"><h3>研究方向</h3><p>' + escapeHtml(r.research) + '</p></section>' : '') +
            (r.bio ? '<section class="detail-section"><h3>个人简介</h3><p>' + escapeHtml(r.bio) + '</p></section>' : '') +
            '<section class="detail-section"><h3>学术身份</h3>' +
            '<ul class="kv">' +
            (r.email ? '<li><span>邮箱</span><a href="mailto:' + escapeHtml(r.email) + '">' + escapeHtml(r.email) + '</a></li>' : '') +
            (r.orcid ? '<li><span>ORCID</span>' + escapeHtml(r.orcid) + '</li>' : '') +
            (r.website ? '<li><span>主页</span><a href="' + escapeHtml(safeExternalUrl(r.website)) + '" target="_blank" rel="noopener">' + escapeHtml(safeExternalUrl(r.website)) + '</a></li>' : '') +
            '</ul></section>' +
            '<section class="detail-section"><h3>成果（' + ownPubs.length + '）</h3>' +
            (ownPubs.length ? '<ul class="feed-list">' + ownPubs.map(publicationListItem).join('') + '</ul>' : '<p class="muted">暂无成果。</p>') +
            '</section>' +
            '<section class="detail-section"><h3>提问（' + ownQs.length + '）</h3>' +
            (ownQs.length ? '<ul class="feed-list">' + ownQs.map(questionItem).join('') + '</ul>' : '<p class="muted">暂无提问。</p>') +
            '</section>';
    }

    /* ============================================================
     * 知识空间（workspace.js 接入）
     * ============================================================ */
    var workspaceMounted = false;
    function mountWorkspace() {
        var root = document.getElementById('workspace-root');
        if (!root) return;
        if (workspaceMounted && window.MeteoWorkspace && typeof window.MeteoWorkspace.mount === 'function') {
            window.MeteoWorkspace.mount(root);
            return;
        }
        root.innerHTML = '<div class="empty-state-card"><h3>正在加载知识空间…</h3><p>正在准备研究笔记与项目。</p></div>';
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (window.MeteoWorkspace && typeof window.MeteoWorkspace.mount === 'function') {
                clearInterval(iv);
                workspaceMounted = true;
                window.MeteoWorkspace.mount(root);
            } else if (tries > 60) {
                clearInterval(iv);
                root.innerHTML = '<div class="empty-state-card"><h3>知识空间模块未加载</h3><p>请刷新页面重试，或检查本地服务是否正常运行。</p></div>';
            }
        }, 100);
    }

    /* ============================================================
     * Python 工作区（本地诚实执行）
     * ============================================================ */
    function renderPythonWorkspace() {
        // 仅做一次性绑定
        if (renderPythonWorkspace._bound) return;
        renderPythonWorkspace._bound = true;

        $$('[data-example]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = btn.dataset.example;
                var code = PYTHON_EXAMPLES[key];
                if (code) {
                    $('#pyEditor').value = code;
                    showToast('已加载示例：' + key, 'info');
                }
            });
        });

        document.addEventListener('click', function (e) {
            var act = e.target.closest('[data-action]');
            if (!act) return;
            if (act.dataset.action === 'py-run') runPythonLocal();
            if (act.dataset.action === 'py-download') {
                const blob = new Blob([$('#pyEditor').value], { type: 'text/x-python;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = 'meteohub.py'; link.click();
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            }
            if (act.dataset.action === 'py-clear') {
                $('#pyEditor').value = '';
                $('#pyOutput').innerHTML = '<span class="output-placeholder">当前版本未集成 Python 运行时。可编辑示例并下载 .py 文件。</span>';
                $('#pyExecutionTime').textContent = '';
            }
        });
    }

    function runPythonLocal() {
        $('#pyOutput').textContent = '当前版本未集成 Python 运行时，不能在此执行代码。请下载 .py 文件后在自己的 Python 或 Jupyter 环境中运行。';
    }

    /* ============================================================
     * 个人资料
     * ============================================================ */
    function renderProfile() {
        var me = Store.getUser();
        var card = $('#profileCard');
        if (!me) {
            card.innerHTML = '<div class="empty-state-card"><h3>请先登录</h3><p>登录后可编辑个人资料并关注其他研究者。</p></div>';
            return;
        }
        var s = Store.get();
        var mine = s.researchers.find(function (r) { return r.id === me.id; }) || {};
        $('#profileAvatar').textContent = (mine.avatar || me.username || 'U').substring(0, 1).toUpperCase();
        $('#profileRealName').value = mine.realName || '';
        $('#profileGender').value = mine.gender || '';
        $('#profileUsername').value = me.username || '';
        $('#profileEmail').value = me.email || '';
        $('#profileInstitution').value = mine.institution || '';
        $('#profileTitle').value = mine.title || '';
        $('#profileResearch').value = mine.research || '';
        $('#profileBio').value = mine.bio || '';
        $('#profileWebsite').value = mine.website || '';
        $('#profileOrcid').value = mine.orcid || '';
        var own = s.publications.filter(function (p) { return p.authorId === me.id; });
        $('#profilePubCount').textContent = own.length;
        $('#profileFollowingCount').textContent = (s.following || []).length;
        $('#profileBookmarkCount').textContent = (s.bookmarks || []).length;
        var following = (s.following || []).map(function (id) { return s.researchers.find(function (r) { return String(r.id) === id; }); }).filter(Boolean);
        var strip = $('#profileFollowingStrip');
        if (!following.length) {
            strip.innerHTML = '<li class="empty-state"><p>登录后即可关注其他研究者。</p></li>';
        } else {
            strip.innerHTML = following.map(researcherChip).join('');
        }
    }

    /* ============================================================
     * 模态 / 表单
     * ============================================================ */
    // Track the element that opened the most-recently-opened modal so we can
    // restore focus on close (a11y: keyboard users shouldn't lose their place).
    var _lastFocusedBeforeModal = null;

    function _focusableIn(root) {
        // Standard focusable set per WAI-ARIA Authoring Practices.
        var sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]),'
            + ' textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return Array.prototype.slice.call(root.querySelectorAll(sel));
    }

    function _trapModalTab(e) {
        if (e.key !== 'Tab') return;
        var m = e.currentTarget;
        if (!m.classList.contains('active')) return;
        var focusables = _focusableIn(m).filter(function (el) {
            return el.offsetParent !== null || el === document.activeElement;
        });
        if (focusables.length === 0) {
            e.preventDefault();
            return;
        }
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    function openModal(id) {
        var m = document.getElementById(id);
        if (!m) return;
        // Remember the trigger so closeModal can return focus there.
        _lastFocusedBeforeModal = document.activeElement;
        m.classList.add('active');
        m.setAttribute('aria-hidden', 'false');
        var firstInput = m.querySelector('input:not([type=hidden]), textarea, select');
        if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);
        m.addEventListener('keydown', _trapModalTab);
    }
    function closeModal(id) {
        var m = document.getElementById(id);
        if (!m) return;
        m.removeEventListener('keydown', _trapModalTab);
        m.classList.remove('active');
        m.setAttribute('aria-hidden', 'true');
        // Restore focus to the element that opened the modal (a11y).
        if (_lastFocusedBeforeModal && typeof _lastFocusedBeforeModal.focus === 'function') {
            setTimeout(function () {
                try { _lastFocusedBeforeModal.focus(); } catch (_) {}
            }, 0);
        }
        _lastFocusedBeforeModal = null;
    }

    function openPublicationModal(id) {
        var form = $('#publicationForm');
        form.reset();
        form.elements.namedItem('id').value = '';
        if (id) {
            var p = (Store.get().publications || []).find(function (x) { return x.id === id; });
            if (!p) { showToast('成果不存在', 'error'); return; }
            form.elements.namedItem('id').value = p.id;
            form.elements.namedItem('title').value = p.title || '';
            form.elements.namedItem('type').value = p.type || 'article';
            form.elements.namedItem('year').value = p.year || '';
            form.elements.namedItem('authors').value = (p.authors || []).join(', ');
            form.elements.namedItem('venue').value = p.venue || '';
            form.elements.namedItem('doi').value = p.doi || '';
            form.elements.namedItem('keywords').value = (p.keywords || []).join(', ');
            form.elements.namedItem('abstract').value = p.abstract || '';
            form.elements.namedItem('url').value = p.url || '';
            $('#pubModalTitle').textContent = '编辑成果';
        } else {
            $('#pubModalTitle').textContent = '新建成果';
        }
        updateDoiHint();
        openModal('publicationModal');
    }

    function updateDoiHint() {
        var doi = $('#publicationForm').elements.namedItem('doi').value || '';
        var hint = $('#pubDoiHint');
        if (!doi.trim()) { hint.textContent = 'DOI 必须形如 10.xxxx/yyyy（留空可跳过）'; hint.className = 'form-hint'; return; }
        var v = validateDOI(doi);
        hint.textContent = v.ok ? '✓ DOI 格式正确' : '⚠ DOI 格式不规范（示例：10.5194/acp-23-12345-2023）';
        hint.className = 'form-hint ' + (v.ok ? 'ok' : 'warn');
    }

    async function savePublicationFromForm(e) {
        e.preventDefault();
        try {
        var f = e.target;
        var id = f.elements.namedItem('id').value || uid('pub');
        var doiV = validateDOI(f.elements.namedItem('doi').value || '');
        if ((f.elements.namedItem('doi').value || '').trim() && !doiV.ok) {
            showToast('DOI 格式不正确，请修正或留空。', 'error');
            return;
        }
        var pub = {
            id: id,
            title: f.elements.namedItem('title').value.trim(),
            type: f.elements.namedItem('type').value,
            year: f.elements.namedItem('year').value ? parseInt(f.elements.namedItem('year').value, 10) : null,
            authors: (f.elements.namedItem('authors').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
            venue: f.elements.namedItem('venue').value.trim(),
            doi: doiV.normalized,
            keywords: (f.elements.namedItem('keywords').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
            abstract: f.elements.namedItem('abstract').value.trim(),
            url: f.elements.namedItem('url').value.trim(),
            authorId: Store.getUser() ? Store.getUser().id : 'anonymous',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        var existing = (Store.get().publications || []).find(function (p) { return p.id === id; });
        if (existing) {
            pub.createdAt = existing.createdAt;
            pub.authorId = existing.authorId;
        }
        await Store.update(function (state) {
            var idx = state.publications.findIndex(function (p) { return p.id === id; });
            if (idx === -1) state.publications.unshift(pub);
            else state.publications[idx] = pub;
        });
        closeModal('publicationModal');
        showToast(existing ? '成果已更新' : '成果已创建', 'success');
        } catch (error) { showToast(error.message || '保存失败，请重试。', 'error'); }
    }

    function openQuestionModal(id) {
        var form = $('#questionForm');
        form.reset();
        form.elements.namedItem('id').value = '';
        if (id) {
            var q = (Store.get().questions || []).find(function (x) { return x.id === id; });
            if (!q) return;
            form.elements.namedItem('id').value = q.id;
            form.elements.namedItem('title').value = q.title;
            form.elements.namedItem('tags').value = (q.tags || []).join(', ');
            form.elements.namedItem('body').value = q.body;
            $('#qModalTitle').textContent = '编辑问题';
        } else {
            $('#qModalTitle').textContent = '提问';
        }
        openModal('questionModal');
    }

    async function saveQuestionFromForm(e) {
        e.preventDefault();
        try {
        var f = e.target;
        var id = f.elements.namedItem('id').value || uid('q');
        var q = {
            id: id,
            title: f.elements.namedItem('title').value.trim(),
            tags: (f.elements.namedItem('tags').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
            body: f.elements.namedItem('body').value.trim(),
            authorId: Store.getUser() ? Store.getUser().id : 'anonymous',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            answers: (Store.get().questions.find(function (x) { return x.id === id; }) || {}).answers || [],
            voters: (Store.get().questions.find(function (x) { return x.id === id; }) || {}).voters || {}
        };
        await Store.update(function (state) {
            var idx = state.questions.findIndex(function (x) { return x.id === id; });
            if (idx === -1) state.questions.unshift(q);
            else state.questions[idx] = Object.assign({}, state.questions[idx], q);
        });
        closeModal('questionModal');
        showToast('问题已发布', 'success');
        } catch (error) { showToast(error.message || '保存失败，请重试。', 'error'); }
    }

    function openAnswerModal(qid) {
        var form = $('#answerForm');
        form.reset();
        form.elements.namedItem('questionId').value = qid;
        openModal('answerModal');
    }

    async function saveAnswerFromForm(e) {
        e.preventDefault();
        try {
        var f = e.target;
        var qid = f.elements.namedItem('questionId').value;
        if (!Store.getUser()) { showToast('请先登录后再回答', 'error'); return; }
        await Store.update(function (state) {
            var q = state.questions.find(function (x) { return x.id === qid; });
            if (!q) return;
            q.answers = q.answers || [];
            q.answers.push({
                id: uid('a'),
                questionId: qid,
                authorId: Store.getUser().id,
                body: f.elements.namedItem('body').value.trim(),
                createdAt: Date.now(),
                votes: 0
            });
            q.updatedAt = Date.now();
        });
        closeModal('answerModal');
        showToast('回答已提交', 'success');
        } catch (error) { showToast(error.message || '保存失败，请重试。', 'error'); }
    }

    function confirmAction(message, onOk) {
        $('#confirmMessage').textContent = message;
        var btn = $('#confirmOk');
        var handler = function () {
            btn.removeEventListener('click', handler);
            closeModal('confirmModal');
            Promise.resolve().then(onOk).catch(function (error) { showToast(error.message || '操作失败，请重试。', 'error'); });
        };
        if (btn._confirmHandler) btn.removeEventListener('click', btn._confirmHandler);
        btn._confirmHandler = handler;
        btn.addEventListener('click', handler);
        openModal('confirmModal');
    }

    /* ============================================================
     * 全局搜索
     * ============================================================ */
    function setupGlobalSearch() {
        var input = $('#globalSearchInput');
        var box = $('#globalSearchResults');
        var update = debounce(function () {
            var q = (input.value || '').trim().toLowerCase();
            if (!q) { box.classList.remove('active'); box.innerHTML = ''; return; }
            var s = Store.get();
            var pub = s.publications.filter(function (p) { return (p.title + ' ' + (p.abstract || '') + ' ' + (p.keywords || []).join(' ')).toLowerCase().indexOf(q) !== -1; }).slice(0, 5);
            var qs = s.questions.filter(function (x) { return (x.title + ' ' + (x.tags || []).join(' ')).toLowerCase().indexOf(q) !== -1; }).slice(0, 5);
            var res = s.researchers.filter(function (r) { return (r.realName + ' ' + r.username + ' ' + r.institution + ' ' + r.research).toLowerCase().indexOf(q) !== -1; }).slice(0, 5);
            var html = '';
            if (pub.length) html += '<div class="sr-group"><h4>成果</h4>' + pub.map(function (p) { return '<a href="#" tabindex="0" role="link" data-action="goto" data-page="publication-detail" data-arg="' + escapeHtml(p.id) + '">' + sampleLabel(p) + escapeHtml(p.title) + '</a>'; }).join('') + '</div>';
            if (qs.length) html += '<div class="sr-group"><h4>问答</h4>' + qs.map(function (x) { return '<a href="#" tabindex="0" role="link" data-action="goto" data-page="qa-detail" data-arg="' + escapeHtml(x.id) + '">' + escapeHtml(x.title) + '</a>'; }).join('') + '</div>';
            if (res.length) html += '<div class="sr-group"><h4>研究者</h4>' + res.map(function (r) { return '<a href="#" tabindex="0" role="link" data-action="goto" data-page="researcher-detail" data-arg="' + escapeHtml(r.id) + '">' + sampleLabel(r) + escapeHtml(r.realName || r.username) + '<small>' + escapeHtml(r.institution || '') + '</small></a>'; }).join('') + '</div>';
            if (!html) html = '<div class="sr-empty">没有匹配结果</div>';
            box.innerHTML = html;
            box.classList.add('active');
        }, 200);
        input.addEventListener('input', update);
        input.addEventListener('focus', update);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                var first = box.querySelector('a');
                if (first) { first.click(); input.value = ''; box.classList.remove('active'); }
            } else if (e.key === 'Escape') {
                box.classList.remove('active');
            }
        });
    }

    /* ============================================================
     * 键盘快捷键：G 字母跳转；/ 聚焦搜索
     * ============================================================ */
    function setupKeyboard() {
        var gPending = false;
        var gTimer = null;
        document.addEventListener('keydown', function (e) {
            var tag = (e.target.tagName || '').toLowerCase();
            if (e.target.isContentEditable || e.target.closest('[contenteditable="true"]') || ['input', 'textarea', 'select'].indexOf(tag) !== -1) {
                if (e.key === 'Escape') e.target.blur();
                return;
            }
            if (e.key === '/') {
                e.preventDefault();
                $('#globalSearchInput').focus();
                return;
            }
            if (gPending) {
                clearTimeout(gTimer);
                gPending = false;
                var map = { o: 'overview', p: 'publications', q: 'qa', r: 'researchers', k: 'workspace', y: 'python', m: 'profile' };
                var p = map[e.key.toLowerCase()];
                if (p) Router.navigate(p);
                return;
            }
            if (e.key.toLowerCase() === 'g') {
                gPending = true;
                gTimer = setTimeout(function () { gPending = false; }, 800);
            }
        });
    }

    /* ============================================================
     * 登录/注册表单处理
     * ============================================================ */
    function setupAuthForms() {
        $('#loginForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var data = new FormData(e.target);
            var username = data.get('username').toString().trim();
            var password = data.get('password').toString();
            var hint = $('#loginHint');
            hint.textContent = '登录中...';
            hint.className = 'form-hint';
            try {
                await Store.login(username, password);
                closeModal('loginModal');
                showToast('登录成功', 'success');
                Router._sync();
            } catch (err) {
                hint.textContent = err.message || '登录失败';
                hint.className = 'form-hint warn';
            }
        });

        $('#registerForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var data = new FormData(e.target);
            var pwd = data.get('password').toString();
            var pwd2 = data.get('confirmPassword').toString();
            if (pwd !== pwd2) { showToast('两次密码不一致', 'error'); return; }
            var username = data.get('username').toString().trim();
            if (!USERNAME_REGEX.test(username)) { showToast('用户名仅限字母数字下划线 3-24 位', 'error'); return; }
            var payload = {
                username: username,
                password: pwd,
                realName: data.get('realName').toString().trim(),
                email: data.get('email').toString().trim(),
                institution: data.get('institution').toString().trim(),
                research: data.get('research').toString().trim()
            };
            try {
                await Store.register({ username: username, password: pwd });
                await Store.update(function (state) {
                    var me = Store.getUser();
                    var profile = { id: me.id, username: me.username, realName: payload.realName,
                        email: payload.email, institution: payload.institution, research: payload.research };
                    state.profile = profile;
                    state.researchers.push(profile);
                });
                closeModal('registerModal');
                showToast('注册成功，欢迎加入 MeteoHub', 'success');
                Router._sync();
            } catch (err) {
                showToast(err.message || '注册失败', 'error');
            }
        });
    }

    function setupProfileForm() {
        $('#profileForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            try {
            var me = Store.getUser();
            if (!me) { showToast('请先登录', 'error'); return; }
            var orcid = $('#profileOrcid').value.trim();
            if (orcid && !validateORCID(orcid)) { showToast('ORCID 格式不正确', 'error'); return; }
            var patch = {
                realName: $('#profileRealName').value.trim(),
                gender: $('#profileGender').value,
                institution: $('#profileInstitution').value.trim(),
                title: $('#profileTitle').value.trim(),
                research: $('#profileResearch').value.trim(),
                bio: $('#profileBio').value.trim(),
                website: $('#profileWebsite').value.trim(),
                orcid: orcid
            };
            await Store.update(function (state) {
                var idx = state.researchers.findIndex(function (r) { return r.id === me.id; });
                if (idx === -1) {
                    state.researchers.push(Object.assign({ id: me.id }, patch));
                } else {
                    state.researchers[idx] = Object.assign({}, state.researchers[idx], patch);
                }
                state.profile = patch;

            });
            Object.assign(me, patch);
            Store._renderUserUI();
            showToast('资料已保存', 'success');
            renderProfile();
            } catch (error) { showToast(error.message || '保存失败，请重试。', 'error'); }
        });
    }

    /* ============================================================
     * 通用点击代理
     * ============================================================ */
    function setupActionDelegates() {
        document.addEventListener('click', async function (e) {
            var el = e.target.closest('[data-action]');
            if (!el) return;
            var act = el.dataset.action;
            try {
            if (act === 'open-login') openModal('loginModal');
            else if (act === 'open-register') openModal('registerModal');
            else if (act === 'add-researcher') { $('#researcherForm').reset(); openModal('researcherModal'); }
            else if (act === 'switch-modal') { closeModal(el.dataset.from); setTimeout(function () { openModal(el.dataset.to); }, 150); }
            else if (act === 'toggle-bookmark') {
                var id = el.dataset.id;
                await Store.update(function (s) {
                    s.bookmarks = s.bookmarks || [];
                    var i = s.bookmarks.indexOf(id);
                    if (i === -1) s.bookmarks.push(id); else s.bookmarks.splice(i, 1);
                });
                renderPublications();
            }
            else if (act === 'edit-publication') openPublicationModal(el.dataset.id);
            else if (act === 'delete-publication') {
                confirmAction('确定要删除该成果吗？此操作不可撤销。', async function () {
                    await Store.update(function (s) {
                        s.publications = s.publications.filter(function (p) { return p.id !== el.dataset.id; });
                        s.bookmarks = (s.bookmarks || []).filter(function (b) { return b !== el.dataset.id; });
                    });
                    showToast('成果已删除', 'success');
                    Router.navigate('publications');
                });
            }
            else if (act === 'answer-question') openAnswerModal(el.dataset.id);
            else if (act === 'delete-question') {
                confirmAction('确定要删除该问题及其全部回答吗？', async function () {
                    await Store.update(function (s) {
                        s.questions = s.questions.filter(function (q) { return q.id !== el.dataset.id; });
                    });
                    showToast('问题已删除', 'success');
                    Router.navigate('qa');
                });
            }
            else if (act === 'vote-question') {
                var me = Store.getUser();
                if (!me) { showToast('请先登录', 'error'); return; }
                await Store.update(function (s) {
                    var q = s.questions.find(function (x) { return x.id === el.dataset.id; });
                    if (!q) return;
                    q.voters = q.voters || {};
                    if (q.voters[me.id]) return;
                    q.voters[me.id] = 1;
                    // 通过给最新回答加票来反映"问题点赞"
                    if (q.answers && q.answers.length) q.answers[q.answers.length - 1].votes = (q.answers[q.answers.length - 1].votes || 0) + 1;
                });
                renderQuestionDetail();
            }
            else if (act === 'vote-answer') {
                var me2 = Store.getUser();
                if (!me2) { showToast('请先登录', 'error'); return; }
                await Store.update(function (s) {
                    var q = s.questions.find(function (x) { return x.id === el.dataset.q; });
                    if (!q) return;
                    var a = (q.answers || []).find(function (x) { return x.id === el.dataset.a; });
                    if (a) a.votes = (a.votes || 0) + 1;
                });
                renderQuestionDetail();
            }
            else if (act === 'toggle-follow') {
                var me3 = Store.getUser();
                if (!me3) { showToast('请先登录', 'error'); return; }
                await Store.update(function (s) {
                    s.following = s.following || [];
                    var i = s.following.indexOf(el.dataset.id);
                    if (i === -1) s.following.push(el.dataset.id); else s.following.splice(i, 1);
                });
                renderResearchers();
                renderResearcherDetail();
            }
            else if (act === 'logout') {
                confirmAction('确定要退出登录吗？未保存的本地缓存将保留在浏览器中。', async function () {
                    await Store.logout();
                    showToast('已退出登录', 'info');
                    Router.navigate('overview');
                });
            }
            } catch (error) { showToast(error.message || '操作失败，请重试。', 'error'); }
        });

        $('#researcherForm').addEventListener('submit', async function (event) {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const entry = { id: uid('researcher'), realName: data.get('realName').trim(),
                institution: data.get('institution').trim(), research: data.get('research').trim(),
                website: safeExternalUrl(data.get('website')), createdAt: Date.now() };
            try {
                await Store.update(function (state) { state.researchers.push(entry); });
                closeModal('researcherModal');
                showToast('研究者资料已添加到个人目录', 'success');
            } catch (error) { showToast(error.message, 'error'); }
        });

        document.addEventListener('keydown', function (event) {
            const modal = document.querySelector('.modal.active');
            if (modal) {
                if (event.key === 'Escape') { closeModal(modal.id); return; }
                if (event.key === 'Tab') {
                    const focusable = Array.from(modal.querySelectorAll('button, input, select, textarea, a[href]')).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
                    const first = focusable[0], last = focusable[focusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }
                return;
            }
            const target = event.target.closest('[data-action="goto"]');
            if (target && !['A', 'BUTTON'].includes(target.tagName) && ['Enter', ' '].includes(event.key)) {
                event.preventDefault(); target.click();
            }
        });

        // 模态关闭
        document.addEventListener('click', function (e) {
            var closer = e.target.closest('[data-modal-close]');
            if (closer) closeModal(closer.dataset.modalClose);
        });

        // 监听 hashchange
        window.addEventListener('hashchange', Router._sync);

        // 表单
        $('#publicationForm').addEventListener('submit', savePublicationFromForm);
        $('#questionForm').addEventListener('submit', saveQuestionFromForm);
        $('#answerForm').addEventListener('submit', saveAnswerFromForm);
        $('#publicationForm').elements.namedItem('doi').addEventListener('input', updateDoiHint);

        // 工具栏过滤（事件代理）
        ['pubSearch', 'pubYearFilter', 'pubTypeFilter', 'pubSort'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', debounce(renderPublications, 200));
            if (el && el.tagName === 'SELECT') el.addEventListener('change', renderPublications);
        });
        $('#pubOnlyBookmarks').addEventListener('change', renderPublications);
        ['qaSearch', 'qaSort'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', debounce(renderQuestions, 200));
            if (el && el.tagName === 'SELECT') el.addEventListener('change', renderQuestions);
        });
        ['resSearch', 'resFilter'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', debounce(renderResearchers, 200));
            if (el && el.tagName === 'SELECT') el.addEventListener('change', renderResearchers);
        });

        // 用户菜单下拉
        $('#userAvatarBtn').addEventListener('click', function (e) {
            e.stopPropagation();
            $('#userDropdown').classList.toggle('active');
            $('#userAvatarBtn').setAttribute('aria-expanded', $('#userDropdown').classList.contains('active'));
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.sidebar') && !e.target.closest('#sidebarToggle')) document.body.classList.remove('sidebar-open');
            if (!e.target.closest('.user-menu')) $('#userDropdown').classList.remove('active');
        });

        // 侧栏折叠
        $('#sidebarToggle').addEventListener('click', function () {
            if (window.matchMedia('(max-width: 960px)').matches) {
                document.body.classList.toggle('sidebar-open');
                this.setAttribute('aria-expanded', String(document.body.classList.contains('sidebar-open')));
            } else document.body.classList.toggle('sidebar-collapsed');
        });

        // 监听 state 变化
        window.addEventListener('meteohub:state-changed', function () {
            var page = document.body.dataset.page;
            if (page === 'overview') renderOverview();
            else if (page === 'publications') renderPublications();
            else if (page === 'qa') renderQuestions();
            else if (page === 'researchers') renderResearchers();
            else if (page === 'profile') renderProfile();
            else if (page === 'publication-detail') renderPublicationDetail();
            else if (page === 'qa-detail') renderQuestionDetail();
            else if (page === 'researcher-detail') renderResearcherDetail();
        });
    }

    /* ============================================================
     * 启动
     * ============================================================ */
    document.addEventListener('DOMContentLoaded', function () {
        Router.init();
        setupGlobalSearch();
        setupKeyboard();
        setupAuthForms();
        setupProfileForm();
        setupActionDelegates();
        Store.init().then(function () {
            Router._sync();
            // 兼容性处理：若 hash 带 ?arg= 触发新建模态
            var parts = (location.hash || '').split('?');
            if (parts[1] === 'new') {
                if (parts[0] === '#publications') openPublicationModal(null);
                else if (parts[0] === '#qa') openQuestionModal(null);
            }
        });
    });
})();