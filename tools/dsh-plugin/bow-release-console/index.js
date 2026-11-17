/** Host half of the bow-release-console bundle.
 *  Reads repo version/build state and exposes it to the Client panel.
 */
export const inject = [];

export function apply(ctx) {
  const fs = ctx.get('fs');
  const path = ctx.get('path');

  function readIfExists(p) {
    try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
  }

  function grepFirst(text, re) {
    if (!text) return null;
    const m = text.match(re);
    return m ? m[1] : null;
  }

  function versionSurfaces(repoRoot) {
    const surfaces = {};
    const idx = readIfExists(path.join(repoRoot, 'index.html'));
    surfaces['index.html app-version'] = grepFirst(idx, /name="app-version" content="([0-9.]+)"/);
    surfaces['index.html cache-busters'] = (idx ? (idx.match(/\?v=[0-9.]+/g) || []).length : 0);

    const sw = readIfExists(path.join(repoRoot, 'sw.js'));
    surfaces['sw.js cache'] = grepFirst(sw, /bow-v(\d+)-cache/);

    const vj = readIfExists(path.join(repoRoot, 'version.json'));
    surfaces['version.json'] = grepFirst(vj, /"v"\s*:\s*"([0-9.]+)"/);

    const pj = readIfExists(path.join(repoRoot, 'package.json'));
    surfaces['package.json'] = grepFirst(pj, /"version"\s*:\s*"([0-9.]+)"/);

    const bg = readIfExists(path.join(repoRoot, 'apk', 'android', 'app', 'build.gradle'));
    surfaces['build.gradle versionName'] = grepFirst(bg, /versionName "([0-9.]+)"/);
    surfaces['build.gradle versionCode'] = grepFirst(bg, /versionCode (\d+)/);

    const apkDir = path.join(repoRoot, 'apk', 'dist');
    let apkFile = null, apkSize = null;
    try {
      const entries = fs.readdirSync(apkDir);
      const apk = entries.find(e => e.endsWith('.apk'));
      if (apk) {
        apkFile = apk;
        apkSize = fs.statSync(path.join(apkDir, apk)).size;
      }
    } catch (e) {}
    surfaces['apk dist file'] = apkFile;
    surfaces['apk dist size (bytes)'] = apkSize;

    return surfaces;
  }

  // Expose a synchronous snapshot for the Client to read.
  ctx.provide('bowReleaseConsole', { versionSurfaces });
  return () => { ctx.provide('bowReleaseConsole', undefined); };
}
