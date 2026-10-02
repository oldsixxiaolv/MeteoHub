// Smoke test: workspace.js syntax is valid, module exposes the documented
// contract (window.MeteoWorkspace.mount), and renders a page-tree skeleton.
'use strict';
const { loadDom, makeHostStoreFactory } = require('./qa-harness');

(async function () {
    const errors = [];
    const exit = (code) => { console.log(JSON.stringify({ errors }, null, 2)); process.exit(code); };

    // 1. JS syntax
    try {
        // eslint-disable-next-line no-eval
        new Function(require('fs').readFileSync(require('path').resolve(__dirname, '..', 'workspace.js'), 'utf8'));
    } catch (e) {
        errors.push('SyntaxError in workspace.js: ' + e.message);
        return exit(1);
    }

    // 2. Module load + render with self-hosted store
    let h;
    try {
        h = loadDom();
    } catch (e) {
        errors.push('Load failed: ' + e.message + '\n' + e.stack);
        return exit(1);
    }

    // 3. Contract: window.MeteoWorkspace.mount exists
    if (!h.window.MeteoWorkspace || typeof h.window.MeteoWorkspace.mount !== 'function') {
        errors.push('window.MeteoWorkspace.mount is missing');
        return exit(1);
    }

    // 4. Shell rendered
    if (!h.$('.workspace-topbar')) errors.push('topbar not rendered');
    if (!h.$('.workspace-sidebar')) errors.push('sidebar not rendered');
    if (!h.$('.workspace-main')) errors.push('main not rendered');
    if (!h.$('.workspace-tree')) errors.push('tree not rendered');

    // 5. Default store seeded a welcome page + 2 sample projects
    const state = h.window.MeteoHubStore.get();
    if (!Array.isArray(state.pages) || state.pages.length < 1) errors.push('default pages missing');
    if (!Array.isArray(state.projects) || state.projects.length < 1) errors.push('default projects missing');

    // 6. Host-store path
    const h2 = loadDom({ hostStoreFactory: (win) => {
        const f = makeHostStoreFactory(win);
        f.seed({ pages: [{ id: 'p1', title: 'Host Page', parentId: null, icon: 'doc', blocks: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' }], projects: [], profile: {} });
        return f;
    } });
    const rows = h2.$$('.workspace-tree-row');
    if (rows.length < 1) errors.push('host store page not rendered in tree');
    if (!h2.text('.workspace-tree-row .label') || !h2.text('.workspace-tree-row .label').includes('Host Page')) {
        errors.push('host store page label missing: ' + h2.text('.workspace-tree-row .label'));
    }

    if (errors.length === 0) { console.log('SMOKE OK'); process.exit(0); }
    exit(1);
})();