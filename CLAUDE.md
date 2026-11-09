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
- Single sanctioned accent: neon green `--saved` = `rgb(0,255,0)` — only for the top-bar save status (green = saved, white/grey = saving / not saved). Don't reuse it elsewhere.
- **No glows** anywhere (no luminous halos / coloured box-shadow blurs, no focus halos). Owner rejected decorative "AI-looking" UI: no sliding glass thumbs, rotating chevrons, staggered list animations, pulsing dots. Keep it raw and flat.
- No botanical/plant motifs (rejected as generic).
- Note & olfactive-family colours stay user-adjustable (Settings → colours).
- Navigation: icons, no 01–04 numbers (sidebar + tab bar). Nav icons in `Icons.tsx` (`IconSheet` formulas, `IconPowder` materials = outlined rounded powder heap with grains inside and a few spilling out (owner's reference), `IconAnalyze` plotted curve, `IconGear` plain six-tooth gear) use square caps / mitred joins. The Compare section is labelled **Analyze** (route stays `/compare`).
- Selected / primary (`.seg-thumb`, `.vchip.on`, `.btn-primary`) = solid black with white text and a light hairline border (like the regular buttons, e.g. Restore) — no light/white fills.
- Dashboard kicker is hard-coded `Archive · AV27` (owner request).
- Version labels are `V1, V2…`. Season code: SS = Mar–Aug of year Y → `SSyy`; **AV** (not AW — owner's label) = Sep–Feb, named by the year it runs into (Nov 2026 → `AV27`).
- PDF export (`formulaToPdfHtml` in `src/renderer/src/lib/exports.ts`) is a plain black-on-white lab formula sheet, Arial, gridded table with a ✓ weighing column.

## Architecture
- `src/main` — window (hidden title bar + overlay), JSON storage in `%APPDATA%/Vialintia/data` with atomic writes + startup backups, PDF via hidden window.
- `src/preload` — exposes `window.vialintia` (`StoreApi` in `src/shared/types.ts`).
- `src/renderer/src` — React app. `store/store.ts` (zustand, debounced persistence, undo/redo, data migrations in `normalizeSettings`/`normalizeFormula`), `store/ui.ts` (hash router, toasts, confirm), `views/` (Dashboard grid/index, FormulaEditor = metrics strip + composition pane + inspector tabs, Library, Compare, Settings), `components/Seg.tsx` (sliding segmented control).
- **App version is `V0.5`** (owner: keep it until told otherwise) — label in `src/shared/version.ts` (`APP_VERSION`, shown in the sidebar footer and Settings → About), package.json `0.5.0`. Don't bump it per change; describe changes in commits instead.
- Release history (internal, before the V0.5 renumbering): 1.0 botanical → 1.1 archive → 1.2 workspace layout → 1.3 liquid glass/squarer → 1.3.1 mono IFRA + classic PDF → 1.4 iPhone web app (PWA) → 1.4.1 verified starter library (seed v2, `upgradeSeedLibrary`) → 1.4.2 phone picker/sheets, save status → 1.4.3 decorative effects removed, neon-green saved, no glows → 1.4.4 compact picker back, list-only scrolling → 1.4.5 iOS full-height fix, tab icons, IFRA near-limit default 90% → 1.4.6 nav icons everywhere, no nav numbers, Analyze, static phone top bar → 1.4.7 powder-heap + plain gear icons, pearl-grey selected fill → 1.4.8 outlined powder icon → 1.4.9 AV season codes, black selected/primary.

## Formula tools
- Product presets: EDT 10 %, EDP 17 % (owner), parfum 25 %, EDC 5 %.
- Formula editor: header has **Assemble fragrance** + undo/redo/duplicate/delete; the footer bar (`EditorFoot`) holds Scale, Save as accord, Analyze, CSV, PDF.
- **Assemble fragrance** (`views/Assemble.tsx`, route `#/formula/:id/assemble`): weighing session from the current version and batch; targets rounded to `settings.balanceStep`; actual weights, running scale reading, alcohol step; sessions stored in `formula.assemblies` (last one without `finishedAt` = in progress).
- **Scale** (`ScaleDialog`, `scaleRows`/`roundToStep` in calc.ts): rescale to a concentrate mass or bottles, converts to grams, rounds to the balance step, optionally as a new version.
- **Accords**: a material with `accordFormulaId` is a formula used as an ingredient. `buildAccordIndex` (calc.ts, `useAccordIndex` hook) expands it into neat constituents (nested accords resolved, cycles cut) — IFRA counts constituents together with direct use, cost comes from component prices, `rowIfraEntry` shows the worst constituent on the accord row.

## iPhone web app (PWA)
- `npm run dev:web` / `build:web` (→ `dist-web/`) / `preview:web`, config `vite.web.config.mts` (relative base `./`, injects PWA head tags, generates `sw.js` precaching every built file; navigation = network-first, assets = cache-first).
- `src/renderer/src/platform/` — `installPlatform()` sets `window.vialintia = createWebApi()` when no Electron preload; `isWeb` flag. Web API: IndexedDB (localStorage fallback), export = iOS share sheet (files only — no title/text, iOS would save them as extra "Text N" files) / download, import = `<input type=file>`, PDF = sheet mounted in `#print-root` (print-only CSS) + `window.print()`.
- App logo (owner picked variant C): a formula sheet with a folded top-right corner, a bold V inside and two grey rule lines below. Same drawing as `LogoMark` in `Icons.tsx` (sidebar brand). Sources: `build/icon.svg` (desktop, rounded tile) and `src/renderer/web-public/icons/icon.svg` (full-bleed for iOS); PNGs rendered from them with Playwright.
- PWA assets in `src/renderer/web-public/` (manifest, icons rendered from `icons/icon.svg`).
- Phone layout ≤ 700px (`lib/useMobile.ts`): bottom `.tabbar` (static icon + label, positioned inside `.app`; app height = `--app-h` from `main.tsx` to fix the iOS standalone bottom gap). On phones the top bar is rendered *outside* `.main` as a plain flex child (a sticky bar inside the scroll container rendered soft/blurred on iOS), `components/Sheet.tsx` (drag-to-dismiss bottom sheet), MaterialPicker = compact `.picker-pop` panel under the top bar (owner rejected a full-screen picker); while open on phones the page (`.main`/`.sheet`) is scroll-locked so swipes scroll only the list, `MobileComposition` row cards + bottom `Sheet` editor, inspector as `Collapsible` blocks, Library list + material sheet. CSS at the end of `theme.css` (safe-area vars `--sat/--sab`).
- Deploy: `.github/workflows/pages.yml` → GitHub Pages on push to `main` (Pages source must be "GitHub Actions").
- Data (Settings → Data & backups): separate **Export formulas** (`kind: 'formulas'`), **Export materials** (`kind: 'materials'`, carries `seedVersion`) and **Export settings** (`kind: 'settings'`); **Restore from file** accepts any of them (or an old full backup) and replaces only what the file contains; **Reset app** (`store.resetAll`) reloads the starter library. Sync PC ↔ phone = export on one, restore on the other.
- Default dilution solvent = ethanol (`EtOH`) for new rows and starter materials (seed v3 moved starter materials off DPG).
- Starter library reference data: `src/renderer/src/data/seedReference.ts` (generated). Tenacity = TGSC substantivity (only where TGSC has a figure; others empty, no guesses). IFRA = Category 4 limit read from the official IFRA Standards PDFs (51st Amendment set) matched by CAS; specification/prohibition standards and phototoxicity caveats are noted in the description. Seed v4 fills these into existing libraries (empty fields only). Seed v5 added mints (spearmint, Scotch spearmint, cornmint, bergamot mint, peppermint absolute, l-menthol, l-menthone, l-carvone, l-menthyl acetate); new batches are registered in `ADDED_AT` in `seedMaterials.ts`. Mint lactone deliberately left out (IFRA Std 218 prohibition).
