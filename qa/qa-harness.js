// QA harness for workspace.js — loads the module into a jsdom-backed page,
// loads it (window.MeteoWorkspace.mount(root)), and exposes helpers used by
// the QA test files. We deliberately do NOT modify workspace.js or workspace.css.
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_JS = fs.readFileSync(path.join(ROOT, 'workspace.js'), 'utf8');
const WORKSPACE_CSS = fs.readFileSync(path.join(ROOT, 'workspace.css'), 'utf8');

function loadDom(opts) {
    opts = opts || {};
    const html = `<!doctype html><html><head><meta charset="utf-8"></head>
        <body>
            <div id="workspace-root"></div>
            <style>${WORKSPACE_CSS}</style>
        </body></html>`;

    const vc = new VirtualConsole();
    if (opts.captureConsole) {
        vc.on('error', (...a) => console.error('[jsdom error]', ...a));
        vc.on('warn', (...a) => console.warn('[jsdom warn]', ...a));
        vc.on('jsdomError', (...a) => console.warn('[jsdom err]', ...a));
    }

    const dom = new JSDOM(html, { runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
    const { window } = dom;

    // Capture downloaded blobs for export assertion.
    const blobStore = new Map();
    let blobCounter = 0;
    window.URL.createObjectURL = function (blob) {
        const id = 'blob:fake://' + (++blobCounter);
        blobStore.set(id, blob);
        return id;
    };
    window.URL.revokeObjectURL = function (id) { blobStore.delete(id); };
    window.__lastBlob = () => {
        if (blobCounter === 0) return null;
        return blobStore.get('blob:fake://' + blobCounter);
    };

    // jsdom doesn't implement document.execCommand. Workspace.js uses it on Tab
    // inside code blocks only. We wrap to avoid crashes in the harness.
    if (!window.document.execCommand) {
        window.document.execCommand = function () { return false; };
    }

    // Install a host-style store BEFORE evaluating workspace.js, so its
    // ensureStore() picks it up.
    if (opts.hostStoreFactory) {
        window.MeteoHubStore = opts.hostStoreFactory(window);
    }

    // Evaluate workspace.js
    window.eval(WORKSPACE_JS);

    const root = window.document.getElementById('workspace-root');
    window.MeteoWorkspace.mount(root);

    return {
        dom, window, root,
        tick: (ms) => new Promise((r) => setTimeout(r, ms)),
        $: (sel) => root.querySelector(sel),
        $$: (sel) => Array.from(root.querySelectorAll(sel)),
        text: (sel) => { const e = root.querySelector(sel); return e ? e.textContent.trim() : null; },
        typeIn: (el, value) => {
            el.focus();
            el.textContent = value;
            el.dispatchEvent(new window.Event('input', { bubbles: true }));
        },
        pressKey: (el, key, opts2) => {
            const ev = new window.KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, opts2 || {}));
            el.dispatchEvent(ev);
            return !ev.defaultPrevented;
        },
        click: (el) => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); },
        lastBlob: () => window.__lastBlob()
    };
}

// Simulates the app.js Store contract: deep-clone before mutator, dispatch
// 'meteohub:state-changed' after a successful update, and optionally roll back
// on conflict (toggleable via .conflictNext()).
function makeHostStoreFactory(window) {
    let state = {
        pages: [], projects: [],
        profile: {},
        publications: [], questions: [], researchers: [], following: [], bookmarks: []
    };
    let conflictNext = false;
    return {
        get: () => state,
        update: async (mutator) => {
            if (conflictNext) {
                conflictNext = false;
                return Promise.reject(new Error('Conflict'));
            }
            const draft = JSON.parse(JSON.stringify(state));
            const res = mutator(draft);
            if (res && typeof res.then === 'function') await res;
            state = draft;
            window.dispatchEvent(new window.CustomEvent('meteohub:state-changed', { detail: { state } }));
            return Promise.resolve();
        },
        subscribe: () => () => {},
        triggerConflict: () => { conflictNext = true; },
        seed: (s) => { state = JSON.parse(JSON.stringify(s)); }
    };
}

module.exports = { loadDom, makeHostStoreFactory };