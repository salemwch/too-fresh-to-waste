# Favicon Generation Instructions

## Current Status

- ✅ SVG favicon created as temporary fallback (`/favicon.svg`)
- ✅ Site manifest created (`/site.webmanifest`)
- ⚠️ PNG favicon files need to be generated from your logo

## Missing PNG Files

The following files are referenced in `layout.tsx` but need to be generated:

- `/favicon-16x16.png` (16x16 pixels)
- `/favicon-32x32.png` (32x32 pixels)
- `/favicon.ico` (multi-size ICO: 16x16, 32x32, 48x48)
- `/apple-touch-icon.png` (180x180 pixels)

## How to Generate Favicons

### Option 1: Online Tool (Recommended)

1. Go to [RealFaviconGenerator](https://realfavicongenerator.net/)
2. Upload your logo: `apps/web/src/assets/images/header-green-logo.svg` or
   create a square version
3. Customize colors if needed (theme color: #076452, background: #f9f3f0)
4. Generate and download the favicon package
5. Extract all files to `apps/web/public/` (overwrite existing site.webmanifest
   if needed)

### Option 2: Manual Creation with ImageMagick

```bash
# Install ImageMagick if not already installed
# From a square PNG source (create one from your SVG first)

# Create 16x16
convert logo-square.png -resize 16x16 favicon-16x16.png

# Create 32x32
convert logo-square.png -resize 32x32 favicon-32x32.png

# Create Apple touch icon
convert logo-square.png -resize 180x180 apple-touch-icon.png

# Create multi-size ICO
convert logo-square.png -resize 16x16 -resize 32x32 -resize 48x48 favicon.ico
```

### Option 3: Use Figma/Photoshop

1. Open your logo SVG in Figma or Photoshop
2. Create a square artboard (512x512 recommended)
3. Export as PNG at different sizes (16x16, 32x32, 180x180)
4. Use an online ICO converter for favicon.ico

## Verification

After generating the favicons, restart your Next.js dev server:

```bash
# From project root
pnpm web dev

# Or if running full dev
pnpm dev
```

Then check browser console - the 404 errors should be gone.

## Theme Colors Reference

- Primary Green: `#005250`
- Background Cream: `#f9f3f0`
- Light Green: `#90D26D`
