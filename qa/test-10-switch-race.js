// Test 10 (lead-hinted): page-switch save race. User is on Page A typing,
// autosave is debounced (350ms). User clicks Page B in sidebar BEFORE the
// debounce fires.
//
// Workspace.js's sidebar click handler:
//   row.addEventListener('click', function () {
//       store.update(function (s) { ensureUi(s).selectedPageId = page.id; });
//       renderSidebar();
//       renderMain();
//   });
//
// renderMain() replaces the page editor DOM. The pending debounced save
// closure captures the OLD contentEl. When the debounce fires, it reads
// contentEl.textContent (still readable from detached node) and writes via
// store.update. Test-04 confirmed this DOES persist.
//
// BUT: the click handler triggers renderMain which also re-attaches all
// block event listeners to NEW DOM. The OLD contentEl's pending debounce
// timer is still running — it'll fire ~300ms later and run store.update.
// If the user is now typing on Page B, an extra store.update mutator for
// Page A's b1 will run. That's fine (it writes to Page A's state).
//
// The real race: what if the user clicks Page B's row, then clicks BACK to
// Page A within 350ms, then the debounce fires? It'll write to Page A,
// which is fine. But what if a debounce ALSO fires for a new typing on
// Page A (a different block)? Then two debounce timers are running. Each
// captures its own contentEl. Both write correctly because they look up
// the page and block by id.
//
// The subtle defect: what if page-switch happens BEFORE the autosave timer
// fires, and the OLD block's contentEl was destroyed; if the OLD closure's
// `lastSaved` variable captured '' but the actual content was 'X', the next
// keystroke on Page B (if same code path) might compare against the OLD
// lastSaved. Actually no — renderBlock is called fresh for each block, each
// has its own `lastSaved` closure. The OLD closure doesn't interfere with
// the new block's closure because they're separate functions.
//
// So the real defect here is: focus loss on the switch itself (the user is
// mid-typing on A, clicks B — focus is lost). The save does persist (test-04).
//
// But there's a SUBTLE race in the BLOCK ENTER handler (workspace.js line
// 891-915): when user presses Enter, the handler creates a new block, calls
// renderMain, then setTimeout(... target.focus()). Between store.update
// resolution and the setTimeout firing, if the user clicks anywhere (e.g.
// a sidebar row), the focus restoration targets a node that may now be
// detached — and the user's click might land on a DIFFERENT target.
//
// In the current implementation, the focus() call runs unconditionally 30ms
// after renderMain. If the user clicks a sidebar row within 30ms, the focus
// restoration still runs (target is the new content element in the rebuilt
// DOM) — but the user's click already moved focus elsewhere. The 30ms
// timer overwrites the user's new focus. THIS IS A DEFECT.
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
                    { id: 'p1', parentId: null, title: 'Page A', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b1', type: 'text', text: 'A content' }] },
                    { id: 'p2', parentId: null, title: 'Page B', icon: 'doc', expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', blocks: [{ id: 'b2', type: 'text', text: 'B content' }] }
                ],
                projects: [], profile: {}
            });
            return fac;
        }
    });
    await h.tick(200);

    // Verify pending-save persists after switch (already covered by test-04).
    // Use realistic keystrokes (don't replace textContent wholesale).
    const bc = h.$('.workspace-block-content');
    bc.focus();
    // Append text via dispatching input events with growing textContent.
    // This simulates a real user typing.
    for (const ch of 'hello world') {
        bc.textContent = bc.textContent + ch;
        bc.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    }
    // Immediately click second page (before 350ms debounce fires)
    const rows = h.$$('.workspace-tree-row');
    h.click(rows[1]);
    await h.tick(500);
    const state = h.window.MeteoHubStore.get();
    const p1 = state.pages.find((p) => p.id === 'p1');
    if (!p1 || !p1.blocks[0].text.includes('hello world')) {
        errors.push('Pending save lost on switch: ' + JSON.stringify(p1 && p1.blocks));
    } else {
        console.log('Pending save persisted across switch: ' + p1.blocks[0].text);
    }

    // Now test the "race" defect more carefully: after Enter, focus
    // restoration may steal focus from a deliberate user click.
    // Reset to clean state.
    h.window.MeteoHubStore.update((s) => {
        s.ui.selectedPageId = 'p1';
    });
    await h.tick(50);

    const bc1 = h.$$('.workspace-block-content')[0];
    bc1.focus();
    // Press Enter — schedules a 30ms focus restoration
    h.pressKey(bc1, 'Enter');
    // Within 30ms, click the title (user wants to rename the page)
    await h.tick(10);
    const titleInput = h.$('.workspace-page-title');
    titleInput.focus();
    // Now wait past the 30ms restoration
    await h.tick(80);
    const ae = h.window.document.activeElement;
    console.log('Active element after Enter + user-click title: ' + (ae && ae.tagName + '.' + ae.className));
    if (ae && ae.classList && ae.classList.contains('workspace-block-content')) {
        errors.push('Enter handler stole focus from user-clicked title input (race defect)');
    }

    if (errors.length === 0) { console.log('SWITCH-RACE OK (defect not reproduced in single-keystroke test)'); process.exit(0); }
    console.log(JSON.stringify(errors, null, 2));
    process.exit(1);
})();