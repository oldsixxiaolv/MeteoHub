// Test 09 (lead-hinted): continuous typing — type across an autosave flush.
// Workspace.js's block renderBlock's `save` runs debounce(350ms) then
// store.update(...).then(...).then(setSavedFlag). The store.update mutator
// runs on the host's deep-cloned draft — but workspace doesn't re-render here
// (no renderMain call in the block text save path), so DOM stays. Good.
//
// HOWEVER, when ANY OTHER code path calls renderMain() (e.g. clicking sidebar,
// tab switch, block add, etc.), the contenteditable is rebuilt and focus is
// lost UNLESS the caller explicitly restores focus.
//
// This test simulates: user types fast, the 350ms debounce fires, store.update
// goes through. Workspace's subscribe AND the meteohub:state-changed listener
// BOTH fire renderAll(). Each renderAll calls renderMain() which rebuilds the
// page editor — including the contenteditable the user is typing in.
//
// Expected (correct): no DOM rebuild during typing-induced autosave.
// Actual: every store.update triggers renderAll on both the subscribe callback
// and the event listener, which calls renderMain which rebuilds everything.
'use strict';
const { loadDom, makeHostStoreFactory } = require('./qa-harness');

(async function () {
    const errors = [];
    let factory;
    const h = loadDom({
        hostStoreFactory: (win) => {
            factory = makeHostStoreFactory(win);
            factory.seed({
                pages: [{ id: 'p1', parentId: null, title: 'T', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b1', type: 'text', text: '' }] }],
                projects: [], profile: {}
            });
            return factory;
        }
    });
    await h.tick(200);

    // Subscribe to track renderAll calls by counting how many times the
    // .workspace-block-content collection is replaced. We tag each fresh
    // element with a unique class and count distinct generations.
    let generation = 0;
    const origRenderAll = h.window.MeteoWorkspace.mount; // can't easily wrap

    // Proxy: each time renderMain destroys and recreates blocksEl children,
    // a new contenteditable element appears. Capture the first one and tag it.
    function tagFirstBlock() {
        const el = h.$('.workspace-block-content');
        if (!el) return;
        if (!el.__ws_gen) {
            el.__ws_gen = ++generation;
            el.dataset.wsGen = String(generation);
        }
    }
    tagFirstBlock();
    // After any store.update, check if the same DOM node is still there.
    const initialEl = h.$('.workspace-block-content');
    const initialGen = initialEl && initialEl.__ws_gen;

    // Type a character (simulate via dispatching 'input')
    initialEl.textContent = 'h';
    initialEl.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    // Wait past debounce (350ms)
    await h.tick(450);

    const afterEl = h.$('.workspace-block-content');
    const afterGen = afterEl && afterEl.__ws_gen;
    // Note: this is the FIRST render's block. After renderMain rebuilds,
    // there will be a NEW element with __ws_gen undefined. We re-tag on
    // each observation.
    if (afterEl && !afterEl.__ws_gen) {
        afterEl.__ws_gen = ++generation;
        afterEl.dataset.wsGen = String(generation);
    }

    console.log('initialGen=' + initialGen + ' afterGen=' + afterEl.__ws_gen + ' sameNode=' + (initialEl === afterEl));

    // The defect: workspace's mount() registers a window listener for
    // 'meteohub:state-changed' AND a subscribe listener. When the typing-
    // induced debounce fires store.update, the host dispatches the event AND
    // (in our factory) does NOT notify subscribers (subscribe is a noop).
    // So in OUR harness, only 1 renderAll fires per store.update — same as
    // a clean mount. The defect is amplified when the host ALSO has a
    // subscribe-based listener (the host's app.js does NOT use subscribe
    // for rendering; it dispatches the event and listens via window). So
    // the host's flow: 1 event listener in workspace -> 1 renderAll per update.
    //
    // But: when the mount is called twice (as test-08 simulated), the count
    // doubles. So a single typing-induced autosave in a doubly-mounted app
    // causes 2 renderMain calls -> 2 DOM rebuilds -> focus loss.

    // Demonstrate: type one char, then force-mount again, type another char.
    // Watch the DOM rebuild.
    h.window.MeteoWorkspace.mount(h.root); // leak a second listener
    h.window.MeteoWorkspace.mount(h.root); // and a third

    let totalRebuilds = 0;
    const observer = new h.window.MutationObserver((muts) => {
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n.nodeType === 1 && n.classList && n.classList.contains('workspace-block-content')) {
                    totalRebuilds++;
                }
            }
        }
    });
    observer.observe(h.root, { childList: true, subtree: true });

    // Type a character to trigger debounced autosave
    const bc = h.$$('.workspace-block-content')[0];
    bc.textContent = 'hello';
    bc.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await h.tick(450);

    console.log('block-content rebuilds after 1 keystroke (with 3 leaked listeners): ' + totalRebuilds);

    if (totalRebuilds >= 3) {
        errors.push('With leaked listeners, 1 keystroke rebuilt block ' + totalRebuilds + ' times — focus/cursor will be lost on every autosave');
    }

    if (errors.length === 0) { console.log('TYPING-ACROSS-AUTOSAVE OK'); process.exit(0); }
    console.log(JSON.stringify(errors, null, 2));
    process.exit(1);
})();