# GitHub Repository Rename Guide

## Summary

**Current Name:** `salemwch/saveeo` **New Name:** `salemwch/too-fresh-to-waste`
**Status:** Ready to rename

---

## Complete Rename Process (5 minutes)

### Step 1: Rename on GitHub (2 minutes)

⚠️ **Important:** GitHub repository names must use lowercase and hyphens (not
spaces).

1. **Visit:** https://github.com/salemwch/saveeo
2. **Click:** "Settings" tab (top menu)
3. **Scroll down** to "Repository name" section (near the top)
4. **Enter new name:** `too-fresh-to-waste`
5. **Read the warning** (GitHub shows what will happen)
6. **Click:** "Rename" button
7. **Confirm** when prompted

✅ **Done!** GitHub will automatically redirect old links for a while.

---

### Step 2: Update Local Git Remote (1 minute)

Open your terminal in `C:\WFA` and run:

```bash
# Check current remote URL
git remote -v
```

**Current output:**

```
origin  https://github.com/salemwch/saveeo.git (fetch)
origin  https://github.com/salemwch/saveeo.git (push)
```

**Update the remote URL:**

```bash
git remote set-url origin https://github.com/salemwch/too-fresh-to-waste.git
```

**Verify the change:**

```bash
git remote -v
```

**Expected output:**

```
origin  https://github.com/salemwch/too-fresh-to-waste.git (fetch)
origin  https://github.com/salemwch/too-fresh-to-waste.git (push)
```

**Test the connection:**

```bash
git pull origin master
```

**Expected:** Should work without errors.

---

### Step 3: Commit Updated Documentation (2 minutes)

I've already updated all references in your documentation files:

- ✅ `DEPLOYMENT_QUICKSTART.md`
- ✅ `WEB_DEPLOYMENT_GUIDE.md`
- ✅ `NAMECHEAP_DEPLOYMENT_GUIDE.md`

Now commit these changes:

```bash
# Stage all updated files
git add DEPLOYMENT_QUICKSTART.md WEB_DEPLOYMENT_GUIDE.md NAMECHEAP_DEPLOYMENT_GUIDE.md REPOSITORY_RENAME_GUIDE.md

# Commit the changes
git commit -m "docs: update repository references from saveeo to too-fresh-to-waste"

# Push to GitHub
git push origin master
```

---

## What Changed

### Files Updated

- `DEPLOYMENT_QUICKSTART.md` - All deployment instructions
- `WEB_DEPLOYMENT_GUIDE.md` - All Vercel/Netlify references
- `NAMECHEAP_DEPLOYMENT_GUIDE.md` - All VPS setup scripts
- `REPOSITORY_RENAME_GUIDE.md` - This guide (new)

### References Updated

- Repository URLs: `saveeo` → `too-fresh-to-waste`
- Vercel URLs: `saveeo.vercel.app` → `too-fresh-to-waste.vercel.app`
- GitHub Pages URLs: Updated to new repository name
- All deployment scripts and paths

---

## Important Notes

### ✅ What Still Works

- All existing Vercel deployments (if any)
- All existing git operations
- All local development
- GitHub automatically redirects old URLs for a while

### ⚠️ What to Update Later

- **Vercel Project Settings** (after you deploy):
  - The project will still reference old repo name initially
  - You can update this in Vercel Settings → General → Repository

- **GitHub Actions** (if you had any workflows running):
  - Will continue to work automatically with new name

- **External Services** pointing to your GitHub repo:
  - Update any badges, links, or integrations that reference the old name

---

## Troubleshooting

### "Repository not found" error when pushing

**Cause:** Local git remote still points to old name

**Solution:**

```bash
git remote set-url origin https://github.com/salemwch/too-fresh-to-waste.git
git pull origin master
git push origin master
```

### Old URLs still work

**Expected:** GitHub redirects `saveeo` → `too-fresh-to-waste` automatically for
a while.

**Recommendation:** Update your local remote anyway (Step 2 above) to avoid
future issues.

### Collaborators can't access repository

**Cause:** They need to update their local git remotes too.

**Solution:** Share this guide with them and they should run Step 2.

---

## Verification Checklist

After completing all steps:

- [ ] Repository name shows `too-fresh-to-waste` on GitHub
- [ ] `git remote -v` shows new URL
- [ ] `git pull origin master` works
- [ ] `git push origin master` works
- [ ] All documentation files updated and committed
- [ ] Can access https://github.com/salemwch/too-fresh-to-waste

---

## Next Steps

After renaming, you're ready to deploy:

1. **Follow deployment guide:** See `DEPLOYMENT_QUICKSTART.md`
2. **Deploy to Vercel:** Will create new project with correct name
3. **Configure DNS:** Point toofreshtowaste.com to your deployment

---

## Rollback (If Needed)

If you want to undo the rename:

1. Go to https://github.com/salemwch/too-fresh-to-waste/settings
2. Rename back to `saveeo`
3. Update local remote:
   `git remote set-url origin https://github.com/salemwch/saveeo.git`

**Note:** Can only be done if no one else has created a repository with the old
name.

---

## Sources

- GitHub Repository Rename:
  https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository
- Git Remote Management:
  https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes
