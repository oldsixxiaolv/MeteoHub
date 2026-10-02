// /Volumes/Kingston/Mac/MeteoHub/scripts/lighthouse-runner.js
// Phase 2B.2: run real Lighthouse on 3 pages × desktop + mobile, capture JSON.
//
// Usage:
//   1. Start local server:  cd _site && python3 -m http.server 8765
//   2. Run:                 NODE_PATH=/tmp/screenshot-tool/node_modules node scripts/lighthouse-runner.js
//
// Lighthouse lives in /tmp/screenshot-tool/node_modules/lighthouse.
// Outputs: docs/lighthouse/{slug}-{desktop|mobile}.json + a summary table.

const lighthouse = require('lighthouse').default || require('lighthouse');
const fs         = require('fs');
const path       = require('path');

const OUT_DIR = '/Volumes/Kingston/Mac/MeteoHub/docs/lighthouse';
const PORT   = process.env.METEO_PORT || '8765';
const BASE   = `http://localhost:${PORT}${process.env.METEO_PREFIX || '/MeteoHub'}`;

const targets = [
  { slug: 'home',          url: BASE + '/' },
  { slug: 'papers',        url: BASE + '/papers/' },
  { slug: 'paper-detail',  url: BASE + '/papers/trmm-lyu-2026/' },
];

const presets = [
  { tag: 'desktop', config: { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 }, throttlingMethod: 'simulate' } } },
  { tag: 'mobile',  config: null /* default = mobile */ },
];

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const results = [];

  for (const t of targets) {
    for (const p of presets) {
      const flags = {
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: '--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage',
      };
      if (p.config) flags.configOverrides = p.config;

      const runnerResult = await lighthouse(t.url, flags);
      const json = runnerResult.lhr;
      const out = path.join(OUT_DIR, `${t.slug}-${p.tag}.json`);
      fs.writeFileSync(out, JSON.stringify(json, null, 2));

      const score = (k) => Math.round((json.categories[k]?.score || 0) * 100);

      results.push({
        page: t.slug,
        preset: p.tag,
        perf: score('performance'),
        a11y: score('accessibility'),
        bp:   score('best-practices'),
        seo:  score('seo'),
        FCP:  json.audits['first-contentful-paint']?.displayValue || 'n/a',
        LCP:  json.audits['largest-contentful-paint']?.displayValue || 'n/a',
        TBT:  json.audits['total-blocking-time']?.displayValue || 'n/a',
        CLS:  json.audits['cumulative-layout-shift']?.displayValue || 'n/a',
        TTI:  json.audits['interactive']?.displayValue || 'n/a',
        SI:   json.audits['speed-index']?.displayValue || 'n/a',
        warnings: (json.runWarnings || []).length,
      });

      const r = results[results.length - 1];
      console.log(`  ✓ ${t.slug}-${p.tag}.json  (perf=${r.perf} a11y=${r.a11y} bp=${r.bp} seo=${r.seo})  warnings=${r.warnings}`);
    }
  }

  // Print summary table
  console.log('\n=== Lighthouse summary ===');
  console.log('page'.padEnd(15) + 'preset'.padEnd(8) + 'perf a11y  bp  seo | FCP   LCP   TBT    CLS  TTI   SI');
  console.log('-'.repeat(95));
  for (const r of results) {
    console.log(
      r.page.padEnd(15) +
      r.preset.padEnd(8) +
      String(r.perf).padStart(3) + '   ' +
      String(r.a11y).padStart(3) + '   ' +
      String(r.bp).padStart(3) + ' ' +
      String(r.seo).padStart(3) + ' | ' +
      String(r.FCP).padEnd(6) +
      String(r.LCP).padEnd(6) +
      String(r.TBT).padEnd(6) +
      String(r.CLS).padEnd(5) +
      String(r.TTI).padEnd(5) +
      String(r.SI)
    );
  }

  fs.writeFileSync(path.join(OUT_DIR, '_summary.json'), JSON.stringify(results, null, 2));
})();
