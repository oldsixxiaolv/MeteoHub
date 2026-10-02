// Test 02: Page tree — create / edit / delete (cascade) / parent-child consistency
'use strict';
const { loadDom } = require('./qa-harness');

(async function () {
    const errors = [];
    const log = (m) => { if (process.env.VERBOSE) console.log(m); };
    const h = loadDom();
    // Wait for any seed-time debounced saves
    await h.tick(300);

    // Reset to empty
    h.window.MeteoHubStore.update((s) => {
        s.pages = [];
        s.projects = [];
        delete s.ui;
    });
    await h.tick(50);

    // Empty state shows the empty-page CTA
    if (!h.$('.workspace-empty')) {
        errors.push('Empty state CTA missing when no pages exist');
    }

    // Click "新建第一个页面" -> creates first page
    const createBtn = h.$('.workspace-empty button[data-act="create"]');
    if (!createBtn) errors.push('empty CTA button not found');
    else h.click(createBtn);
    await h.tick(20);

    if (h.window.MeteoHubStore.get().pages.length !== 1) errors.push('first page not created');
    if (!h.$('.workspace-page-title')) errors.push('page editor not rendered after create');

    // Create a child page via the sidebar "+"
    const addChild = h.$('.workspace-tree-row .actions button[aria-label="新建子页面"]');
    if (!addChild) errors.push('add-child button missing');
    else {
        h.click(addChild);
        await h.tick(20);
    }
    if (h.window.MeteoHubStore.get().pages.length !== 2) errors.push('child page not created');

    // Parent must have a child visible in tree
    const childItems = h.$$('.workspace-tree-row .label');
    if (!childItems.some((e) => e.textContent.includes('新子页面'))) {
        errors.push('child label not visible in tree');
    }

    // Cascade delete: delete parent -> child must also disappear
    const delBtns = h.$$('.workspace-tree-row .actions button[aria-label="删除页面"]');
    if (delBtns.length < 2) errors.push('expected 2 delete buttons (parent + child)');
    else {
        // jsdom doesn't implement confirm() — workspace uses a custom modal
        // (workspace-modal-backdrop) which we click directly.
        // Spy on the modal click flow: we trigger click on the parent delete
        // button, then click "确定" inside the modal.
        h.click(delBtns[0]);
        await h.tick(20);
        const okBtn = h.$('.workspace-modal-backdrop [data-act="ok"]');
        if (!okBtn) errors.push('confirm modal OK button missing');
        else h.click(okBtn);
        await h.tick(30);
    }
    const pagesAfter = h.window.MeteoHubStore.get().pages.length;
    if (pagesAfter !== 0) {
        errors.push('cascade delete failed: pages remaining = ' + pagesAfter + ' (expected 0)');
    }

    // Re-create two pages to test orphan parentId cleanup (defensive)
    h.window.MeteoHubStore.update((s) => {
        s.pages = [
            { id: 'orphan', parentId: 'ghost-id', title: 'Orphan', icon: 'doc', expanded: true, blocks: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
            { id: 'root', parentId: null, title: 'Root', icon: 'doc', expanded: true, blocks: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' }
        ];
        s.ui = { selectedPageId: 'root', view: 'pages', projectView: 'table', search: '' };
    });
    await h.tick(20);
    const rows = h.$$('.workspace-tree-row');
    // Orphan must be hidden — it has parentId === 'ghost-id' which doesn't exist.
    // (Note: workspace.js's renderSidebar iterates only root pages via getRootPages(),
    // so orphans should not appear — but they will still exist in state.)
    const orphanVisible = h.$$('.workspace-tree-row .label').some((e) => e.textContent.includes('Orphan'));
    if (orphanVisible) {
        errors.push('Orphan page (with dangling parentId) is rendered as root — workspace silently mis-parents it');
    }

    if (errors.length === 0) { console.log('TREE OK'); process.exit(0); }
    console.log(JSON.stringify(errors, null, 2));
    process.exit(1);
})();