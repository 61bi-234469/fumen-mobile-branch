# AGENTS.md

Project: fumen-for-mobile (tetfu-sp). A Hyperapp 1.x + TypeScript PWA for viewing/editing Tetris fumen on mobile/desktop; Konva renders the 10x23 field.

## Quick Start
- Install deps: `yarn install` (yarn lock present)
- Dev build: `yarn webpack`; prod: `yarn webpack-prod`
- Serve built assets: `yarn serve` (uses dest/ via serve.js)
- Lint: `yarn lint`
- Unit tests: `yarn test` or `yarn test -- --testPathPattern=history`
- E2E: `yarn cy-open` (UI) or `yarn cy-run` (headless)

## Code Map
- `src/actions.ts`: app bootstrap (i18n, load fumen, mount); domain actions live in `src/actions/*` (animation, field_editor, pages, memento/undo, modal, setter, convert)
- `src/states.ts` + `state_types.ts`: State definitions/init; holds Konva resources and defaults
- `src/view.ts`: Chooses Reader/Editor/ListView; wires modals (open/append/clipboard/menu/user settings/list import/replace); clipboard embeds tree data via `embedTreeInPages`
- `src/views/`: `reader.ts`, `editor/` modes (block/piece/fill/fill_row/flags/etc), `list_view.ts`
- `src/lib/fumen/`: fumen encode/decode v115/v110, field, quiz parser; enums/constants in `src/lib/enums.ts`
- `src/components/modals/`: modal UIs; `src/locales/`: i18next strings (en/ja)
- `dest/`: built assets; `resources/`: static assets/workbox helpers

## Practices
- TypeScript strict + TSLint (Airbnb); 4-space indent, ~120 char lines; Hyperapp JSX factory is `h`
- Keep actions pure/immutable; prefer using existing domain actions instead of ad-hoc state edits
- When changing fumen logic, run Jest; for UI flows or modal/list changes, run Cypress
- Update translations when adding user-visible text; keep Reader/Editor/ListView behaviors in sync
