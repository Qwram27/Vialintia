# Vialintia — notes for Claude

Offline fine-fragrance formulation app (Electron + React + TypeScript, electron-vite). Owner writes in **Polish** — reply in Polish. The app UI itself is **English**.

## Commands
- `npm install` · `npm run dev` · `npm test` (vitest, maths in `src/renderer/src/lib/calc.ts`) · `npm run typecheck`
- `npm run build` (electron-vite → `out/`) · `npm run build:win` (Windows exe, needs Windows)
- Dev-only env hooks in `src/main/index.ts`: `VIALINTIA_USER_DATA` (isolated data dir), `VIALINTIA_CAPTURE="outDir|#/route|js:code|file:script.js|shot"` (screenshots + scripted UI checks), `VIALINTIA_PDF_OUT` (PDF export without dialog).

## Design rules (agreed with the owner — keep them)
- Look: raw monochrome **archive** style (Raf Simons / Apple / Stoic journal app). Black, white, greys, hairlines, catalogue numbering `N°001`, season codes, uppercase tracked labels. Font **Geist Mono** everywhere.
- Light **liquid glass**: translucent blurred surfaces with a bright top edge over a faint cool ambient glow (see end of `src/renderer/src/styles/theme.css`).
- Controls are **squarish** (≈7px radius, like the "+ tag" field) — no pill buttons.
- **Never warm colours**: no yellow, orange, red anywhere. IFRA/status use brighter greys = more urgent, always with a glyph (✓ ◐ !).
- No botanical/plant motifs (rejected as generic).
- Note & olfactive-family colours stay user-adjustable (Settings → colours).
- Version labels are `V1, V2…`. Season code: SS = Mar–Aug of year Y → `SSyy`; AW = Sep–Feb, named by the year it runs into (Nov 2026 → `AW27`).
- PDF export (`formulaToPdfHtml` in `src/renderer/src/lib/exports.ts`) is a plain black-on-white lab formula sheet, Arial, gridded table with a ✓ weighing column.

## Architecture
- `src/main` — window (hidden title bar + overlay), JSON storage in `%APPDATA%/Vialintia/data` with atomic writes + startup backups, PDF via hidden window.
- `src/preload` — exposes `window.vialintia` (`StoreApi` in `src/shared/types.ts`).
- `src/renderer/src` — React app. `store/store.ts` (zustand, debounced persistence, undo/redo, data migrations in `normalizeSettings`/`normalizeFormula`), `store/ui.ts` (hash router, toasts, confirm), `views/` (Dashboard grid/index, FormulaEditor = metrics strip + composition pane + inspector tabs, Library, Compare, Settings), `components/Seg.tsx` (sliding segmented control).
- Releases so far: 1.0 botanical → 1.1 archive → 1.2 workspace layout → 1.3 liquid glass/squarer → 1.3.1 mono IFRA + classic PDF.

## NEXT TASK — iPhone web app (PWA) on GitHub Pages
Owner wants to use Vialintia on iPhone, offline, added to the Home Screen. Agreed plan:
1. Web build target of the same renderer (e.g. separate Vite config, base path for Pages `/vialintia/` or repo name).
2. Implement `StoreApi` for the browser: IndexedDB (or localStorage) for materials/formulas/settings; export = file download (Blob), import = `<input type=file>`; PDF = open sheet HTML in a new window/iframe and `print()` (iOS share → Save to Files). Pick implementation at runtime (`window.vialintia` exists → Electron, else web).
3. PWA: `manifest.webmanifest` (name, icons from `build/icon.svg`, `display: standalone`, black theme), service worker for offline cache, `apple-mobile-web-app-*` meta, safe-area insets.
4. Mobile layout (≤ 700px): bottom tab bar instead of sidebar; formula composition as stacked row cards (material, amount, dilution, % in product, IFRA glyph) with an edit sheet; inspector sections become collapsible blocks below; metrics strip becomes a 2-column grid; touch targets ≥ 44px; keep the archive/liquid-glass look.
5. Deploy with GitHub Actions → GitHub Pages (HTTPS is required for the service worker on iOS). Repo owner: `Qwram27`.
6. Data sync between PC and phone = Settings → Export backup / Restore backup (JSON), already implemented.
Keep the Electron app working; run `npm test` and `npm run typecheck` after changes.
