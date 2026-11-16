# Deployment and Search-Replace Notes

## 1. Local vs Production Parity

The site is served locally at:
- **Local URL**: `http://al-khatib.local`
- **Theme Path**: `~/Local Sites/al-khatib/app/public/wp-content/themes/blankslate/`
- **Table prefix**: `hcp_`

Production URL:
- **Production URL**: `https://al-khatib-glossar.com`

### Search-Replace for Database Migration

The Local database (`docs/redesign/backups/al-khatib-phase0.sql`) was imported from production and search-replaced so that post bodies, ACF fields, and media attachment URLs point to `http://al-khatib.local`.

If ever migrating database state back to production (or staging):
```bash
# Using WP-CLI within the Local site shell:
wp search-replace 'http://al-khatib.local' 'https://al-khatib-glossar.com' --all-tables --precise --recurse-objects --skip-columns=guid
```
Or with dry run first:
```bash
wp search-replace 'http://al-khatib.local' 'https://al-khatib-glossar.com' --all-tables --dry-run
```

**CAUTION:** Never assume the database can simply be copied to production without reversing this search-replace or re-exporting. Always back up production first.

## 2. No Hard-Coded Hosts

The frontend bundle uses `window.AKG`:
```javascript
window.AKG = {
    apiBase: '',       // Base URL for WP REST API (empty string = current origin)
    themeBase: '',     // Base URL for theme assets (empty string = current origin)
    defaultLang: 'de'  // Default language ('de' | 'en' | 'ar')
};
```
In `map.php`, `window.AKG.themeBase` is automatically initialized with `get_stylesheet_directory_uri()` and `apiBase` with `home_url('/')`. This prevents hardcoded host mismatches between local and production environments.

## 3. Local Deployment Workflow

To build the bundle and deploy to the Local WordPress installation:
```bash
./tools/deploy.sh
```
This executes:
1. `npm run build`
2. Syncs `theme/` to `~/Local Sites/al-khatib/app/public/wp-content/themes/blankslate/`
3. Syncs `dist/assets/` to `.../themes/blankslate/assets/`
4. Syncs `config.js`
5. Syncs `public/map-assets/` without `--delete`
6. Never touches `wp-content/uploads/`

## 4. Headless Testing

Before accepting any phase or deployment:
```bash
# Desktop 1440x900
node tools/shot.mjs http://al-khatib.local docs/redesign/progress/phase-N-desktop --width=1440 --height=900

# Mobile 390x844
node tools/shot.mjs http://al-khatib.local docs/redesign/progress/phase-N-mobile --width=390 --height=844 --mobile
```
Verify zero console errors and that all interactive components respond properly.

## 5. Production (`https://al-khatib-glossar.com`)

Hosting: Namecheap shared hosting (cPanel, LiteSpeed, PHP 8.5). The redesign went live on 2026-11-16.

**Deploys are theme-only.** The production database is the source of truth for content; no post has been
edited since 2023-05-22 and all 36 ACF positions/rotations matched the Local copy at deploy time. Do not push
the Local database to production (see §1).

### Deploying a new build
1. Back up the live theme in cPanel (copy `public_html/wp-content/themes/blankslate` to `~/theme-backups/<date>/`).
2. `./tools/package-theme.sh` → `blankslate-<date>.zip` (~7 MB). It ships the theme PHP/CSS, fonts, images,
   the Vite bundle, `config.js` and only the three `*.opt.glb` files.
3. WP Admin → Appearance → Themes → Add New → Upload Theme → **Replace installed with uploaded**.
4. Verify: `/wp-json/akg/v1/glossary` returns 36 entries, the map loads with 35 glyphs, no console errors.
   The glossary manifest is cached in the `akg_glossary_manifest_v1` transient (12 h, cleared on post save).

### Notes
- `theme/style.css` carries `Update URI: false`. The slug `blankslate` collides with the BlankSlate theme on
  wordpress.org; without this header WordPress offers an "update" that would replace the custom theme.
- Server-side backups made on 2026-11-16 (outside `public_html`): `~/theme-backups/2026-11-16-before-redesign/`
  (old 2023 theme), `~/db-backups/` (DB dump before plugin updates), `~/plugin-backups/` (pre-update copies of
  active plugins, plus ~20 unused inactive plugins removed from the site), `~/log-archive/`.
