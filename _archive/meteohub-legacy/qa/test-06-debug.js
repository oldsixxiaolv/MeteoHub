// Debug
'use strict';
const { loadDom, makeHostStoreFactory } = require('./qa-harness');

(async function () {
    let factory;
    const h = loadDom({
        hostStoreFactory: (win) => {
            factory = makeHostStoreFactory(win);
            factory.seed({
                pages: [{ id: 'p1', parentId: null, title: 'HostPage', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b1', type: 'text', text: 'host' }] }],
                projects: [], profile: {}
            });
            return factory;
        }
    });
    await h.tick(300);

    console.log('state.pages after mount:', factory.get().pages.length, JSON.stringify(factory.get().pages[0]).slice(0, 80));
    console.log('selectedPageId in ui:', factory.get().ui && factory.get().ui.selectedPageId);
    const main = h.$('.workspace-main');
    console.log('main innerHTML first 200:', main && main.innerHTML.slice(0, 200));
    const treeLabels = h.$$('.workspace-tree-row .label');
    console.log('tree labels:', treeLabels.map((e) => e.textContent));
})();