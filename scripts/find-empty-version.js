const fs = require('fs');
const path = require('path');

const nmDir = path.join(__dirname, '..', 'node_modules');
if (!fs.existsSync(nmDir)) {
  console.log('node_modules not found');
  process.exit(0);
}

const dirs = fs.readdirSync(nmDir);
let found = 0;

for (const d of dirs) {
  const pkgPath = path.join(nmDir, d, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (!pkg.version || pkg.version.trim() === '') {
        console.log('EMPTY VERSION:', d, '→', JSON.stringify(pkg.version));
        found++;
      }
    } catch (e) {}
  }

  if (d.startsWith('@')) {
    const scopeDir = path.join(nmDir, d);
    try {
      const subs = fs.readdirSync(scopeDir);
      for (const s of subs) {
        const sp = path.join(scopeDir, s, 'package.json');
        if (fs.existsSync(sp)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(sp, 'utf8'));
            if (!pkg.version || pkg.version.trim() === '') {
              console.log('EMPTY VERSION:', `${d}/${s}`, '→', JSON.stringify(pkg.version));
              found++;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
}

// Also check for packages with bin fields and invalid versions
console.log('\n--- Packages with bin field ---');
const binConflicts = {};
for (const d of dirs) {
  if (d.startsWith('.')) continue;
  const pkgPath = path.join(nmDir, d, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.bin) {
        const bins = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : pkg.bin;
        for (const cmd of Object.keys(bins)) {
          if (!binConflicts[cmd]) binConflicts[cmd] = [];
          binConflicts[cmd].push({ name: d, version: pkg.version });
        }
      }
    } catch (e) {}
  }
  if (d.startsWith('@')) {
    try {
      const subs = fs.readdirSync(path.join(nmDir, d));
      for (const s of subs) {
        const sp = path.join(nmDir, d, s, 'package.json');
        if (fs.existsSync(sp)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(sp, 'utf8'));
            if (pkg.bin) {
              const bins = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : pkg.bin;
              for (const cmd of Object.keys(bins)) {
                if (!binConflicts[cmd]) binConflicts[cmd] = [];
                binConflicts[cmd].push({ name: `${d}/${s}`, version: pkg.version });
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
}

// Show only conflicting bin commands
for (const [cmd, pkgs] of Object.entries(binConflicts)) {
  if (pkgs.length > 1) {
    console.log(`\nBIN CONFLICT "${cmd}":`);
    for (const p of pkgs) {
      const invalid = !p.version || p.version.trim() === '';
      console.log(`  ${p.name}@${p.version || '(EMPTY)'}${invalid ? ' ← PROBLEM' : ''}`);
    }
  }
}

console.log(`\nTotal empty versions found: ${found}`);
