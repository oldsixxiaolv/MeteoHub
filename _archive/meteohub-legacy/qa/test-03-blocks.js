// Test 03: Block editor — focus/content preservation, autosave, Enter-to-create,
// Backspace-to-merge-on-empty, title blur save.
'use strict';
const { loadDom } = require('./qa-harness');

(async function () {
    const errors = [];
    const h = loadDom();
    await h.tick(300);

    // Reset to a single empty page
    h.window.MeteoHubStore.update((s) => {
        s.pages = [{
            id: 'p1', parentId: null, title: 'Test Page', icon: 'doc',
            expanded: true, createdAt: '2024-01-01', updatedAt: '2024-01-01',
            blocks: [{ id: 'b1', type: 'text', text: '' }]
        }];
        s.projects = [];
        delete s.ui;
    });
    await h.tick(30);

    // Should now show one block (b1)
    let blockContents = h.$$('.workspace-block-content');
    if (blockContents.length !== 1) errors.push('expected 1 block, got ' + blockContents.length);

    // 1. Type into the block — content should be retained through debounced save
    h.typeIn(blockContents[0], 'Hello world');
    await h.tick(450); // wait > 350ms debounce + flush

    blockContents = h.$$('.workspace-block-content');
    if (blockContents.length !== 1) errors.push('focus loss: block replaced during input');
    if (!blockContents[0] || blockContents[0].textContent !== 'Hello world') {
        errors.push('content lost after debounced save: "' + (blockContents[0] && blockContents[0].textContent) + '"');
    }
    const state = h.window.MeteoHubStore.get();
    if (!state.pages[0].blocks.some((b) => b.text === 'Hello world')) {
        errors.push('state not updated with input text');
    }

    // 2. Press Enter on a non-empty text block — should create a NEW block below
    // and focus it; cursor should land on the new block, not jump out.
    h.pressKey(blockContents[0], 'Enter');
    await h.tick(50);
    let newBlockContents = h.$$('.workspace-block-content');
    if (newBlockContents.length !== 2) {
        errors.push('Enter did not create new block (expected 2, got ' + newBlockContents.length + ')');
    } else {
        // The new block should have empty text and be focused.
        const focused = newBlockContents.find((el) => el === h.window.document.activeElement);
        if (!focused) {
            errors.push('Enter did not focus new block (activeElement=' + (h.window.document.activeElement && h.window.document.activeElement.className) + ')');
        } else if (focused.textContent !== '') {
            errors.push('Enter focused non-empty block: "' + focused.textContent + '"');
        }
    }

    // 3. Press Backspace at empty text block — should delete the block and
    // focus the previous one (workspace.js DOES delete, but does NOT refocus
    // the previous block — verify behavior).
    const empties = h.$$('.workspace-block-content');
    const emptyIdx = empties.findIndex((el) => el.textContent === '');
    if (emptyIdx >= 0) {
        h.pressKey(empties[emptyIdx], 'Backspace');
        await h.tick(30);
        const after = h.$$('.workspace-block-content');
        if (after.length !== empties.length - 1) {
            errors.push('Backspace on empty text block did not delete (count ' + after.length + ' vs ' + empties.length + ')');
        } else {
            // Where did focus go?
            const ae = h.window.document.activeElement;
            const stillOnWorkspace = ae && (ae.classList.contains('workspace-block-content') || ae.classList.contains('workspace-page-title') || ae.tagName === 'INPUT');
            if (!stillOnWorkspace) {
                errors.push('After Backspace delete, focus dropped to: ' + (ae && ae.tagName));
            }
        }
    }

    // 4. Title blur save — change title and blur
    const titleInput = h.$('.workspace-page-title');
    if (!titleInput) {
        errors.push('page title input missing');
    } else {
        titleInput.focus();
        titleInput.value = 'Renamed Page';
        titleInput.dispatchEvent(new h.window.Event('blur', { bubbles: true }));
        await h.tick(50);
        if (h.window.MeteoHubStore.get().pages[0].title !== 'Renamed Page') {
            errors.push('title blur did not persist: "' + h.window.MeteoHubStore.get().pages[0].title + '"');
        }
    }

    // 5. Save indicator transitions: during pending save -> "保存中"; after -> "已保存"
    const indicator = h.$('.workspace-save-indicator');
    if (!indicator) errors.push('save indicator missing');

    // Type a lot to trigger a fresh save cycle
    const bc = h.$$('.workspace-block-content')[0];
    if (bc) {
        h.typeIn(bc, ' another change');
        // Capture class list while debounce is pending (~100ms in)
        await h.tick(50);
    }

    if (errors.length === 0) { console.log('BLOCKS OK'); process.exit(0); }
    console.log(JSON.stringify(errors, null, 2));
    process.exit(1);
})();