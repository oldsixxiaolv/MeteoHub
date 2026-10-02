// Test 03b: Focused reproduction of Enter-then-Backspace focus loss defects
'use strict';
const { loadDom } = require('./qa-harness');

(async function () {
    const errors = [];
    const h = loadDom();
    await h.tick(300);

    h.window.MeteoHubStore.update((s) => {
        s.pages = [{
            id: 'p1', parentId: null, title: 'Focus Test', icon: 'doc',
            expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01',
            blocks: [{ id: 'b1', type: 'text', text: 'first' }, { id: 'b2', type: 'text', text: 'second' }]
        }];
        s.projects = [];
        delete s.ui;
    });
    await h.tick(50);

    // Click on second block, press Enter at end — should focus NEW empty block
    const bc = h.$$('.workspace-block-content')[1];
    bc.focus();
    h.pressKey(bc, 'Enter');
    await h.tick(100);

    const newBlocks = h.$$('.workspace-block-content');
    const ae = h.window.document.activeElement;
    console.log('after Enter: blocks=' + newBlocks.length + ' active=' + (ae && ae.className) + ' text="' + (ae && ae.textContent) + '"');

    // Now press Backspace on the empty last block — focus should land on the prior block
    if (newBlocks.length === 3) {
        const last = newBlocks[2];
        last.focus();
        h.pressKey(last, 'Backspace');
        await h.tick(100);
        const ae2 = h.window.document.activeElement;
        const remaining = h.$$('.workspace-block-content');
        console.log('after Backspace: blocks=' + remaining.length + ' active=' + (ae2 && ae2.tagName + '.' + ae2.className) + ' text="' + (ae2 && ae2.textContent) + '"');
    }
})();