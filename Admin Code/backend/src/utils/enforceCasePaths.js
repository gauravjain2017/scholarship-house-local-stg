/**
 * Makes require() case-sensitive on Windows/macOS so local behavior matches
 * Linux (AWS Lambda). Without this, require('../Controllers/x') silently
 * succeeds on Windows and only blows up after deploy.
 *
 * Load as the very first require() in the entrypoint (dev only).
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const projectRoot = path.resolve(__dirname, '..', '..');
const dirCache = new Map();

function readDir(dir) {
  let entries = dirCache.get(dir);
  if (entries === undefined) {
    try { entries = fs.readdirSync(dir); } catch { entries = null; }
    dirCache.set(dir, entries);
  }
  return entries;
}

const NODE_MODULES = path.sep + 'node_modules' + path.sep;
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, ...rest) {
  const resolved = originalResolve.call(this, request, parent, ...rest);
  if (typeof resolved !== 'string' || !path.isAbsolute(resolved)) return resolved;
  if (resolved.includes(NODE_MODULES)) return resolved;
  if (resolved.toLowerCase().indexOf(projectRoot.toLowerCase()) !== 0) return resolved;

  const rel = path.relative(projectRoot, resolved);
  if (!rel || rel.startsWith('..')) return resolved;

  const segments = rel.split(path.sep);
  let dir = projectRoot;
  for (const seg of segments) {
    const entries = readDir(dir);
    if (!entries) break;
    if (!entries.includes(seg)) {
      const actual = entries.find(e => e.toLowerCase() === seg.toLowerCase());
      if (actual) {
        const from = parent && parent.filename ? parent.filename : '<unknown>';
        throw new Error(
          `[case-sensitive-paths] require('${request}') from ${from}\n` +
          `  expected '${seg}' but on disk it is '${actual}' (in ${dir})\n` +
          `  Works on Windows, fails on Linux/Lambda. Fix the require() path.`
        );
      }
      break;
    }
    dir = path.join(dir, seg);
  }
  return resolved;
};
