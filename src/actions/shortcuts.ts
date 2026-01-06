import { ModeTypes, Piece, Screens } from '../lib/enums';
import { isModifierKey } from '../lib/shortcuts';
import { PaletteShortcuts, State } from '../states';
import { Actions } from '../actions';

const LONG_PRESS_DURATION = 500;

// 長押し状態管理
let pressedKey: string | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressExecuted = false;

// パレットキーの種類
type PaletteKey = keyof PaletteShortcuts;

// モーダルが開いているかチェック
const isAnyModalOpen = (state: State): boolean => {
    const { modal } = state;
    return modal.fumen || modal.menu || modal.append || modal.clipboard ||
           modal.userSettings || modal.listViewReplace || modal.listViewImport || modal.listViewExport;
};

// 入力フィールドにフォーカスしているかチェック
const isInputFocused = (): boolean => {
    const el = document.activeElement;
    if (!el) return false;
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return true;
    }
    if ((el as HTMLElement).isContentEditable) {
        return true;
    }
    return false;
};

// codeからパレットを検索
const findPaletteByCode = (shortcuts: PaletteShortcuts, code: string): PaletteKey | null => {
    for (const key of Object.keys(shortcuts) as PaletteKey[]) {
        if (shortcuts[key] === code) {
            return key;
        }
    }
    return null;
};

// パレットキーからPiece enumに変換
const paletteToPiece = (palette: PaletteKey): Piece | null => {
    switch (palette) {
    case 'I': return Piece.I;
    case 'L': return Piece.L;
    case 'O': return Piece.O;
    case 'Z': return Piece.Z;
    case 'T': return Piece.T;
    case 'J': return Piece.J;
    case 'S': return Piece.S;
    case 'Empty': return Piece.Empty;
    case 'Gray': return Piece.Gray;
    case 'Comp': return null; // Compは特殊扱い
    }
};

// ミノかどうか判定
const isMino = (palette: PaletteKey): boolean => {
    return ['I', 'L', 'O', 'Z', 'T', 'J', 'S'].includes(palette);
};

// 短押し動作を実行
const executeShortPress = (palette: PaletteKey, state: State, actions: Actions) => {
    const modeType = state.mode.type;
    const colorize = state.fumen.guideLineColor;

    // Comp の場合
    if (palette === 'Comp') {
        // Fill/FillRow/SelectPiece では DrawingToolMode に切り替えてから実行
        if (modeType === ModeTypes.Fill || modeType === ModeTypes.FillRow || modeType === ModeTypes.SelectPiece) {
            actions.changeToDrawingToolMode();
            actions.selectInferencePieceColor();
        } else {
            actions.selectInferencePieceColor();
        }
        return;
    }

    const piece = paletteToPiece(palette);
    if (piece === null) return;

    switch (modeType) {
    // DrawingTool/Utils/Flags/Comment/Slide モード: selectPieceColor
    case ModeTypes.DrawingTool:
    case ModeTypes.Utils:
    case ModeTypes.Flags:
    case ModeTypes.Comment:
    case ModeTypes.Slide:
    case ModeTypes.Drawing:
    case ModeTypes.Piece:
        actions.selectPieceColor({ piece });
        break;

    // Fill/FillRow モード: selectFillPieceColor
    case ModeTypes.Fill:
    case ModeTypes.FillRow:
        actions.selectFillPieceColor({ piece });
        break;

    // SelectPiece モード: ミノは spawnPiece + changeToMovePieceMode + changeToPieceMode
    // Empty/Gray は changeToDrawingToolMode + selectPieceColor
    case ModeTypes.SelectPiece:
        if (isMino(palette)) {
            actions.spawnPiece({ piece, guideline: colorize });
            actions.changeToMovePieceMode();
            actions.changeToPieceMode();
        } else {
            // Empty/Gray の場合は DrawingToolMode に切り替え
            actions.changeToDrawingToolMode();
            actions.selectPieceColor({ piece });
        }
        break;
    }
};

// 長押し動作を実行
const executeLongPress = (palette: PaletteKey, state: State, actions: Actions) => {
    const colorize = state.fumen.guideLineColor;

    // Comp は長押し動作なし
    if (palette === 'Comp') {
        return;
    }

    // Empty: clearFieldAndPiece
    if (palette === 'Empty') {
        actions.clearFieldAndPiece();
        return;
    }

    // Gray: convertToGray
    if (palette === 'Gray') {
        actions.convertToGray();
        return;
    }

    // ミノ: spawnPiece + changeToMovePieceMode
    if (isMino(palette)) {
        const piece = paletteToPiece(palette);
        if (piece !== null) {
            actions.spawnPiece({ piece, guideline: colorize });
            actions.changeToMovePieceMode();
        }
    }
};

// 現在の状態を取得するためのgetter (mainから呼び出し時に設定)
let getState: (() => State) | null = null;
let getActions: (() => Actions) | null = null;

export const initShortcutHandlers = (
    stateGetter: () => State,
    actionsGetter: () => Actions,
) => {
    getState = stateGetter;
    getActions = actionsGetter;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
};

const handleKeyDown = (event: KeyboardEvent) => {
    if (!getState || !getActions) return;

    const state = getState();
    const actions = getActions();

    // エディタ画面以外は無効
    if (state.mode.screen !== Screens.Editor) return;

    // モーダル表示中は無効
    if (isAnyModalOpen(state)) return;

    // 入力フォーカス中は無効
    if (isInputFocused()) return;

    // 修飾キー押下中は無効
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // 修飾キー自体は無視
    if (isModifierKey(event.code)) return;

    const palette = findPaletteByCode(state.mode.paletteShortcuts, event.code);
    if (!palette) return;

    event.preventDefault();

    // リピート防止
    if (pressedKey === event.code) return;
    pressedKey = event.code;
    longPressExecuted = false;

    // 長押しタイマー開始
    longPressTimer = setTimeout(() => {
        executeLongPress(palette, getState!(), getActions!());
        longPressExecuted = true;
        longPressTimer = null;
    }, LONG_PRESS_DURATION);
};

const handleKeyUp = (event: KeyboardEvent) => {
    if (pressedKey !== event.code) return;

    if (!getState || !getActions) {
        pressedKey = null;
        return;
    }

    const state = getState();
    const actions = getActions();
    const palette = findPaletteByCode(state.mode.paletteShortcuts, event.code);

    // 長押しタイマーが残っていれば短押し
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        if (palette) {
            executeShortPress(palette, state, actions);
        }
    }

    pressedKey = null;
    longPressExecuted = false;
};

const handleBlur = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    pressedKey = null;
    longPressExecuted = false;
};
