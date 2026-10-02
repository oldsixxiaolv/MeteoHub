/* =============================================================
 * MeteoHub Workspace — FlowUs 风格知识空间 + 项目多视图
 * Public API: window.MeteoWorkspace.mount(root)
 * Store contract: window.MeteoHubStore.get() -> state
 *                 window.MeteoHubStore.update(mutator) -> Promise<void>
 * The module defines window.MeteoHubStore if it does not exist,
 * so it is self-contained and works in any host page that calls
 * mount(). It never reads or writes host DOM outside the supplied
 * root, except appending its own modal/toast portals to root.
 * ============================================================= */
(function () {
    'use strict';

    /* ------------------------- helpers ------------------------- */
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function uid() {
        return 'ws_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
    }

    function nowIso() { return new Date().toISOString(); }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        } catch (_) { return ''; }
    }

    function daysUntil(iso) {
        if (!iso) return null;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        return Math.round((d - today) / 86400000);
    }

    function debounce(fn, wait) {
        let t;
        return function () {
            const args = arguments, ctx = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, wait);
        };
    }

    /* ------------------------- icons (inline SVG) ------------------------- */
    const ICON = {
        search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
        plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
        caret: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 6 6 6-6 6"/></svg>',
        doc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
        folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
        trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
        edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
        check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 7"/></svg>',
        list: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
        grid: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
        download: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>',
        navPages: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        navProjects: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        empty: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 14h6M9 18h4"/></svg>'
    };

    const STATUS_LABELS = {
        'todo': '待办',
        'doing': '进行中',
        'review': '待评审',
        'done': '已完成'
    };

    const STATUS_CSS = {
        'todo': 'workspace-status-todo',
        'doing': 'workspace-status-doing',
        'review': 'workspace-status-review',
        'done': 'workspace-status-done'
    };

    /* ------------------------- default store (self-hosted fallback) ------------------------- */
    function ensureStore() {
        if (window.MeteoHubStore && typeof window.MeteoHubStore.get === 'function'
            && typeof window.MeteoHubStore.update === 'function') {
            return window.MeteoHubStore;
        }

        const LS_KEY = 'meteohub_workspace_state_v1';
        const listeners = new Set();
        let state = null;
        let saveTimer = null;

        function loadInitial() {
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && Array.isArray(parsed.pages) && Array.isArray(parsed.projects)) {
                        return parsed;
                    }
                }
            } catch (_) { /* fallthrough to seed */ }
            return seed();
        }

        function seed() {
            const pageId = uid();
            return {
                pages: [{
                    id: pageId,
                    parentId: null,
                    title: '欢迎使用知识空间',
                    icon: 'doc',
                    expanded: true,
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                    blocks: [
                        { id: uid(), type: 'heading', text: '开始记录你的研究' },
                        { id: uid(), type: 'text', text: '左侧栏是页面树，可以新建子页面。点击标题或块直接编辑。' },
                        { id: uid(), type: 'todo', text: '试试勾选这条待办', checked: false },
                        { id: uid(), type: 'code', text: 'import numpy as np\nprint(np.pi)' }
                    ]
                }],
                projects: [
                    { id: uid(), title: '示例任务：撰写论文综述', status: 'todo', dueDate: '', notes: '', createdAt: nowIso(), updatedAt: nowIso() },
                    { id: uid(), title: '示例任务：跑通 IMERG 数据下载', status: 'doing', dueDate: formatDate(new Date(Date.now() + 7 * 86400000)), notes: '', createdAt: nowIso(), updatedAt: nowIso() }
                ],
                ui: {
                    selectedPageId: pageId,
                    view: 'pages', // 'pages' | 'projects'
                    projectView: 'table', // 'table' | 'kanban'
                    search: ''
                }
            };
        }

        function persist() {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(function () {
                try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) {}
            }, 200);
        }

        state = loadInitial();

        const store = {
            get: function () { return state; },
            update: function (mutator) {
                // mutator directly mutates state, then we persist + notify
                try {
                    if (typeof mutator === 'function') mutator(state);
                } catch (e) {
                    return Promise.reject(e);
                }
                persist();
                listeners.forEach(function (fn) {
                    try { fn(state); } catch (_) {}
                });
                return Promise.resolve();
            },
            subscribe: function (fn) {
                listeners.add(fn);
                return function () { listeners.delete(fn); };
            }
        };
        window.MeteoHubStore = store;
        return store;
    }

    /* ------------------------- module internals ------------------------- */
    let rootEl = null;
    let store = null;

    let unsubscribe = null;
    let identityEpoch = 0;
    let committing = 0;
    const pendingEdits = new Map();
    const drafts = new Map();
    let failedOperations = [];

    function showSaveFailure(error) {
        const el = rootEl && rootEl.querySelector('.workspace-save-indicator');
        if (!el) return;
        el.className = 'workspace-save-indicator failed';
        el.textContent = '保存失败：' + (error.message || '请重试') + ' ';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'workspace-btn';
        retry.textContent = '重试保存';
        retry.addEventListener('click', function () {
            const jobs = failedOperations.splice(0);
            jobs.forEach(function (job) { commit(job.mutator, job.success); });
        });
        el.appendChild(retry);
    }

    function commit(mutator, success) {
        const epoch = identityEpoch;
        const onSuccess = success || renderAll;
        setSavingFlag();
        committing += 1;
        // Call the host immediately so the standalone store remains responsive.
        let operation;
        try { operation = store.update(mutator); }
        catch (error) { operation = Promise.reject(error); }
        return Promise.resolve(operation).then(function () {
            if (epoch !== identityEpoch) return;
            onSuccess();
            if (!failedOperations.length) setSavedFlag();
        }).catch(function (error) {
            if (epoch !== identityEpoch) return;
            failedOperations.push({ mutator: mutator, success: onSuccess });
            showSaveFailure(error);
        }).finally(function () { committing -= 1; });
    }

    function flushEdits() {
        Array.from(pendingEdits.values()).forEach(function (flush) { flush(); });
    }

    function resetIdentity() {
        identityEpoch += 1;
        pendingEdits.clear();
        drafts.clear();
        failedOperations = [];
    }

    function onHostChange(event) {
        if (event && event.detail && event.detail.scope === 'identity') {
            drafts.clear();
            renderAll();
        } else if (!committing) renderAll();
    }

    function focusBlock(id) {
        const block = Array.from(rootEl.querySelectorAll('[data-block-id]'))
            .find(function (el) { return el.dataset.blockId === id; });
        const editor = block && block.querySelector('.workspace-block-content');
        if (!editor) return;
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Track current page id, view, etc. via store.get().ui
    // Ensures s.ui exists before writing to it. Used at the top of every mutator
    // that touches ui state, so a host store that doesn't seed ui still works.
    function ensureUi(s) {
        if (!s.ui) {
            Object.defineProperty(s, 'ui', {
                value: defaultUi(),
                enumerable: true,
                configurable: true,
                writable: true
            });
        }
        return s.ui;
    }

    function defaultUi() {
        return {
            selectedPageId: null,
            view: 'pages',      // 'pages' | 'projects'
            projectView: 'table', // 'table' | 'kanban'
            search: ''
        };
    }

    // Returns a guaranteed ui object. If the host store lacks `state.ui`, the
    // module transparently seeds defaults on the next mutator pass so the
    // host's data (pages, projects) stays intact.
    function ui() {
        const s = store.get();
        if (!s.ui) {
            // Don't write to host state here — just return a synthesized default.
            // The first mutator that touches s.ui will persist the defaults.
            return defaultUi();
        }
        return s.ui;
    }

    function setSavingFlag() {
        if (failedOperations.length) return;
        const el = rootEl && rootEl.querySelector('.workspace-save-indicator');
        if (!el) return;
        el.classList.remove('saved', 'failed');
        el.classList.add('saving');
        el.innerHTML = '<span class="pulse"></span>保存中…';
    }

    function setSavedFlag() {
        const el = rootEl && rootEl.querySelector('.workspace-save-indicator');
        if (!el) return;
        if (failedOperations.length || pendingEdits.size) return;
        el.classList.remove('saving', 'failed');
        el.classList.add('saved');
        el.innerHTML = '<span class="pulse"></span>已保存';
    }

    function showToast(msg) {
        if (!rootEl) return;
        let t = rootEl.querySelector('.workspace-toast');
        if (!t) {
            t = document.createElement('div');
            t.className = 'workspace-toast';
            rootEl.appendChild(t);
        }
        t.textContent = msg;
        requestAnimationFrame(function () { t.classList.add('show'); });
        clearTimeout(t._h);
        t._h = setTimeout(function () { t.classList.remove('show'); }, 1800);
    }

    function confirmDialog(message, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            const backdrop = document.createElement('div');
            backdrop.className = 'workspace-modal-backdrop';
            backdrop.innerHTML = (
                '<div class="workspace-modal" role="dialog" aria-modal="true">' +
                    '<h3>' + escapeHtml(opts.title || '请确认') + '</h3>' +
                    '<p>' + escapeHtml(message) + '</p>' +
                    '<div class="actions">' +
                        '<button type="button" class="workspace-btn ghost" data-act="cancel">' + escapeHtml(opts.cancelLabel || '取消') + '</button>' +
                        '<button type="button" class="workspace-btn danger" data-act="ok">' + escapeHtml(opts.okLabel || '确定') + '</button>' +
                    '</div>' +
                '</div>'
            );
            rootEl.appendChild(backdrop);

            function close(result) {
                document.removeEventListener('keydown', onKey);
                if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
                resolve(result);
            }

            function onKey(e) {
                if (e.key === 'Escape') close(false);
                else if (e.key === 'Enter') close(true);
            }
            document.addEventListener('keydown', onKey);

            backdrop.addEventListener('click', function (e) {
                if (e.target === backdrop) close(false);
            });
            backdrop.querySelector('[data-act="cancel"]').addEventListener('click', function () { close(false); });
            backdrop.querySelector('[data-act="ok"]').addEventListener('click', function () { close(true); });
            setTimeout(function () {
                const btn = backdrop.querySelector('[data-act="ok"]');
                if (btn) btn.focus();
            }, 0);
        });
    }

    /* ------------------------- page tree logic ------------------------- */
    function getPages() { return store.get().pages; }

    function findPage(id) {
        return getPages().find(function (p) { return p.id === id; }) || null;
    }

    function getRootPages() {
        return getPages().filter(function (p) { return !p.parentId; });
    }

    function getChildren(parentId) {
        return getPages().filter(function (p) { return p.parentId === parentId; });
    }

    function addPage(parentId) {
        const newPage = {
            id: uid(),
            parentId: parentId || null,
            title: parentId ? '新子页面' : '新页面',
            icon: 'doc',
            expanded: true,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            blocks: [{ id: uid(), type: 'text', text: '' }]
        };
        return newPage;
    }

    function deletePageCascade(pageId) {
        const all = getPages();
        const toDelete = new Set([pageId]);
        let changed = true;
        while (changed) {
            changed = false;
            all.forEach(function (p) {
                if (!toDelete.has(p.id) && toDelete.has(p.parentId)) {
                    toDelete.add(p.id);
                    changed = true;
                }
            });
        }
        return all.filter(function (p) { return !toDelete.has(p.id); });
    }

    /* ------------------------- projects logic ------------------------- */
    function getProjects() { return store.get().projects; }

    function addProject() {
        return {
            id: uid(),
            title: '新任务',
            status: 'todo',
            dueDate: '',
            notes: '',
            createdAt: nowIso(),
            updatedAt: nowIso()
        };
    }

    /* ------------------------- search ------------------------- */
    function searchPages(query) {
        const q = (query || '').trim().toLowerCase();
        if (!q) return [];
        const results = [];
        getPages().forEach(function (p) {
            const titleHit = (p.title || '').toLowerCase().includes(q);
            let blockHit = null;
            (p.blocks || []).forEach(function (b) {
                if ((b.text || '').toLowerCase().includes(q) && !blockHit) {
                    blockHit = b.text;
                }
            });
            if (titleHit || blockHit) {
                results.push({
                    pageId: p.id,
                    title: p.title,
                    snippet: blockHit || (p.blocks && p.blocks[0] ? p.blocks[0].text : '')
                });
            }
        });
        return results;
    }

    /* ------------------------- rendering ------------------------- */
    function renderShell() {
        rootEl.classList.add('workspace-root');
        rootEl.innerHTML = [
            '<div class="workspace-topbar" role="banner">',
            '  <div class="workspace-topbar-title"><span class="dot"></span>知识空间</div>',
            '  <div class="workspace-tabs" role="tablist">',
            '    <button type="button" data-view="pages" role="tab" aria-label="页面视图">页面</button>',
            '    <button type="button" data-view="projects" role="tab" aria-label="项目视图">项目</button>',
            '  </div>',
            '  <label class="workspace-search" aria-label="搜索">',
            '    ' + ICON.search,
            '    <input type="search" placeholder="搜索页面标题或内容…" autocomplete="off">',
            '  </label>',
            '  <span class="workspace-save-indicator" aria-live="polite"></span>',
            '</div>',
            '<div class="workspace-body">',
            '  <aside class="workspace-sidebar" aria-label="页面树"></aside>',
            '  <section class="workspace-main" aria-live="polite"></section>',
            '</div>'
        ].join('\n');

        // Wire shell-level events
        const topbar = rootEl.querySelector('.workspace-topbar');
        topbar.querySelectorAll('.workspace-tabs button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                commit(function (s) { ensureUi(s).view = btn.getAttribute('data-view'); });
            });
        });

        const searchInput = topbar.querySelector('.workspace-search input');
        const debouncedSearch = debounce(function (value) {
            commit(function (s) { ensureUi(s).search = value; });
        }, 180);
        searchInput.addEventListener('input', function () {
            debouncedSearch(searchInput.value);
        });
    }

    function renderTabs() {
        if (!rootEl) return;
        const tabs = rootEl.querySelectorAll('.workspace-tabs button');
        const current = ui().view;
        tabs.forEach(function (b) {
            if (b.getAttribute('data-view') === current) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    function renderSidebar() {
        const sidebar = rootEl.querySelector('.workspace-sidebar');
        if (!sidebar) return;
        const current = ui();
        sidebar.innerHTML = '';

        // Pages tree
        const h3 = document.createElement('h3');
        h3.textContent = '页面';
        sidebar.appendChild(h3);

        const tree = document.createElement('ul');
        tree.className = 'workspace-tree';
        tree.setAttribute('role', 'tree');
        sidebar.appendChild(tree);

        function buildNode(page) {
            const li = document.createElement('li');
            li.className = 'workspace-tree-item';
            li.setAttribute('role', 'treeitem');
            li.setAttribute('aria-expanded', String(page.expanded !== false));

            const row = document.createElement('div');
            row.className = 'workspace-tree-row';
            row.tabIndex = 0;
            if (page.id === current.selectedPageId) row.classList.add('active');

            const children = getChildren(page.id);
            const caret = document.createElement('span');
            caret.className = 'caret' + (children.length === 0 ? ' empty' : '');
            if (page.expanded === false) caret.classList.add('collapsed-caret');
            if (page.expanded !== false && children.length) caret.classList.add('open');
            caret.innerHTML = ICON.caret;
            caret.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!children.length) return;
                commit(function (s) {
                    const p = s.pages.find(function (x) { return x.id === page.id; });
                    if (p) p.expanded = !(p.expanded !== false);
                });
            });

            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.innerHTML = ICON.doc;

            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = page.title || '(未命名)';

            const actions = document.createElement('span');
            actions.className = 'actions';
            const addChild = document.createElement('button');
            addChild.type = 'button';
            addChild.title = '新建子页面';
            addChild.setAttribute('aria-label', '新建子页面');
            addChild.innerHTML = ICON.plus;
            addChild.addEventListener('click', function (e) {
                e.stopPropagation();
                commit(function (s) {
                    const np = addPage(page.id);
                    const parent = s.pages.find(function (x) { return x.id === page.id; });
                    if (parent) parent.expanded = true;
                    s.pages.push(np);
                    ensureUi(s).selectedPageId = np.id;
                });
            });
            const del = document.createElement('button');
            del.type = 'button';
            del.title = '删除页面';
            del.setAttribute('aria-label', '删除页面');
            del.innerHTML = ICON.trash;
            del.addEventListener('click', async function (e) {
                e.stopPropagation();
                const ok = await confirmDialog('确认删除此页面及其所有子页面？此操作不可撤销。', { title: '删除页面' });
                if (!ok) return;
                commit(function (s) {
                    const remaining = deletePageCascade(page.id);
                    s.pages = remaining;
                    if (ensureUi(s).selectedPageId === page.id) {
                        ensureUi(s).selectedPageId = s.pages.length ? s.pages[0].id : null;
                    }
                });
            });
            actions.appendChild(addChild);
            actions.appendChild(del);

            row.appendChild(caret);
            row.appendChild(icon);
            row.appendChild(label);
            row.appendChild(actions);

            row.addEventListener('click', function () {
                commit(function (s) { ensureUi(s).selectedPageId = page.id; });
            });
            row.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    row.click();
                }
            });

            li.appendChild(row);

            if (children.length && page.expanded !== false) {
                const ul = document.createElement('ul');
                ul.className = 'workspace-tree-children';
                ul.setAttribute('role', 'group');
                children.forEach(function (c) { ul.appendChild(buildNode(c)); });
                li.appendChild(ul);
            }
            return li;
        }

        const roots = getRootPages();
        if (roots.length === 0) {
            const li = document.createElement('li');
            li.className = 'workspace-tree-item';
            const row = document.createElement('div');
            row.className = 'workspace-tree-row';
            row.style.opacity = '0.6';
            const lbl = document.createElement('span');
            lbl.className = 'label';
            lbl.textContent = '尚无页面';
            row.appendChild(lbl);
            li.appendChild(row);
            tree.appendChild(li);
        } else {
            roots.forEach(function (r) { tree.appendChild(buildNode(r)); });
        }

        // New page button
        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'workspace-btn primary';
        newBtn.style.margin = '8px';
        newBtn.innerHTML = ICON.plus + '<span>新建页面</span>';
        newBtn.addEventListener('click', function () {
            commit(function (s) {
                const np = addPage(null);
                s.pages.push(np);
                ensureUi(s).selectedPageId = np.id;
            });
        });
        sidebar.appendChild(newBtn);

        // Projects shortcut
        const h3p = document.createElement('h3');
        h3p.textContent = '项目';
        sidebar.appendChild(h3p);
        const projBtn = document.createElement('button');
        projBtn.type = 'button';
        projBtn.className = 'workspace-btn ghost';
        projBtn.style.justifyContent = 'flex-start';
        projBtn.style.width = '100%';
        projBtn.style.marginBottom = '4px';
        projBtn.innerHTML = ICON.navProjects + '<span>任务面板</span>';
        projBtn.addEventListener('click', function () {
            commit(function (s) { ensureUi(s).view = 'projects'; });
        });
        sidebar.appendChild(projBtn);

        const expBtn = document.createElement('button');
        expBtn.type = 'button';
        expBtn.className = 'workspace-btn ghost';
        expBtn.style.justifyContent = 'flex-start';
        expBtn.style.width = '100%';
        expBtn.innerHTML = ICON.download + '<span>导出当前页面</span>';
        expBtn.addEventListener('click', function () {
            const id = ui().selectedPageId;
            if (id) exportPageMarkdown(id);
        });
        sidebar.appendChild(expBtn);
    }

    function renderEmptyPage() {
        const main = rootEl.querySelector('.workspace-main');
        main.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'workspace-empty';
        empty.innerHTML = (
            '<div class="glyph">' + ICON.empty + '</div>' +
            '<h2>这里还是一片空白</h2>' +
            '<p>创建你的第一个页面，开始记录文献、笔记或研究灵感。</p>' +
            '<button type="button" class="workspace-btn primary" data-act="create">' + ICON.plus + '新建第一个页面</button>'
        );
        empty.querySelector('[data-act="create"]').addEventListener('click', function () {
            commit(function (s) {
                const np = addPage(null);
                s.pages.push(np);
                ensureUi(s).selectedPageId = np.id;
            });
        });
        main.appendChild(empty);
    }

    function renderSearchResults(results, query) {
        const main = rootEl.querySelector('.workspace-main');
        main.innerHTML = '';
        const wrap = document.createElement('div');
        const title = document.createElement('h2');
        title.style.fontSize = '20px';
        title.style.margin = '4px 0 12px';
        title.textContent = '搜索结果（' + results.length + '）';
        wrap.appendChild(title);
        if (results.length === 0) {
            const p = document.createElement('p');
            p.style.color = 'var(--ws-text-muted)';
            p.textContent = '没有找到与 “' + query + '” 相关的页面。';
            wrap.appendChild(p);
        } else {
            results.forEach(function (r) {
                const row = document.createElement('div');
                row.className = 'workspace-search-result';
                const t = document.createElement('div');
                t.className = 'title';
                t.innerHTML = highlight(r.title, query);
                const snip = document.createElement('div');
                snip.className = 'snippet';
                snip.innerHTML = highlight(truncate(r.snippet || '', 120), query);
                row.appendChild(t);
                row.appendChild(snip);
                row.addEventListener('click', function () {
                    commit(function (s) {
                                        const u = ensureUi(s);
                                        u.search = '';
                                        u.selectedPageId = r.pageId;
                                    });
                    const input = rootEl.querySelector('.workspace-search input');
                    if (input) input.value = '';
                    renderAll();
                });
                wrap.appendChild(row);
            });
        }
        main.appendChild(wrap);
    }

    function truncate(s, n) {
        s = s || '';
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }

    function highlight(text, query) {
        const safe = escapeHtml(text);
        if (!query) return safe;
        const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return safe.replace(new RegExp('(' + q + ')', 'ig'), '<mark>$1</mark>');
    }

    function renderPageEditor(page) {
        const main = rootEl.querySelector('.workspace-main');
        const signature = JSON.stringify([page.id, page.blocks.map(function (b) { return [b.id, b.type, !!b.checked]; })]);
        if (main.dataset.editorSignature === signature && main.querySelector('.workspace-page-title')) {
            const title = main.querySelector('.workspace-page-title');
            if (document.activeElement !== title && !drafts.has(page.id + ':title')) title.value = page.title || '';
            page.blocks.forEach(function (b) {
                const el = Array.from(main.querySelectorAll('[data-block-id]')).find(function (node) { return node.dataset.blockId === b.id; });
                const content = el && el.querySelector('.workspace-block-content');
                if (content && document.activeElement !== content && !drafts.has(page.id + ':' + b.id)) content.textContent = b.text || '';
            });
            return;
        }
        const wasTitleFocused = main.querySelector('.workspace-page-title') === document.activeElement;
        const titleSelection = wasTitleFocused ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
        flushEdits();
        main.dataset.editorSignature = signature;
        main.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.className = 'workspace-page-header';

        const title = document.createElement('input');
        title.type = 'text';
        title.className = 'workspace-page-title';
        title.value = drafts.has(page.id + ':title') ? drafts.get(page.id + ':title') : (page.title || '');
        title.setAttribute('aria-label', '页面标题');
        const commitTitle = function () {
            const v = title.value.trim() || '未命名页面';
            const currentPage = findPage(page.id);
            if (currentPage && v === currentPage.title) return;
            setSavingFlag();
            commit(function (s) {
                const p = s.pages.find(function (x) { return x.id === page.id; });
                if (p) { p.title = v; p.updatedAt = nowIso(); }
            }, function () { drafts.delete(page.id + ':title'); setSavedFlag(); renderSidebar(); });
        };
        title.addEventListener('input', function () { drafts.set(page.id + ':title', title.value); });
        title.addEventListener('blur', commitTitle);
        title.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
            else if (e.key === 'Escape') { title.value = page.title || ''; title.blur(); }
        });
        header.appendChild(title);

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'workspace-btn';
        exportBtn.innerHTML = ICON.download + '<span>导出 Markdown</span>';
        exportBtn.addEventListener('click', function () { exportPageMarkdown(page.id); });
        header.appendChild(exportBtn);

        main.appendChild(header);

        // Meta
        const meta = document.createElement('div');
        meta.className = 'workspace-meta';
        meta.innerHTML = '<span>创建：' + escapeHtml(formatDateTime(page.createdAt)) + '</span>'
            + '<span>更新：' + escapeHtml(formatDateTime(page.updatedAt)) + '</span>'
            + '<span>' + page.blocks.length + ' 个块</span>';
        main.appendChild(meta);

        // Blocks container
        const blocksEl = document.createElement('div');
        blocksEl.className = 'workspace-blocks';
        main.appendChild(blocksEl);

        page.blocks.forEach(function (block) { blocksEl.appendChild(renderBlock(page, block, blocksEl)); });

        // Block add bar
        const addBar = document.createElement('div');
        addBar.className = 'workspace-block-add';
        function makeAddBtn(label, type) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'workspace-btn';
            b.innerHTML = ICON.plus + '<span>' + label + '</span>';
            b.addEventListener('click', function () {
                const newBlock = { id: uid(), type: type, text: '', checked: false };
                setSavingFlag();
                commit(function (s) {
                    const p = s.pages.find(function (x) { return x.id === page.id; });
                    if (p) {
                        p.blocks.push(newBlock);
                        p.updatedAt = nowIso();
                    }
                }, function () {
                    setSavedFlag();
                    renderMain();
                    focusBlock(newBlock.id);
                });
            });
            return b;
        }
        addBar.appendChild(makeAddBtn('文本', 'text'));
        addBar.appendChild(makeAddBtn('标题', 'heading'));
        addBar.appendChild(makeAddBtn('次标题', 'heading-2'));
        addBar.appendChild(makeAddBtn('待办', 'todo'));
        addBar.appendChild(makeAddBtn('代码', 'code'));
        main.appendChild(addBar);
        if (wasTitleFocused) { title.focus(); title.setSelectionRange(titleSelection[0], titleSelection[1]); }
    }

    function formatDateTime(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return `${y}-${m}-${dd} ${hh}:${mi}`;
        } catch (_) { return '—'; }
    }

    function renderBlock(page, block, container) {
        const wrap = document.createElement('div');
        wrap.className = 'workspace-block ' + (block.type === 'heading' ? 'heading' : block.type === 'heading-2' ? 'heading-2' : block.type);
        wrap.setAttribute('data-block-id', block.id);

        // Gutter
        const gutter = document.createElement('div');
        gutter.className = 'workspace-block-gutter';
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.title = '上移';
        upBtn.setAttribute('aria-label', '上移块');
        upBtn.textContent = '↑';
        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.title = '下移';
        downBtn.setAttribute('aria-label', '下移块');
        downBtn.textContent = '↓';
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.title = '删除';
        delBtn.setAttribute('aria-label', '删除块');
        delBtn.innerHTML = ICON.trash;
        gutter.appendChild(upBtn);
        gutter.appendChild(downBtn);
        gutter.appendChild(delBtn);
        wrap.appendChild(gutter);

        // Content
        let contentEl;
        if (block.type === 'todo') {
            const check = document.createElement('span');
            check.className = 'todo-box' + (block.checked ? ' checked' : '');
            check.setAttribute('role', 'checkbox');
            check.setAttribute('aria-checked', block.checked ? 'true' : 'false');
            check.tabIndex = 0;
            if (block.checked) check.innerHTML = ICON.check;
            check.addEventListener('click', function (e) {
                e.stopPropagation();
                setSavingFlag();
                commit(function (s) {
                    const p = s.pages.find(function (x) { return x.id === page.id; });
                    if (!p) return;
                    const b = p.blocks.find(function (x) { return x.id === block.id; });
                    if (b) { b.checked = !b.checked; p.updatedAt = nowIso(); }
                }, function () { setSavedFlag(); renderMain(); });
            });
            check.addEventListener('keydown', function (e) {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); check.click(); }
            });
            wrap.appendChild(check);

            contentEl = document.createElement('div');
            contentEl.className = 'workspace-block-content';
            contentEl.setAttribute('contenteditable', 'true');
            contentEl.setAttribute('role', 'textbox');
            contentEl.setAttribute('aria-label', '编辑块内容');
            contentEl.tabIndex = 0;
            contentEl.setAttribute('data-placeholder', '待办事项…');
            contentEl.spellcheck = true;
        } else {
            contentEl = document.createElement('div');
            contentEl.className = 'workspace-block-content';
            contentEl.setAttribute('contenteditable', 'true');
            contentEl.setAttribute('role', 'textbox');
            contentEl.setAttribute('aria-label', '编辑块内容');
            contentEl.tabIndex = 0;
            contentEl.spellcheck = true;
            if (block.type === 'heading') contentEl.setAttribute('data-placeholder', '标题');
            else if (block.type === 'heading-2') contentEl.setAttribute('data-placeholder', '次级标题');
            else if (block.type === 'code') contentEl.setAttribute('data-placeholder', '代码…');
            else contentEl.setAttribute('data-placeholder', '输入文本，Enter 新建下一块');
        }

        const draftKey = page.id + ':' + block.id;
        contentEl.textContent = drafts.has(draftKey) ? drafts.get(draftKey) : (block.text || '');
        wrap.appendChild(contentEl);

        // Capture the text immediately, before navigation can detach this editor.
        let lastSaved = block.text || '';
        let timer = null;
        const epoch = identityEpoch;
        function saveNow() {
            clearTimeout(timer);
            pendingEdits.delete(draftKey);
            if (epoch !== identityEpoch) return;
            const value = drafts.has(draftKey) ? drafts.get(draftKey) : contentEl.textContent || '';
            if (value === lastSaved) return;
            commit(function (s) {
                const p = s.pages.find(function (x) { return x.id === page.id; });
                const b = p && p.blocks.find(function (x) { return x.id === block.id; });
                if (b) { b.text = value; p.updatedAt = nowIso(); }
            }, function () {
                lastSaved = value;
                if (drafts.get(draftKey) === value) drafts.delete(draftKey);
            });
        }
        contentEl.addEventListener('input', function () {
            drafts.set(draftKey, contentEl.textContent || '');
            pendingEdits.set(draftKey, saveNow);
            clearTimeout(timer);
            timer = setTimeout(saveNow, 350);
            setSavingFlag();
        });
        contentEl.addEventListener('focus', function () { wrap.classList.add('active'); });
        contentEl.addEventListener('blur', function () {
            wrap.classList.remove('active');
            saveNow();
        });
        contentEl.addEventListener('paste', function (event) {
            if (!event.clipboardData) return;
            event.preventDefault();
            const text = event.clipboardData.getData('text/plain');
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const node = document.createTextNode(text);
                range.insertNode(node);
                range.setStartAfter(node);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            contentEl.dispatchEvent(new Event('input', { bubbles: true }));
        });

        contentEl.addEventListener('keydown', function (e) {
            // Enter creates a new text block below; Backspace at start merges upward (simplified: backspace at empty deletes this block)
            if (e.isComposing) return;
            if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
                saveNow();
                e.preventDefault();
                const newBlock = { id: uid(), type: 'text', text: '' };
                setSavingFlag();
                commit(function (s) {
                    const p = s.pages.find(function (x) { return x.id === page.id; });
                    if (!p) return;
                    const idx = p.blocks.findIndex(function (x) { return x.id === block.id; });
                    if (idx >= 0) p.blocks.splice(idx + 1, 0, newBlock);
                    p.updatedAt = nowIso();
                }, function () {
                    setSavedFlag();
                    const shouldFocus = document.activeElement === contentEl;
                    renderMain();
                    if (shouldFocus) focusBlock(newBlock.id);
                });
            } else if (e.key === 'Backspace' && (contentEl.textContent || '') === '' && block.type === 'text') {
                e.preventDefault();
                const live = findPage(page.id);
                const index = live.blocks.findIndex(function (x) { return x.id === block.id; });
                const previousId = index > 0 ? live.blocks[index - 1].id : block.id;
                setSavingFlag();
                commit(function (s) {
                    const p = s.pages.find(function (x) { return x.id === page.id; });
                    if (!p) return;
                    const idx = p.blocks.findIndex(function (x) { return x.id === block.id; });
                    if (idx > 0) p.blocks.splice(idx, 1);
                }, function () {
                    setSavedFlag();
                    renderMain();
                    focusBlock(previousId);
                });
            } else if (e.key === 'Escape') {
                contentEl.blur();
            }
        });

        // Gutter handlers
        upBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            setSavingFlag();
            commit(function (s) {
                const p = s.pages.find(function (x) { return x.id === page.id; });
                if (!p) return;
                const idx = p.blocks.findIndex(function (x) { return x.id === block.id; });
                if (idx > 0) {
                    const tmp = p.blocks[idx - 1];
                    p.blocks[idx - 1] = p.blocks[idx];
                    p.blocks[idx] = tmp;
                    p.updatedAt = nowIso();
                }
            }, function () { setSavedFlag(); renderMain(); });
        });
        downBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            setSavingFlag();
            commit(function (s) {
                const p = s.pages.find(function (x) { return x.id === page.id; });
                if (!p) return;
                const idx = p.blocks.findIndex(function (x) { return x.id === block.id; });
                if (idx >= 0 && idx < p.blocks.length - 1) {
                    const tmp = p.blocks[idx + 1];
                    p.blocks[idx + 1] = p.blocks[idx];
                    p.blocks[idx] = tmp;
                    p.updatedAt = nowIso();
                }
            }, function () { setSavedFlag(); renderMain(); });
        });
        delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            setSavingFlag();
            commit(function (s) {
                const p = s.pages.find(function (x) { return x.id === page.id; });
                if (!p) return;
                p.blocks = p.blocks.filter(function (x) { return x.id !== block.id; });
                p.updatedAt = nowIso();
            }, function () { setSavedFlag(); renderMain(); });
        });

        // For code blocks, plain text editing
        if (block.type === 'code') {
            contentEl.addEventListener('keydown', function (e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    document.execCommand('insertText', false, '    ');
                }
            });
        }

        if (block.type === 'todo' && block.checked) wrap.classList.add('done');
        return wrap;
    }

    /* ------------------------- projects view ------------------------- */
    function renderProjects() {
        const main = rootEl.querySelector('.workspace-main');
        main.innerHTML = '';

        const projects = getProjects();
        const current = ui();

        const toolbar = document.createElement('div');
        toolbar.className = 'workspace-projects-toolbar';

        const title = document.createElement('h2');
        title.textContent = '项目任务';
        toolbar.appendChild(title);

        const toggle = document.createElement('div');
        toggle.className = 'workspace-view-toggle';
        toggle.setAttribute('role', 'group');
        toggle.setAttribute('aria-label', '切换表格/看板');
        const btnTable = document.createElement('button');
        btnTable.type = 'button';
        btnTable.innerHTML = ICON.list + '<span>表格</span>';
        if (current.projectView === 'table') btnTable.classList.add('active');
        const btnKanban = document.createElement('button');
        btnKanban.type = 'button';
        btnKanban.innerHTML = ICON.grid + '<span>看板</span>';
        if (current.projectView === 'kanban') btnKanban.classList.add('active');
        btnTable.addEventListener('click', function () {
            commit(function (s) { ensureUi(s).projectView = 'table'; });
        });
        btnKanban.addEventListener('click', function () {
            commit(function (s) { ensureUi(s).projectView = 'kanban'; });
        });
        toggle.appendChild(btnTable);
        toggle.appendChild(btnKanban);
        toolbar.appendChild(toggle);

        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'workspace-btn primary';
        newBtn.innerHTML = ICON.plus + '<span>新建任务</span>';
        newBtn.addEventListener('click', function () {
            setSavingFlag();
            commit(function (s) {
                s.projects.unshift(addProject());
            }, function () { setSavedFlag(); renderProjects(); });
        });
        toolbar.appendChild(newBtn);

        main.appendChild(toolbar);

        if (current.projectView === 'kanban') {
            renderKanban(main, projects);
        } else {
            renderProjectsTable(main, projects);
        }

        if (projects.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'workspace-empty';
            empty.innerHTML = '<div class="glyph">' + ICON.navProjects + '</div>'
                + '<h2>暂无任务</h2>'
                + '<p>添加任务并设定截止日期，在表格或看板视图中追踪进度。</p>';
            main.appendChild(empty);
        }
    }

    function renderProjectsTable(main, projects) {
        const wrap = document.createElement('div');
        wrap.className = 'workspace-table';
        const table = document.createElement('table');
        table.innerHTML = '<thead><tr>'
            + '<th style="width:42%">任务</th>'
            + '<th style="width:14%">状态</th>'
            + '<th style="width:14%">截止日期</th>'
            + '<th>备注</th>'
            + '<th style="width:90px" class="actions-cell">操作</th>'
            + '</tr></thead>';
        const tbody = document.createElement('tbody');
        projects.forEach(function (p) { tbody.appendChild(renderProjectRow(p)); });
        table.appendChild(tbody);
        wrap.appendChild(table);
        main.appendChild(wrap);
    }

    function renderProjectRow(p) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-project-id', p.id);

        const tdTitle = document.createElement('td');
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'inline-edit';
        titleInput.value = p.title || '';
        titleInput.setAttribute('aria-label', '任务名称');
        titleInput.addEventListener('change', function () {
            const v = titleInput.value.trim() || '未命名任务';
            setSavingFlag();
            commit(function (s) {
                const x = s.projects.find(function (y) { return y.id === p.id; });
                if (x) { x.title = v; x.updatedAt = nowIso(); }
            }, function () { setSavedFlag(); });
        });
        tdTitle.appendChild(titleInput);

        const tdStatus = document.createElement('td');
        const statusSelect = document.createElement('select');
        statusSelect.className = 'inline-edit';
        ['todo', 'doing', 'review', 'done'].forEach(function (key) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = STATUS_LABELS[key];
            if (key === p.status) opt.selected = true;
            statusSelect.appendChild(opt);
        });
        statusSelect.addEventListener('change', function () {
            setSavingFlag();
            commit(function (s) {
                const x = s.projects.find(function (y) { return y.id === p.id; });
                if (x) { x.status = statusSelect.value; x.updatedAt = nowIso(); }
            }, function () {
                setSavedFlag();
                // reflect status pill in cell
                tdStatus.querySelector('.status-pill').className = 'status-pill ' + STATUS_CSS[statusSelect.value];
                tdStatus.querySelector('.status-pill').textContent = STATUS_LABELS[statusSelect.value];
                // For kanban live updates
                if (ui().projectView === 'kanban') renderProjects();
            });
        });
        const pill = document.createElement('span');
        pill.className = 'status-pill ' + STATUS_CSS[p.status];
        pill.textContent = STATUS_LABELS[p.status];
        tdStatus.appendChild(pill);
        tdStatus.appendChild(statusSelect);

        const tdDue = document.createElement('td');
        const dueInput = document.createElement('input');
        dueInput.type = 'date';
        dueInput.className = 'inline-edit';
        dueInput.value = p.dueDate || '';
        dueInput.addEventListener('change', function () {
            setSavingFlag();
            commit(function (s) {
                const x = s.projects.find(function (y) { return y.id === p.id; });
                if (x) { x.dueDate = dueInput.value; x.updatedAt = nowIso(); }
            }, function () {
                setSavedFlag();
                applyDueClass(tdDue, dueInput.value);
            });
        });
        tdDue.appendChild(dueInput);
        applyDueClass(tdDue, p.dueDate);

        const tdNotes = document.createElement('td');
        const notesInput = document.createElement('input');
        notesInput.type = 'text';
        notesInput.className = 'inline-edit';
        notesInput.value = p.notes || '';
        notesInput.placeholder = '备注（可选）';
        notesInput.addEventListener('change', function () {
            setSavingFlag();
            commit(function (s) {
                const x = s.projects.find(function (y) { return y.id === p.id; });
                if (x) { x.notes = notesInput.value; x.updatedAt = nowIso(); }
            }, function () { setSavedFlag(); });
        });
        tdNotes.appendChild(notesInput);

        const tdActions = document.createElement('td');
        tdActions.className = 'actions-cell';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'danger';
        del.title = '删除任务';
        del.setAttribute('aria-label', '删除任务');
        del.innerHTML = ICON.trash;
        del.addEventListener('click', async function () {
            const ok = await confirmDialog('确认删除任务“' + (p.title || '未命名') + '”？', { title: '删除任务' });
            if (!ok) return;
            setSavingFlag();
            commit(function (s) {
                s.projects = s.projects.filter(function (y) { return y.id !== p.id; });
            }, function () { setSavedFlag(); renderProjects(); });
        });
        tdActions.appendChild(del);

        tr.appendChild(tdTitle);
        tr.appendChild(tdStatus);
        tr.appendChild(tdDue);
        tr.appendChild(tdNotes);
        tr.appendChild(tdActions);
        return tr;
    }

    function applyDueClass(td, val) {
        // remove previous class hints inside
        const d = daysUntil(val);
        td.classList.remove('due-soon', 'due-over', 'due-none');
        if (d === null) td.classList.add('due-none');
        else if (d < 0) td.classList.add('due-over');
        else if (d <= 3) td.classList.add('due-soon');
    }

    function renderKanban(main, projects) {
        const wrap = document.createElement('div');
        wrap.className = 'workspace-kanban';
        ['todo', 'doing', 'review', 'done'].forEach(function (statusKey) {
            const col = document.createElement('div');
            col.className = 'workspace-kanban-col';
            col.setAttribute('data-status', statusKey);

            const header = document.createElement('header');
            const h = document.createElement('h4');
            h.textContent = STATUS_LABELS[statusKey];
            const count = document.createElement('span');
            count.className = 'count';
            const list = projects.filter(function (p) { return p.status === statusKey; });
            count.textContent = String(list.length);
            header.appendChild(h);
            header.appendChild(count);
            col.appendChild(header);

            list.forEach(function (p) { col.appendChild(renderKanbanCard(p)); });

            // Drag-drop wiring
            col.addEventListener('dragover', function (e) {
                e.preventDefault();
                col.classList.add('drop-target');
            });
            col.addEventListener('dragleave', function () {
                col.classList.remove('drop-target');
            });
            col.addEventListener('drop', function (e) {
                e.preventDefault();
                col.classList.remove('drop-target');
                const id = e.dataTransfer.getData('text/plain');
                if (!id) return;
                setSavingFlag();
                commit(function (s) {
                    const x = s.projects.find(function (y) { return y.id === id; });
                    if (x && x.status !== statusKey) { x.status = statusKey; x.updatedAt = nowIso(); }
                }, function () { setSavedFlag(); renderProjects(); });
            });

            wrap.appendChild(col);
        });
        main.appendChild(wrap);
    }

    function renderKanbanCard(p) {
        const card = document.createElement('div');
        card.className = 'workspace-kanban-card';
        card.draggable = true;
        card.setAttribute('data-project-id', p.id);

        card.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/plain', p.id);
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', function () {
            card.classList.remove('dragging');
        });

        const titleEl = document.createElement('div');
        titleEl.className = 'title';
        titleEl.textContent = p.title || '未命名任务';
        card.appendChild(titleEl);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const left = document.createElement('span');
        if (p.dueDate) {
            const tag = document.createElement('span');
            tag.className = 'workspace-due-tag';
            const d = daysUntil(p.dueDate);
            if (d !== null) {
                if (d < 0) tag.classList.add('over');
                else if (d <= 3) tag.classList.add('soon');
                tag.textContent = (d < 0 ? '逾期 ' : '剩余 ') + Math.abs(d) + ' 天';
            }
            left.appendChild(tag);
        } else {
            left.textContent = '无截止';
            left.style.color = 'var(--ws-text-faint)';
        }
        meta.appendChild(left);

        const right = document.createElement('span');
        right.textContent = p.dueDate ? p.dueDate : '';
        meta.appendChild(right);
        card.appendChild(meta);

        const row = document.createElement('div');
        row.className = 'row-actions';
        const cycle = document.createElement('button');
        cycle.type = 'button';
        cycle.title = '切换状态';
        cycle.textContent = '↻';
        cycle.addEventListener('click', function (e) {
            e.stopPropagation();
            const order = ['todo', 'doing', 'review', 'done'];
            setSavingFlag();
            commit(function (s) {
                const x = s.projects.find(function (y) { return y.id === p.id; });
                if (!x) return;
                const i = order.indexOf(x.status);
                x.status = order[(i + 1) % order.length];
                x.updatedAt = nowIso();
            }, function () { setSavedFlag(); renderProjects(); });
        });
        const del = document.createElement('button');
        del.type = 'button';
        del.title = '删除';
        del.innerHTML = ICON.trash;
        del.addEventListener('click', async function (e) {
            e.stopPropagation();
            const ok = await confirmDialog('确认删除任务“' + (p.title || '未命名') + '”？', { title: '删除任务' });
            if (!ok) return;
            setSavingFlag();
            commit(function (s) {
                s.projects = s.projects.filter(function (y) { return y.id !== p.id; });
            }, function () { setSavedFlag(); renderProjects(); });
        });
        row.appendChild(cycle);
        row.appendChild(del);
        card.appendChild(row);

        return card;
    }

    /* ------------------------- markdown export ------------------------- */
    function pageToMarkdown(page) {
        const lines = [];
        lines.push('# ' + (page.title || '未命名页面'));
        lines.push('');
        (page.blocks || []).forEach(function (b) {
            if (b.type === 'heading') lines.push('## ' + b.text);
            else if (b.type === 'heading-2') lines.push('### ' + b.text);
            else if (b.type === 'todo') lines.push('- [' + (b.checked ? 'x' : ' ') + '] ' + b.text);
            else if (b.type === 'code') { lines.push('```'); lines.push(b.text); lines.push('```'); }
            else lines.push(b.text);
            lines.push('');
        });
        return lines.join('\n');
    }

    function exportPageMarkdown(pageId) {
        const page = findPage(pageId);
        if (!page) { showToast('页面不存在'); return; }
        const exported = JSON.parse(JSON.stringify(page));
        if (drafts.has(page.id + ':title')) exported.title = drafts.get(page.id + ':title');
        exported.blocks.forEach(function (block) {
            const key = page.id + ':' + block.id;
            if (drafts.has(key)) block.text = drafts.get(key);
        });
        const md = pageToMarkdown(exported);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (page.title || 'page').replace(/[\\/:*?"<>|]/g, '_') + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        showToast('已导出：' + a.download);
    }

    /* ------------------------- top-level render ------------------------- */
    function renderMain() {
        const main = rootEl.querySelector('.workspace-main');
        if (!main) return;
        const state = store.get();
        const current = ui();
        if (current.view === 'projects') {
            renderProjects();
            return;
        }
        if (current.search && current.search.trim()) {
            const results = searchPages(current.search);
            renderSearchResults(results, current.search);
            return;
        }
        let page = current.selectedPageId ? findPage(current.selectedPageId) : null;
        // If the selected page was deleted (e.g. by host) or never set, fall back
        // to the first available page rather than showing a misleading empty state.
        if (!page && state.pages && state.pages.length > 0) {
            page = state.pages[0];
        }
        if (!page) { renderEmptyPage(); return; }
        renderPageEditor(page);
    }

    function renderAll() {
        if (!rootEl) return;
        renderTabs();
        renderSidebar();
        renderMain();
    }

    /* ------------------------- mount ------------------------- */
    function mount(root) {
        if (!root || root.nodeType !== 1) {
            throw new Error('window.MeteoWorkspace.mount(root): root must be a DOM element');
        }
        flushEdits();
        if (unsubscribe) unsubscribe();
        window.removeEventListener('meteohub:state-changed', onHostChange);
        window.removeEventListener('meteohub:identity-changing', resetIdentity);
        rootEl = root;
        store = ensureStore();
        renderShell();
        renderAll();
        unsubscribe = typeof store.subscribe === 'function' ? store.subscribe(onHostChange) : null;
        window.addEventListener('meteohub:state-changed', onHostChange);
        window.addEventListener('meteohub:identity-changing', resetIdentity);
    }

    /* ------------------------- expose ------------------------- */
    window.MeteoWorkspace = {
        mount: mount,
        // Convenience accessors for hosts that want to inspect the module
        getState: function () {
            const s = ensureStore();
            return s.get();
        },
        exportPage: function (pageId) {
            ensureStore();
            exportPageMarkdown(pageId);
        }
    };
})();