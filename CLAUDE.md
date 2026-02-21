# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Build
yarn webpack           # Development build (output: dest/)
yarn webpack-prod      # Production build

# Development server
yarn serve             # Starts local server via serve.js (serves dest/)

# Linting
yarn lint              # Run tslint (Airbnb config)

# Testing
yarn test              # Run Jest tests
yarn test -- --testPathPattern=history  # Run single test file

# E2E Testing (Cypress)
yarn cy-open           # Open Cypress interactive runner
yarn cy-run            # Run Cypress tests headlessly
```

## Architecture Overview

This is a **Tetris puzzle editor/viewer** (fumen) built as a PWA for mobile and desktop.

### State Management: Hyperapp Pattern

The application uses **Hyperapp 1.x** with immutable state updates:

```
User Input → Actions → State Update → View Re-render
```

- **Entry point**: `src/actions.ts` — Mounts app, initializes i18n, loads fumen from URL/LocalStorage, registers shortcut handlers
- **State definition**: `src/states.ts` — Global `State` interface, `initState`, Konva object creation, default shortcut mappings
- **View dispatcher**: `src/view.ts` — Routes to Reader, Editor, or ListView based on `state.mode.screen`

### Action Modules (src/actions/)

Actions are pure functions returning new state. Organized by domain:

| File | Responsibility |
|---|---|
| `animation.ts` | Play/pause controls |
| `field_editor.ts` | Block manipulation on field |
| `pages.ts` | Page navigation (largest action module — 59KB) |
| `memento.ts` | Undo/redo dispatch |
| `modal.ts` | Modal dialog open/close |
| `setter.ts` | State setters |
| `convert.ts` | Format conversions |
| `comment.ts` | Comment editing |
| `screen.ts` | Screen switching (Reader/Editor/ListView) |
| `shortcuts.ts` | Keyboard shortcut dispatching (short-press, long-press, DAS) |
| `user_settings.ts` | User preferences management |
| `list_view.ts` | ListView-specific actions (drag-reorder, bulk operations) |
| `tree_operations.ts` | Tree structure CRUD (branch, insert, delete, reparent, drag-drop) |
| `draw_block.ts` | Block drawing helpers |
| `fill.ts` / `fill_row.ts` | Fill operations |
| `put_piece.ts` / `move_piece.ts` | Piece placement and movement |
| `utils.ts` | Utility actions |

### View Modes (3 Screens)

Three primary screens in `src/views/`, controlled by `Screens` enum:

1. **Reader** (`reader.ts`): View/playback mode for fumen puzzles
2. **Editor** (`editor/`): Multi-mode editing with 10 sub-modes:
   - `piece_mode.ts` — Place tetrominos (with SRS rotation)
   - `comment_mode.ts` — Edit page comments
   - `fill_mode.ts`, `fill_row_mode.ts` — Fill operations
   - `flags_mode.ts` — Page flags (colorize, lock, mirror, quiz, rise)
   - `slide_mode.ts` — Slide pieces around
   - `tool_mode.ts` — Drawing tools
   - `utils_mode.ts` — Utility operations
   - `piece_select_mode.ts` — Piece selection
3. **ListView** (`list_view.ts`): Grid overview of all pages with:
   - Drag-and-drop reorder (both mouse and touch)
   - Pinch-to-zoom (mobile)
   - Tree view integration (git-graph style visualization)

### Tree Structure System

Fumen pages can be organized into a tree (branching) structure:

- **Types**: `src/lib/fumen/tree_types.ts` — `TreeNode`, `SerializedTree`, `TreeState`, `AddMode` (Branch/Insert), `TreeViewMode` (List/Tree), `TreeDragMode`
- **Utilities**: `src/lib/fumen/tree_utils.ts` — Serialization, layout calculation, tree traversal, embedding tree data into pages via `#TREE=` comment prefix
- **Actions**: `src/actions/tree_operations.ts` — Toggle, add/delete/reparent nodes, drag-drop, normalize
- **Layout**: `src/lib/fumen/tree_view_layout.ts` — Graph layout for tree visualization

Tree data is persisted by embedding serialized JSON in fumen page comments using the `#TREE=` prefix and restored on decode.

### Rendering: Konva Canvas

The 10×23 tetris field is rendered via **Konva** (HTML5 canvas):
- Konva objects pre-created in `states.ts` (`createKonvaObjects()`)
- Layers: background, field, boxes (hold/next), overlay
- Field is 230 blocks (23 rows × 10 cols) + 10 sent-line blocks

### Fumen Encoding/Decoding (src/lib/fumen/)

Core library for the tetris diagram format:
- `fumen.ts` — Main `encode()`/`decode()` functions
- Supports v115 and v110 formats
- `field.ts` — Field data structure (`PlayField`, `InnerField`)
- `quiz.ts` — Quiz comment parsing (`#Q=[]()`)
- `action.ts` — Action encoding/decoding
- `flag_sync.ts` — Synchronize SRS and colorize flags

