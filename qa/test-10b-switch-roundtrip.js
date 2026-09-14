// Test 10b: page-switch save race — what if the user is mid-typing, the
// sidebar click triggers renderMain which destroys the block, AND the
// pending debounced save fires later? The save's closure has the OLD
// contentEl (detached). Reading .textContent on a detached node is fine,
// but the user has lost focus and any subsequent typing goes to a NEW
// contentEl on the new page (or the same page if the click was on the same
// row). The save still writes the captured text correctly.
//
// Real concern: in the click handler, store.update mutator runs and dispatches
// meteohub:state-changed which triggers renderAll which rebuilds the page
// editor for Page B. If the debounced save fires AFTER, it writes to
// Page A's state — that's correct.
//
// What if the user is on Page A, types, clicks Page B, then within ~300ms
// clicks BACK to Page A? renderMain rebuilds Page A's editor (since
// selectedPageId was just changed back). The OLD contentEl from the
// original Page A render is gone; the debounced save will fire and write
// the captured text. But the NEW render's blocks don't have any pending
// autosave for those block IDs — the OLD closure's lastSaved is 'X' and
// the new renderBlock's lastSaved is also initialized to 'X' (from the
// persisted state). So everything aligns.
//
// But what if a new render's contentEl is REBUILT by an unrelated store.update
// (e.g. another module mutates state)? Then ALL focused contentEditable
// elements are destroyed mid-typing. THIS IS THE FOCUS-LOSS BUG, already
// documented in test-09b.
'use strict';
const { loadDom, makeHostStoreFactory } = require('./qa-harness');

(async function () {
    const errors = [];
    let fac;
    const h = loadDom({
        hostStoreFactory: (win) => {
            fac = makeHostStoreFactory(win);
            fac.seed({
                pages: [
                    { id: 'p1', parentId: null, title: 'Page A', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b1', type: 'text', text: 'A' }] },
                    { id: 'p2', parentId: null, title: 'Page B', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b2', type: 'text', text: 'B' }] }
                ],
                projects: [], profile: {}
            });
            return fac;
        }
    });
    await h.tick(200);

    // Switch to Page B first to set up
    h.window.MeteoHubStore.update((s) => { s.ui = { view: 'pages', projectView: 'table', selectedPageId: 'p1', search: '' }; });
    await h.tick(50);

    const bc1 = h.$('.workspace-block-content');
    bc1.focus();
    // Type 5 characters rapidly
    for (const ch of 'world') {
        bc1.textContent = bc1.textContent + ch;
        bc1.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    }
    // Right before debounce, click Page B in sidebar
    const rows = h.$$('.workspace-tree-row');
    h.click(rows[1]);
    // Wait past debounce
    await h.tick(500);
    // Click back to Page A
    const rows2 = h.$$('.workspace-tree-row');
    h.click(rows2[0]);
    await h.tick(500);

    const state = h.window.MeteoHubStore.get();
    const p1 = state.pages.find((p) => p.id === 'p1');
    console.log('Page A block after switch-A->B->A: ' + p1.blocks[0].text);
    if (!p1.blocks[0].text.includes('world')) {
        errors.push('After rapid A->B->A switch, typed text was lost');
    }
    if (errors.length === 0) { console.log('SWITCH-A-B-A OK'); process.exit(0); }
    console.log(JSON.stringify(errors, null, 2));
    process.exit(1);
})();