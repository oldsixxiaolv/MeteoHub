// Test 06: Host-event reactivity — when the host dispatches
// 'meteohub:state-changed', workspace must re-render (sidebar + main + tabs).
'use strict';
const { loadDom, makeHostStoreFactory } = require('./qa-harness');

(async function () {
    const errors = [];
    let factory;
    // Seed the factory BEFORE mounting so workspace sees populated state on mount.
    const preloaded = {
        pages: [{ id: 'p1', parentId: null, title: 'HostPage', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b1', type: 'text', text: 'host' }] }],
        projects: [], profile: {}
    };
    const harness = loadDom({
        hostStoreFactory: (win) => {
            factory = makeHostStoreFactory(win);
            factory.seed(preloaded);
            return factory;
        }
    });
    await harness.tick(300);

    if (!harness.$('.workspace-tree-row .label')) errors.push('host page not in sidebar');
    const titleInput = harness.$('.workspace-page-title');
    if (!titleInput) errors.push('host page editor not rendered');
    else if (titleInput.value !== 'HostPage') errors.push('host page title wrong: ' + JSON.stringify(titleInput.value));

    // Now mutate via host store — workspace must re-render.
    await harness.window.MeteoHubStore.update((s) => {
        s.pages.push({ id: 'p2', parentId: null, title: 'Pushed From Outside', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [] });
    });
    await harness.tick(50);
    const labels = harness.$$('.workspace-tree-row .label');
    if (!labels.some((e) => e.textContent.includes('Pushed From Outside'))) {
        errors.push('external push via store.update not reflected in tree');
    }

    // Mutate again via host store — rename p1.
    await harness.window.MeteoHubStore.update((s) => {
        s.pages[0].title = 'Renamed By Host';
    });
    await harness.tick(50);
    const labels2 = harness.$$('.workspace-tree-row .label');
    if (!labels2.some((e) => e.textContent.includes('Renamed By Host'))) {
        errors.push('rename via host not reflected in tree');
    }

    if (errors.length === 0) { console.log('HOST-EVENT OK'); process.exit(0); }
    console.log(JSON.stringify(errors, null, 2));
    process.exit(1);
})();