# Oles Matsyshyn Personal Website

A plain static personal website for Oles Matsyshyn, built with HTML, CSS, and minimal vanilla JavaScript. It is designed to work on GitHub Pages and can also be opened directly from `index.html`.

## Open Locally

Double-click `index.html` in Finder, or open it from your browser with:

```text
index.html
```

## Run a Local Server

From this folder, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy on GitHub Pages

1. Create a GitHub repository.
2. Push these files to the repository.
3. Go to `Settings -> Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Choose `main` and `/root`.
6. Save.

GitHub Pages will publish the site after the deployment finishes.

## Continue Development on Another PC

Clone the complete website and WellCanvas source repository:

```bash
git clone git@github.com:OlesMatsyshyn/website.git Web
cd Web
```

The static personal website lives at the repository root. The editable
WellCanvas app source lives in `wellcanvas-source/`, and the generated GitHub
Pages app build lives in `WellCanvas/`.

Test the whole website locally through HTTP:

```bash
node scripts/serve-site.mjs
```

Then open `http://127.0.0.1:4173/website/`. This mirrors the GitHub Pages
repository path closely enough for app links such as `/website/Verba/`; do not
test the apps by opening the generated folders through `file://`.

Install and run WellCanvas:

```bash
cd wellcanvas-source
pnpm install --frozen-lockfile
pnpm run dev
```

Build a local static copy for testing under `/WellCanvas/`:

```bash
NEXT_PUBLIC_WELLCANVAS_BASE_PATH=/WellCanvas pnpm run build
```

Build the production GitHub Pages copy under `/website/WellCanvas/`:

```bash
NEXT_PUBLIC_WELLCANVAS_BASE_PATH=/website/WellCanvas pnpm run build
```

After a production build, sync the generated `wellcanvas-source/out/` contents
into `../WellCanvas/`, preserving the public distribution folders:

```bash
rsync -a --delete \
  --exclude downloads \
  --exclude food-packs \
  --exclude city-icons \
  out/ ../WellCanvas/
```

Commit both the WellCanvas source changes and the regenerated `WellCanvas/`
static output, then push to `main`.

Personal WellCanvas records are browser-local. They are not stored in this Git
repository; move them to a new computer by exporting a WellCanvas backup ZIP
from Settings and importing that backup in the new browser installation.

## Verba

Verba is a small standalone language-practice PWA. The editable source lives in
`verba-source/`, and the generated GitHub Pages app build lives in `Verba/`.
Language content is stored as static package JSON under
`verba-source/public/packages/`. Installed packages are copied into browser
IndexedDB, while lightweight progress/settings remain in local browser storage.

Install and run Verba:

```bash
cd verba-source
pnpm install --frozen-lockfile
pnpm run dev
```

The local Verba development server uses no GitHub Pages base path. Open the
URL printed by Next, normally `http://localhost:3000/`.

Build a local static copy for testing under `/Verba/`:

```bash
pnpm run build:local-site
```

Build the production GitHub Pages copy under `/website/Verba/`:

```bash
pnpm run build:github-pages
```

After a production build, sync the generated `verba-source/out/` contents into
`../Verba/`, then commit both the Verba source changes and regenerated static
output. The Verba build scripts perform this sync automatically.