### Clipboard Parser (src/lib/clipboard_parser/)

Parses clipboard content with detection order: fumen URL → raw fumen string → 20×10 field text → field image → none

- `index.ts` — Main `parseClipboard()` / `parseClipboardText()` entry points
- `text_parser.ts` — Parse text-format field representations
- `image_parser.ts` — Parse image-format fields (pixel color matching)
- `palette.ts` — TETRIO color palette and color-to-piece matching

### History / Undo-Redo System

- **`src/history_task.ts`** — `HistoryTask` types: `OperationTask` (replay/revert on current pages) and `FixedTask` (self-contained snapshot). Task factories: `toSinglePageTask`, `toRemovePageTask`, `toInsertPageTask`, `toKeyPageTask`, `toFreezeCommentTask`, `toPageTaskStack`, etc.
- **`src/memento.ts`** — `memento` singleton with undo/redo queues (max 200 entries), merge-by-key support, auto-save to localStorage via sequential encode

### Modal Dialogs (src/components/modals/)

9 modal components: `open`, `append`, `clipboard`, `menu`, `user_settings`, `list_view_replace`, `list_view_import`, `list_view_export`, `textarea`

### Keyboard Shortcuts (src/actions/shortcuts.ts)

Customizable keyboard shortcuts with 3 categories:
- **Palette shortcuts** — Piece selection (Q=I, W=L, E=O, etc.) with short/long press
- **Edit shortcuts** — Page control (Space=insert, 1/2=prev/next, Mod+Z/Y=undo/redo, Tab=ListView, etc.)
- **Piece shortcuts** — Movement and rotation (arrows, Z/X) with DAS (Delayed Auto Shift)

### Persistence (src/memento.ts — localStorageWrapper)

- `data@1` — Fumen data (v115 encoded string)
- `user-settings@1` — User preferences (ghost visible, loop, shortcuts, gradient pattern, DAS timing)
- `view-settings@1` — View settings (trim top blank, button-drop moves subtree, gray after line clear)

### Key Enums (src/lib/enums.ts)

```typescript
Piece: Empty, I, L, O, Z, T, J, S, Gray
Rotation: Spawn, Right, Reverse, Left
Screens: Reader, Editor, ListView
ModeTypes: Drawing, Piece, Fill, DrawingTool, Flags, Utils, Slide, FillRow, SelectPiece, Comment
TouchTypes: None, Drawing, Piece, Fill, MovePiece, FillRow
FieldConstants: Width=10, Height=23, SentLine=1
Platforms: PC, Mobile
GradientPattern: None, Line, Triangle, Circle
```

### Important Library Modules (src/lib/)

- `pages.ts` — `Pages` class for page array manipulation (insert, remove, duplicate, etc.)
- `srs.ts` — Super Rotation System kick table
- `classic_rotation.ts` — Classic (non-SRS) rotation system
- `inference.ts` — Piece inference from field state
- `thumbnail.ts` — Generate page thumbnails for ListView
- `colors.ts` — Color definitions and `Palette` mapping
- `hyper.ts` — Hyperapp helpers
- `piece.ts` — Piece shape definitions
- `shortcuts.ts` — Shortcut matching utilities (`matchShortcut`, `isModifierKey`)

### Component Hierarchy (src/components/)

- `field.tsx` — Main field component (10×23 grid)
- `box.tsx` — Hold/Next piece boxes
- `konva_canvas.tsx` — Konva stage wrapper
- `comment.ts` — Comment display/edit
- `page_slider.ts` — Page slider control
- `tools/` — Toolbar components per screen (reader/editor/list_view tools)
- `tree/` — Tree view components
- `event/` — Event handler wrappers
- `atomics/` — Atomic UI elements
- `list_view/` — ListView-specific components

## Code Style

- TSLint with Airbnb config
- 4-space indentation, ~120 char max line length
- JSX factory is `h` (Hyperapp's hyperscript)
- Strict TypeScript (`strict: true`, `noImplicitReturns: true`)
- Target: ES5 with tslib helpers

## Localization

i18next with English (`en`) and Japanese (`ja`) in `src/locales/`. Translation keys defined in `keys.ts`.

## Testing

- **Unit tests**: Jest — `src/__tests/` and `src/lib/__tests__/` and `src/lib/fumen/__tests__/` and `src/lib/clipboard_parser/__tests__/`
- **E2E tests**: Cypress — `cypress/integration/` (19 test files)
- When changing fumen logic, run Jest; for UI flows or modal/list changes, run Cypress

## Build & Deployment

- Webpack 5 with ts-loader, entry at `src/actions.ts`, output to `dest/`
- Version injected via `string-replace-loader` into `src/env.ts` (`###VERSION###`, `###DEBUG###`)
- Static assets from `resources/` copied to dest; Materialize CSS and Material Icons bundled
- Service worker generated by Workbox (`GenerateSW`)
- GitHub Actions builds with `GITHUB_RUN_NUMBER + 1000` as version number
