# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Build
yarn webpack           # Development build
yarn webpack-prod      # Production build

# Development server
yarn serve             # Starts local server via serve.js

# Linting
yarn lint              # Run tslint

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

- **Entry point**: [actions.ts](src/actions.ts) - Mounts app, initializes i18n, loads fumen from URL/LocalStorage
- **State definition**: [states.ts](src/states.ts) - Global `State` interface and `initState`
- **View dispatcher**: [view.ts](src/view.ts) - Routes to Reader or Editor view based on `state.mode.screen`

### Action Modules (src/actions/)

Actions are pure functions returning new state. Organized by domain:
- `animation.ts` - Play/pause controls
- `field_editor.ts` - Block manipulation
- `pages.ts` - Page navigation
- `memento.ts` - Undo/redo (history management)
- `modal.ts` - Modal dialogs
- `setter.ts` - State setters
- `convert.ts` - Format conversions

### View Modes

Two primary screens in [src/views/](src/views/):
- **Reader** (`reader.ts`): View/playback mode for fumen puzzles
- **Editor** (`editor/`): Multi-mode editing with sub-modes:
  - `block_mode.ts` - Draw individual blocks
  - `piece_mode.ts` - Place tetrominos
  - `fill_mode.ts`, `fill_row_mode.ts` - Fill operations
  - `flags_mode.ts` - Page flags (colorize, lock, mirror, quiz, rise)

### Rendering: Konva Canvas

The 10x23 tetris field is rendered via **Konva** (HTML5 canvas):
- Konva objects pre-created in `states.ts` (`resources.konva`)
- Layers: background, field, boxes (hold/next), overlay
- Field is 230 blocks (23 rows × 10 cols) + 10 sent-line blocks

### Fumen Encoding/Decoding (src/lib/fumen/)

Core library for the tetris diagram format:
- [fumen.ts](src/lib/fumen/fumen.ts) - Main `encode()`/`decode()` functions
- Supports v115 and v110 formats
- [field.ts](src/lib/fumen/field.ts) - Field data structure
- [quiz.ts](src/lib/fumen/quiz.ts) - Quiz comment parsing (`#Q=[]()`)

### Key Enums (src/lib/enums.ts)

```typescript
Piece: Empty, I, L, O, Z, T, J, S, Gray
Rotation: Spawn, Right, Reverse, Left
Screens: Reader, Editor
ModeTypes: Drawing, Piece, Fill, Flags, Utils, Slide, etc.
FieldConstants: Width=10, Height=23, SentLine=1
```

## Code Style

- TSLint with Airbnb config
- 4-space indentation, 120 char max line length
- JSX factory is `h` (Hyperapp's hyperscript)
- Strict TypeScript (`strict: true`)

## Localization

i18next with English (`en`) and Japanese (`ja`) in [src/locales/](src/locales/). Translation keys defined in `keys.ts`.
