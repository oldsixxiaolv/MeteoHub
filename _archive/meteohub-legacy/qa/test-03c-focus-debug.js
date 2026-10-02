// Test 03c: Dig into why Enter's setTimeout focus isn't taking effect.
'use strict';
const { loadDom } = require('./qa-harness');

(async function () {
    const h = loadDom();
    await h.tick(300);

    h.window.MeteoHubStore.update((s) => {
        s.pages = [{
            id: 'p1', parentId: null, title: 'Focus Test', icon: 'doc',
            expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01',
            blocks: [{ id: 'b1', type: 'text', text: 'first' }]
        }];
        s.projects = [];
        delete s.ui;
    });
    await h.tick(50);

    const bc = h.$$('.workspace-block-content')[0];
    bc.focus();
    console.log('focused bc?', h.window.document.activeElement === bc);
    h.pressKey(bc, 'Enter');
    // Wait long enough for the setTimeout(..., 30) to fire
    await h.tick(200);

    const newBlocks = h.$$('.workspace-block-content');
    const ae = h.window.document.activeElement;
    const found = Array.from(newBlocks).find((el) => el === ae);
    console.log('blocks=' + newBlocks.length + ' ae.isBlockContent=' + !!found + ' ae.text="' + (ae && ae.textContent && ae.textContent.slice(0, 40)) + '"');
    console.log('newBlocks texts:', newBlocks.map((el) => JSON.stringify(el.textContent)));
})();