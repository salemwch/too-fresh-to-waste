# Source masters

Full-resolution originals for illustrations that ship in
`apps/mobile/src/assets/images/` as density-capped WebP.

This directory is **outside the bundled asset tree on purpose**. Metro only
bundles what is imported, but keeping the masters here means nobody can
accidentally `import` a 4000x4000 PNG into a 90dp view again.

`box-card.png` (4000x4000) and `save-lives.png` (5824x3264) together added
**11.4 MiB to every download** while rendering at 90x90dp and 90x80dp - roughly
120x more pixels than any Android device can display, and ~64 MB of decoded
bitmap heap on a screen low-end phones have to render.

Regenerate the shipped variants with:

    pnpm --filter @foodwaste/mobile assets:optimize

The directory is gitignored (multi-MB binaries belong in design storage or Git
LFS, per the "Large assets" block in the root `.gitignore`). Archive these
masters in the design system store; do not rely on a working copy.
