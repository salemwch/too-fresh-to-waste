#!/usr/bin/env node
/**
 * Fails when R8 receives a member-less `-keep class` rule nobody has reviewed
 * under AGP 9's strict keep-rule semantics.
 *
 * AGP 9 sets android.r8.strictFullModeForKeepRules=true: `-keep class A` no longer
 * keeps A's default constructor. Library consumer rules written before AGP 9
 * relied on it. The first RN 0.87 / AGP 9.2.1 release build crashed at launch
 * because WorkManager's Room database (WorkDatabase_Impl) had lost its
 * constructor, and Firebase could not instantiate its registrars. Type-check,
 * lint, Jest and the debug build were all green: only a minified build that is
 * actually launched shows it.
 *
 * Every member-less rule in R8's merged configuration must be listed below with a
 * decision. `restored` rules must have their `{ <init>(); }` counterpart in
 * android/app/proguard-rules.pro. A new library, or a library changing its rule
 * text, fails this check until someone decides whether its classes are created
 * by reflection through a no-arg constructor.
 *
 * Source: https://developer.android.com/build/releases/agp-9-0-0-release-notes
 *
 * Usage (after a release build of the variant):
 *   pnpm --filter @foodwaste/mobile check:r8-keep-rules [variant]   (default productionRelease)
 */
const fs = require('fs');
const path = require('path');

const ANDROID = path.resolve(__dirname, '../android');
const variant = process.argv[2] || 'productionRelease';
const configFile = path.join(ANDROID, 'app/build/outputs/mapping', variant, 'configuration.txt');
const appRules = fs.readFileSync(path.join(ANDROID, 'app/proguard-rules.pro'), 'utf8');

// Decision for every member-less rule seen as of RN 0.87.1 / AGP 9.2.1 (2026-10-05).
// restored: the library creates the class reflectively via its no-arg constructor.
// none:     name-only keep, or the class is constructed directly / via CREATOR / via a
//           constructor another (member) rule already keeps.
const REVIEWED = {
  '-keep class * extends androidx.room.RoomDatabase': 'restored',
  '-keep class * implements com.google.firebase.components.ComponentRegistrar': 'restored',
  '-keep class * extends androidx.work.InputMerger': 'restored',
  '-keep public class * implements com.bumptech.glide.module.GlideModule': 'restored',
  '-keep class * extends androidx.work.Worker': 'none', // (Context, WorkerParameters) ctor kept by WorkManager's member rule
  '-keep class androidx.work.WorkerParameters': 'none',
  '-keep class * implements androidx.versionedparcelable.VersionedParcelable': 'none',
  '-keep public class androidx.versionedparcelable.ParcelImpl': 'none',
  '-keep class androidx.window.layout.adapter.sidecar.SidecarCompat$TranslatingCallback,': 'none',
  '-keep class com.google.android.gms.common.internal.ReflectedParcelable': 'none',
  '-keep public class com.google.android.gms.auth.api.signin.RevocationBoundService': 'none', // manifest service: AGP keeps its <init>
  '-keep public class com.google.vending.licensing.ILicensingService': 'none',
  '-keep public class com.android.vending.licensing.ILicensingService': 'none',
  '-keep public class com.google.android.vending.licensing.ILicensingService': 'none',
  '-keep class android.support.annotation.Keep': 'none',
  '-keep,allowshrinking interface com.google.firebase.components.ComponentRegistrar': 'none',
  '-keep,allowshrinking,allowobfuscation class * extends java.lang.Throwable': 'none',
};

if (!fs.existsSync(configFile)) {
  console.error(`No R8 configuration for "${variant}" at ${configFile}.\nRun a release build of that variant first.`);
  process.exit(1);
}

const lines = fs.readFileSync(configFile, 'utf8').split(/\r?\n/);
const found = new Map(); // rule -> source
let source = '(app)';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const header = line.match(/^# The proguard configuration file for the following section is (.*)$/);
  if (header) {
    source = header[1].replace(/ \(extracted file.*$/, '');
    continue;
  }
  // Annotation keeps (@interface) protect the annotation type itself, not instances.
  if (!/^-keep(,[a-z]+)*\s+(public\s+|final\s+|abstract\s+)*(class|interface|enum)\s/.test(line)) continue;
  if (line.includes('{')) continue;
  let j = i + 1;
  while (j < lines.length && lines[j].trim() === '') j++;
  if (j < lines.length && lines[j].trim().startsWith('{')) continue;
  found.set(line.trim(), source);
}

const problems = [];
for (const [rule, src] of found) {
  const decision = REVIEWED[rule];
  if (decision === undefined) {
    problems.push(`UNREVIEWED  ${rule}\n            from ${src}`);
  } else if (decision === 'restored') {
    const spec = rule.replace(/^-keep\s+/, '');
    if (!appRules.includes(`-keep ${spec} { <init>(); }`)) {
      problems.push(`NOT RESTORED  ${rule}\n            expected "-keep ${spec} { <init>(); }" in android/app/proguard-rules.pro`);
    }
  }
}

if (problems.length > 0) {
  console.error(`R8 keep rules (${variant}): ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    '\nFor each unreviewed rule, find out whether the library instantiates the matched classes\n' +
      'by reflection through a no-arg constructor. If it does, add `{ <init>(); }` to a copy of\n' +
      'the rule in android/app/proguard-rules.pro and mark it `restored` here; otherwise mark it\n' +
      '`none` with the reason.',
  );
  process.exit(1);
}
console.log(`R8 keep rules (${variant}): ${found.size} member-less rules, all reviewed; restorations present.`);
