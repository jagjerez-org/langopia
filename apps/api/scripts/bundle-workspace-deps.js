#!/usr/bin/env node
/**
 * Vercel's serverless bundler does not follow workspace symlinks
 * (`node_modules/@langopia/*` -> `packages/*`). This script replaces those
 * symlinks inside `apps/api/node_modules/@langopia` with real copies of the
 * built packages so that `vercel build` can trace and include them in the
 * runtime bundle.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const targetBase = path.resolve(__dirname, '../node_modules/@langopia');
const packages = ['contracts', 'db'];

function rm(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.lstatSync(p);
  if (stat.isDirectory() || stat.isSymbolicLink()) {
    fs.rmSync(p, { recursive: true, force: true });
  } else {
    fs.unlinkSync(p);
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function materialize(name) {
  const src = path.join(repoRoot, 'packages', name);
  const dest = path.join(targetBase, name);
  rm(dest);
  fs.mkdirSync(dest, { recursive: true });

  // Only the compiled output and the manifest are needed at runtime.
  const distSrc = path.join(src, 'dist');
  const pkgSrc = path.join(src, 'package.json');
  if (!fs.existsSync(distSrc)) {
    throw new Error(`Missing build output for @langopia/${name}: ${distSrc}`);
  }
  if (!fs.existsSync(pkgSrc)) {
    throw new Error(`Missing package.json for @langopia/${name}: ${pkgSrc}`);
  }
  copyDir(distSrc, path.join(dest, 'dist'));
  fs.copyFileSync(pkgSrc, path.join(dest, 'package.json'));
  console.log(`Materialized @langopia/${name} -> ${dest}`);
}

fs.mkdirSync(targetBase, { recursive: true });
for (const name of packages) {
  materialize(name);
}
