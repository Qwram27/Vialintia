# Vialintia — fine fragrance formulation studio

Offline desktop app (Electron + React + TypeScript) for composing perfume formulas.

## Run / build

```bash
npm install
npm run dev        # development window (F12 = DevTools)
npm test           # calculation unit tests
npm run build:win  # dist/Vialintia-Setup-x.y.z.exe + dist/Vialintia-x.y.z-portable.exe
```

## iPhone / web app (PWA)

The same renderer also builds as an offline web app for iPhone:

```bash
npm run dev:web      # browser dev server (open on the phone via the LAN address)
npm run build:web    # → dist-web/ (static, relative paths, service worker, manifest)
npm run preview:web  # serve dist-web locally
```

Deployed by `.github/workflows/pages.yml` to GitHub Pages on every push to `main`
(one-time: repo Settings → Pages → Source: **GitHub Actions**).
On the iPhone: open the Pages URL in Safari → Share → **Add to Home Screen**. After the first
load it works fully offline. Data is kept on the phone (IndexedDB); move data between PC and
phone with Settings → Export backup / Restore backup. PDF: the print sheet → Share → Save to Files.

## Data

Stored locally as JSON in `%APPDATA%\Vialintia\data` (materials, formulas, settings).
A snapshot is copied to `%APPDATA%\Vialintia\backups` on every start (last 10 kept).
Full backup export / restore: Settings → Data & backups.

## Calculations

- **Weighed %** – share of the concentrate as weighed (including dilution solvent).
- **In product %** – neat material in the finished perfume = neat % in concentrate × concentration %.
  IFRA limits (Cat. 4, entered per material) are checked against this value.
- **Max concentration** – highest concentration at which every entered IFRA limit still holds.
- Batch: bottles × ml × perfume density → concentrate and alcohol (g and ml), or a direct concentrate mass.

Seed materials ship without IFRA limits or prices — fill them in from supplier certificates / the current IFRA Standards.

## Project layout

- `src/main` – window, JSON storage with atomic writes and backups, PDF export
- `src/preload` – IPC bridge (`window.vialintia`)
- `src/shared` – types and defaults (cool/botanical palette)
- `src/renderer/src/lib/calc.ts` – all formula maths (pure functions, tested)
- `src/renderer/src/views` – Formulas, Formula editor, Materials, Compare, Settings
