'use strict';
const assert = require('node:assert/strict');
const { loadDom, makeHostStoreFactory } = require('./qa-harness');
(async () => {
    const h = loadDom({hostStoreFactory(win) {
        const host=makeHostStoreFactory(win);
        host.seed({pages:[{id:'p1',title:'Typing',blocks:[{id:'b1',type:'text',text:''}]}],projects:[]});
        return host;
    }});
    const editor = h.$('.workspace-block-content');
    for (const value of ['a', 'ab']) {
        h.typeIn(editor, value);
        const selection=h.window.getSelection(), range=h.window.document.createRange();
        range.setStart(editor.firstChild, value.length); range.collapse(true);
        selection.removeAllRanges(); selection.addRange(range);
        const textNode=editor.firstChild;
        await h.tick(450);
        assert.equal(h.$('.workspace-block-content'), editor, 'Autosave retains the same editor node');
        assert.equal(h.window.document.activeElement, editor, 'Autosave retains focus');
        assert.equal(selection.anchorNode, textNode, 'Autosave retains caret text node');
        assert.equal(selection.anchorOffset, value.length, 'Autosave retains caret offset');
        assert.equal(h.window.MeteoHubStore.get().pages[0].blocks[0].text, value);
    }
    h.dom.window.close();
    console.log('AUTOSAVE NODE, FOCUS, CARET OK');
})().catch(e => {console.error(e);process.exitCode=1;});
