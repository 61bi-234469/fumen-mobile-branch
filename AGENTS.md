# AGENTS.md

Project: `fumen-for-mobile` (`tetfu-sp`). A Hyperapp 1.x + TypeScript PWA for viewing/editing Tetris fumen on mobile/desktop. Konva renders the 10x23 field.

## Quick Start
- Install deps: `yarn install`
- Dev build: `yarn webpack`
- Prod build: `yarn webpack-prod`
- Serve built assets: `yarn serve` (serves `dest/` via `serve.js`)
- Lint: `yarn lint`
- Unit tests: `yarn test` (example narrow run: `yarn test -- --testPathPattern=history`)
- E2E tests: `yarn cy-open` (interactive) / `yarn cy-run` (headless)

## Code Map
- `src/actions.ts`: app bootstrap and mount; initializes i18n, loads fumen from URL/localStorage, wires hash/popstate + resize listeners, initializes keyboard shortcuts.
- `src/actions/*`: domain actions (animation, field editor, pages/history, modal, convert, comment, screen, list view, tree operations, user settings, shortcuts).
- `src/states.ts` + `src/state_types.ts`: root `State`, defaults (including shortcut defaults), platform detection, and pre-created Konva resources.
- `src/view.ts`: top-level screen switcher (Reader/Editor/ListView) and modal wiring (open/append/clipboard/menu/user settings/list import/replace/export).
- `src/views/editor/*`: editor sub-modes (`tool_mode`, `piece_mode`, `fill_mode`, `fill_row_mode`, `flags_mode`, `slide_mode`, `comment_mode`, etc.).
- `src/views/list_view.ts`: list/tree unified screen (grid view + tree graph view, drag/drop, touch handling, pinch zoom, undo/redo controls).
- `src/components/tree/*`: tree graph UI; works with layout utilities in `src/lib/fumen/tree_view_layout.ts`.
- `src/lib/fumen/*`: core fumen encode/decode (`v115`/`v110`), field/flags/quiz, plus tree model (`tree_types.ts`, `tree_utils.ts`, `tree_view_layout.ts`).
- `src/lib/clipboard_parser/*`: clipboard parsing pipeline (fumen URL/text, 20x10 field text, image parsing).
- `src/memento.ts`: undo/redo queue + localStorage wrapper (`data@1`, `user-settings@1`, `view-settings@1`).
- `src/locales/*`: i18next resources (`en`, `ja`) and translation key bindings.
- `src/__tests__`, `src/lib/**/__tests__`: Jest tests; `cypress/integration/*`: Cypress E2E specs.

## Practices
- TypeScript strict mode + TSLint (Airbnb), 4-space indent, ~120 char max line length, JSX factory `h`.
- Keep actions immutable and composed through existing domain actions (`sequence`/history tasks) rather than ad-hoc state mutation.
- Tree mode behavior is cross-cutting (pages, list view, export/import, clipboard, undo/redo): validate these together when editing tree-related code.
- When changing fumen/tree/history/parser logic, run Jest. When changing screen flow, modal UX, shortcuts, drag/drop, or list/tree UI, run Cypress.
- Preserve `datatest` attributes used by Cypress when touching UI components.
- Add/update both `en` and `ja` locale entries for any new user-facing text.
