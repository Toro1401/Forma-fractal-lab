# Forma — Fractal Playground

An interactive playground for drawing a rule, repeating it, and watching it grow. Runs in your browser without accounts, npm dependencies, or external services. Includes 40 editable presets, five generators, and a unified library with backups and trash recovery. The application interface is currently in Italian; this guide provides English descriptions of its controls.

## Getting started

On Windows, double-click **avvia-locale.cmd**, then open **http://127.0.0.1:8080**. Requires Python 3.8 or later and a recent browser. Restart an existing server after updating `serve.py`.

From a terminal, run `python serve.py --port 8080`. If the port is busy, choose another, such as `8081`, and use that port in the URL. The server listens only on `127.0.0.1`; press Ctrl+C to stop it.

You can also open **dist/index.html** directly or serve `dist/` with a static server. Exploration, browser saves, backups, and imports work without the Python API. Project presets can be read in any mode; updating their files requires the local server. Each browser origin and profile has its own local library.

## The playground

The rule editor is immediately available. **Scegli un esempio** (Choose an example) opens a library with family filters, result previews, and suggestions. The original 24 examples are retained; additions include closed snowflakes, radial patterns, mandalas, guided trees, self-similar copies, and grammars.

A separate timeline controls generation depth, stepping, playback, speed, and looping. Pausing keeps the current generation, and playback can resume. On mobile, **Regola e stile** (Rule and style) toggles the settings panel to give the result more room.

**Vista e confronto dei livelli** (View and generation comparison) provides previous- and next-generation previews, reference colors and stroke width, and adaptive or fixed framing. Fixed framing preserves camera position and scale during growth; Fit reframes manually. Color and stroke settings have their own section.

## Five generators

1. **Replacement curve**: each segment is replaced by the polyline A → P1 → … → B. A stays at (0, 0), while B is editable. The initial figure can be a segment, a closed polygon, or a radial arrangement. Choose sides or arms, orientation, mirrored sectors, and inward growth. The A → B rule stays open even when the result is closed. The Koch snowflake uses a triangular base, distinct from a radial rosette.
2. **Recursive branches**: each segment remains visible and produces branches with adjustable angle, scale, attachment, and reflection. Linked mirrored pairs update together. Canopy spread, dominance, per-generation changes, alternating sectors, and seeded irregularity support guided, reproducible growth.
3. **Fold and double**: a reversed copy of the entire path attaches to its current endpoint. Choose rotation, reflection with a visible draggable axis, or a repeating sequence of operations. Reflections with a constant axis orientation mostly produce frieze patterns; detected complete overlaps are reported. Existing presets, including the L-shaped dragon, remain available.
4. **Self-similar copies · IFS**: draw an open or closed shape, optionally filled, and arrange one to eight copies. Drag their anchors in the copy editor or adjust position, X/Y scales, rotation, shear, and reflection. Each transformation must be contractive. Examples include the Sierpiński triangle and carpet, spirals, and an affine fern.
5. **Grammars · L-systems**: edit the axiom, production rules, turning angle, step scale, and initial heading. `F` and `G` draw, `f` moves without drawing, `+` and `-` turn, `[` saves the turtle state, and `]` restores it. Other letters are rewritten. Examples include a tree, a plant, and the Hilbert curve.

In version 5 projects, positive angles are counterclockwise. Legacy global rotations are converted by reversing their sign; legacy reflection axes retain their orientation. Projects from versions 1–4 preserve their geometry.

## Precision and construction

Advanced construction supports locked lengths, equal-length groups, and angles. Locking a measurement uses its exact geometric value, even when the field displays two decimal places. Typed values are not rounded before calculation. Very small values use scientific notation when rounding would display zero.

Point order follows the path, including negative X coordinates and crossings. Adding or removing points clears dimensional constraints while preserving directions on corresponding sides. Undo and redo also restore the identity of the creation being updated. Grid snapping, mirroring, and straightening are available near the editor.

## Variations

**Confronta quattro varianti** (Compare four variations) generates nearby alternatives to the current creation. Intensity and protection options for the initial shape, growth rule, and colors control what may change. Open a variation or watch an animated transition. Transitions can be interrupted and undone. **Sorprendimi** (Surprise me) explores the current generator.

Color can follow spatial position, generation, or branch/copy family. In generators that completely replace the previous generation, every segment in the final result belongs to the same generation; comparing it with the previous-generation reference helps explain the transformation.

## One library

