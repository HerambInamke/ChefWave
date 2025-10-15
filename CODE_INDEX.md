# ChefWave Code Index

A quick index of files, their purpose, and key notes.

## File tree

```
.
├─ index.html
├─ sw.js
├─ add_recipe.json
├─ test_recipe.js
├─ assets/
│  ├─ manifest.webmanifest
│  └─ css/
│     └─ styles.css
└─ assets/icons/
   ├─ icon-192.png
   ├─ icon-512.png
   └─ icon.svg
```

## Files

- index.html: Single-file app containing UI, IndexedDB/localStorage data layer, mixer (Web Audio), suggestions, export/import, and PWA bootstrapping (inline SW + manifest).
- sw.js: Static service worker fallback. Caches app shell and provides cache-first for same-origin, SWR for cross-origin.
- add_recipe.json: Example data set (pantry items and recipes) for import.
- test_recipe.js: Node script to verify example recipes appear in `index.html` content by name.
- assets/manifest.webmanifest: PWA manifest used by static SW mode; inline manifest is also generated at runtime.
- assets/css/styles.css: Optional external CSS (not required in single-file mode). Styling for cards, lists, editor rows, and mixer UI.
- assets/icons/icon-192.png, assets/icons/icon-512.png, assets/icons/icon.svg: App icons for PWA install surfaces.

## Key modules inside index.html

- Data storage: IndexedDB via `openDb`, `withStore`; automatic fallback to localStorage (`makeFallbackAPIs`, `enableFallback`). Stores: `pantry`, `recipes`, `presets`.
- Seeding: `DEFAULT_PANTRY`, `DEFAULT_RECIPES`, `seedPantryIfEmpty`, `seedRecipesIfEmpty`.
- UI helpers: `showToast`, `$`, `$$`, template-based renderers for pantry, recipes, suggestions, and editor.
- Drag & drop: Add pantry items into recipe editor ingredients.
- Suggestions: Scores recipes by pantry coverage and lists them with percentage badges.
- Export/Import: `exportAll`, `importAll` for backup/restore JSON.
- Mixer: Web Audio API nodes per channel; gain/pan/filter controls; preset save/load/reset via `presets` store.
- PWA: Inline service worker registration with blob fallback and static `sw.js` backup; inline manifest injection.
- Initialization: On `DOMContentLoaded`, open DB, seed, render UI, register SW, render mixer.
