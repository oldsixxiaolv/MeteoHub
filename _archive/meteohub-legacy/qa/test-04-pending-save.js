// Test 04: Pending save — type something, then switch pages in the sidebar
// before the 350ms debounce fires. The pending input MUST still be saved.
'use strict';
const { loadDom } = require('./qa-harness');

(async function () {
    const errors = [];
    const h = loadDom();
    await h.tick(300);

    h.window.MeteoHubStore.update((s) => {
        s.pages = [
            { id: 'p1', parentId: null, title: 'Page A', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b1', type: 'text', text: '' }] },
            { id: 'p2', parentId: null, title: 'Page B', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b2', type: 'text', text: '' }] }
        ];
        s.projects = [];
        delete s.ui;
    });
    await h.tick(50);

    const bc = h.$$('.workspace-block-content')[0];
    h.typeIn(bc, 'A pending draft');

    // Immediately (well before 350ms debounce), click Page B in sidebar
    const treeLabels = h.$$('.workspace-tree-row');
    h.click(treeLabels[1]); // second row
    await h.tick(600); // wait long enough for both debounce AND renderMain

    const state = h.window.MeteoHubStore.get();
    const a = state.pages.find((p) => p.id === 'p1');
    if (!a || !a.blocks.some((b) => b.text === 'A pending draft')) {
        errors.push('Pending draft was lost when switching pages: ' + JSON.stringify(a && a.blocks));
    }

    if (errors.length === 0) { console.log('PENDING-SAVE OK'); process.exit(0); }
    console.log(JSON.stringify(errors, null, 2));
    process.exit(1);
})();