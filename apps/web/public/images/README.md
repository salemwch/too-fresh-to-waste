# Image Assets for Too Fresh To Waste Web App

## Required Logo Files

Place your logo files in this directory with these exact filenames:

### 1. Green Header Logo (for initial state - green background)

**Filename:** `green-header-center-logo.png`

- **Background:** Transparent
- **Logo color:** Should work on green (#076452) background
- **Recommended size:** 160px width × 80px height (or proportional)
- **Format:** PNG with transparency

### 2. White Header Logo (for scrolled state - light background)

**Filename:** `white-Header-center-logo.png`

- **Background:** Transparent
- **Logo color:** Should work on light (#f9f3f0) background
- **Recommended size:** 160px width × 80px height (or proportional)
- **Format:** PNG with transparency

---

## Current Status

⚠️ **Placeholder images are in use** - Replace with actual logos for production

## How to Add Your Logos

1. Export your logos from your design tool (Figma, Adobe XD, etc.)
2. Ensure they have transparent backgrounds
3. Name them exactly as shown above
4. Place them in: `C:\WFA\apps\web\public\images\`
5. Restart the dev server if it's running

---

## Additional Assets Needed (from content.md)

### Section 2

- **Bag.png** - Large bag illustration for the features section

### Section Reference

- **nowjpg.png** - Reference image showing bag layout with 4 titles

---

## Image Optimization

Next.js automatically optimizes images using the `next/image` component:

- ✅ Automatic WebP/AVIF conversion
- ✅ Responsive sizing
- ✅ Lazy loading
- ✅ Blur placeholder support

For best performance:

- Use PNG for logos with transparency
- Use JPG for photos
- Keep file sizes under 200KB when possible
- Provide 2x resolution for retina displays