**Le mie creazioni** (My creations) combines project-file presets and browser saves. Open, duplicate, rename, or delete creations. New saves automatically use the local server when available, otherwise browser storage; the save dialog also lets you choose explicitly.

- Personal project presets live in **dist/user-presets.js**; include this file in repository backups. The server stores up to 24 file-based presets and rewrites them atomically.
- The combined library supports up to 256 creations. Available browser storage may impose a lower limit.
- Trash retains the last 32 deletions and supports recovery after reopening the app. Deleting a file-based preset requires the local server.
- Full backups include creations and trash. Imports validate everything before writing, skip identical copies, and preserve both projects when an identifier has different contents.
- The legacy `forma.gallery.v1` collection is migrated without deleting its original storage key. The draft remains separate.

Changing origin, browser, or device does not automatically transfer local data. Use **Scarica backup completo** (Download full backup) or export an individual project as JSON. Clearing browser data removes its local library, trash, and draft; presets already written to project files remain available.

## Exports

PNG and SVG exports use the complete geometry without the grid or comparison overlays, with either the chosen background or transparency. Dimensions range from 128 to 8192 pixels per side; PNG exports are limited to 32 megapixels. Keep the screen stroke width or multiply it by 1.5 or 2. Filled IFS shapes, structural colors, gradients, and tapered branches are preserved.

Version 5 JSON stores the rule, composition, growth settings, grammar, and style. History and camera settings remain session preferences. JSON versions 1–4 are supported. Import projects and backups through the library.

In browsers supporting `MediaRecorder` and `Canvas.captureStream`, **Registra la crescita · WebM** (Record growth) captures the animated canvas as displayed, including the grid if enabled. Recording stops when growth finishes, when you press Stop, or after 30 seconds. No audio is captured.

## Architecture

`dist/` contains executable source files, not generated build output. Do not delete it. No build step is required.

| File | Responsibility |
| --- | --- |
| `engine.js`, `constraints.js` | Original geometry and construction; version 1–4 compatibility |
| `generators.js` | Version 5 schema, compositions, growth, folding, IFS, and L-systems |
| `history.js` | Project history and save identity |
| `renderer.js` | Shared rendering for Canvas, thumbnails, and SVG |
| `worker.js` | Geometry, comparison generations, and rendering of dense scenes |
| `library.js` | Persistence, migration, backups, and trash |
| `presets.js` | Recipes and suggestions for the 40 examples |
| `experience.js`, `experience.css` | User experience and contextual controls |
| `app.js` | Editor, camera, events, and coordination |
| `serve.py` | Loopback server, validation, and atomic writes |

Limits are 131,072 segments for curves, branches, IFS, and L-systems, and 1,048,576 for folding. Complete generations are retained, with symmetry copies included in the budget. L-system expansion is also limited to 1,048,576 symbols. Imported files are limited to 2 MB.

Over local HTTP, a worker calculates geometry and comparison generations. Above 65,536 segments, rendering uses OffscreenCanvas when available: navigation reuses an image while the view is refined in the background. Exact geometry buffers remain available for exports. Direct file access and browsers without these APIs use a fallback that may be less responsive for dense scenes.

## Testing

With Node.js 22 or later, no package installation is required:

```sh
node tests/engine.test.cjs
node tests/branches.test.cjs
node tests/global.test.cjs
node tests/experience.test.cjs
node tests/library.test.cjs
node tests/browser.mjs
node tests/features.browser.mjs
python -m unittest discover -s tests -p test_server.py
```

Browser suites require Python and Chromium. On Windows, they use Chrome's standard installation path; set `CHROME_PATH` and `PYTHON_PATH` for alternative locations. They use debugging ports 9347 and 9349, isolated profiles, and temporary project copies, leaving real presets untouched.

Checks cover the editor, precision and history regressions, every preset, persistence for new generators, dragging axes and copies, backups and trash, transitions, transparent PNG/SVG exports, WebM recording, and simulated mobile layouts. Screenshots and indicative performance measurements are stored in `.qa-browser/`, which Git ignores. Physical touch devices, screen readers, and other browsers still need testing before being declared supported.

Mathematical references: [Koch snowflake](https://mathworld.wolfram.com/KochSnowflake.html), [IFS](https://paulbourke.net/fractals/ifs/), and [Algorithmic Botany](https://algorithmicbotany.org/papers/). Decorative variations use descriptive names; arbitrary generators are not assigned a claimed fractal dimension.
