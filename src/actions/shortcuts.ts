import { ModeTypes, Piece, Screens } from '../lib/enums';
import { isModifierKey } from '../lib/shortcuts';
import { EditShortcuts, PaletteShortcuts, State } from '../states';
import { Actions } from '../actions';
import { TreeViewMode } from '../lib/fumen/tree_types';

const LONG_PRESS_DURATION = 500;

// 長押し状態管理
let pressedKey: string | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let longPressExecuted = false;

// アクティブなショートカット種別
type ActiveShortcut = {
    type: 'palette';
    key: PaletteKey;
} | {
    type: 'edit';
    key: EditShortcutKey;
} | null;

let activeShortcut: ActiveShortcut = null;

// パレットキーの種類
type PaletteKey = keyof PaletteShortcuts;

// 編集用ショートカットキーの種類
type EditShortcutKey = keyof EditShortcuts;

// 画面ごとに許可される編集用ショートカット
const allowedEditShortcuts: { [screen in Screens]: EditShortcutKey[] } = {
    [Screens.Editor]: ['InsertPage', 'PrevPage', 'NextPage', 'Menu', 'ListView', 'TreeView', 'EditHome'],
    [Screens.Reader]: ['Menu', 'ListView', 'TreeView', 'PrevPage', 'NextPage', 'EditHome'],
    [Screens.ListView]: ['ListView', 'TreeView', 'EditHome'],
};

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

// codeから編集用ショートカットを検索
const findEditShortcutByCode = (shortcuts: EditShortcuts, code: string): EditShortcutKey | null => {
    for (const key of Object.keys(shortcuts) as EditShortcutKey[]) {
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

// パレット短押し動作を実行
const executePaletteShortPress = (palette: PaletteKey, state: State, actions: Actions) => {
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

// パレット長押し動作を実行
const executePaletteLongPress = (palette: PaletteKey, state: State, actions: Actions) => {
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

// 編集用ショートカット短押し動作を実行
const executeEditShortPress = (key: EditShortcutKey, state: State, actions: Actions) => {
    const screen = state.mode.screen;
    const loop = state.mode.loop;

    switch (key) {
    case 'InsertPage':
        actions.duplicatePageOnly({ index: state.fumen.currentIndex + 1 });
        break;
    case 'PrevPage':
        // Editor は loop:false、Reader は loop設定に従う
        actions.backPage({ loop: screen === Screens.Reader ? loop : false });
        break;
    case 'NextPage':
        // Editor は loop:false、Reader は loop設定に従う
        actions.nextPage({ loop: screen === Screens.Reader ? loop : false });
        break;
    case 'Menu':
        actions.openMenuModal();
        break;
    case 'ListView':
        if (screen === Screens.ListView) {
            // ListView画面ではListモードに切り替え
            actions.setTreeViewMode({ mode: TreeViewMode.List });
        } else {
            actions.changeToListViewScreen();
        }
        break;
    case 'TreeView':
        actions.changeToTreeViewScreen();
        break;
    case 'EditHome':
        if (screen === Screens.Editor) {
            actions.changeToDrawingToolMode();
        } else if (screen === Screens.Reader) {
            actions.changeToDrawerScreen({ refresh: true });
        } else if (screen === Screens.ListView) {
            actions.changeToEditorFromListView();
        }
        break;
    }
};

// 編集用ショートカット長押し動作を実行
const executeEditLongPress = (key: EditShortcutKey, state: State, actions: Actions) => {
    switch (key) {
    case 'PrevPage':
        actions.firstPage();
        break;
    case 'NextPage':
        actions.lastPage();
        break;
    case 'ListView':
        // ListView長押し → TreeView
        actions.changeToTreeViewScreen();
        break;
    // InsertPage, Menu, TreeView は長押し動作なし
    }
};

// 長押し動作があるかどうか
const hasEditLongPress = (key: EditShortcutKey): boolean => {
    return key === 'PrevPage' || key === 'NextPage' || key === 'ListView';
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
    const screen = state.mode.screen;

    // モーダル表示中は無効
    if (isAnyModalOpen(state)) return;

    // 入力フォーカス中は無効
    if (isInputFocused()) return;

    // 修飾キー押下中は無効
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // 修飾キー自体は無視
    if (isModifierKey(event.code)) return;

    // リピート防止
    if (pressedKey === event.code) return;

    // 編集用ショートカットを優先して検索
    const editShortcut = findEditShortcutByCode(state.mode.editShortcuts, event.code);
    const allowedKeys = allowedEditShortcuts[screen];

    if (editShortcut && allowedKeys.includes(editShortcut)) {
        event.preventDefault();
        pressedKey = event.code;
        longPressExecuted = false;
        activeShortcut = { type: 'edit', key: editShortcut };

        // 長押しタイマー開始（長押し動作がある場合のみ）
        if (hasEditLongPress(editShortcut)) {
            longPressTimer = setTimeout(() => {
                executeEditLongPress(editShortcut, getState!(), getActions!());
                longPressExecuted = true;
                longPressTimer = null;
            }, LONG_PRESS_DURATION);
        }
        return;
    }

    // エディタ画面以外はパレットショートカット無効
    if (screen !== Screens.Editor) return;

    // パレットショートカットを検索
    const palette = findPaletteByCode(state.mode.paletteShortcuts, event.code);
    if (!palette) return;

    event.preventDefault();
    pressedKey = event.code;
    longPressExecuted = false;
    activeShortcut = { type: 'palette', key: palette };

    // 長押しタイマー開始
    longPressTimer = setTimeout(() => {
        executePaletteLongPress(palette, getState!(), getActions!());
        longPressExecuted = true;
        longPressTimer = null;
    }, LONG_PRESS_DURATION);
};

const handleKeyUp = (event: KeyboardEvent) => {
    if (pressedKey !== event.code) return;

    if (!getState || !getActions) {
        pressedKey = null;
        activeShortcut = null;
        return;
    }

    const state = getState();
    const actions = getActions();

    // 長押しタイマーが残っていれば短押し
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;

        if (activeShortcut) {
            if (activeShortcut.type === 'edit') {
                executeEditShortPress(activeShortcut.key, state, actions);
            } else if (activeShortcut.type === 'palette') {
                executePaletteShortPress(activeShortcut.key, state, actions);
            }
        }
    } else if (!longPressExecuted && activeShortcut) {
        // 長押し動作がなかった場合（タイマー設定されない編集ショートカット）
        if (activeShortcut.type === 'edit' && !hasEditLongPress(activeShortcut.key)) {
            executeEditShortPress(activeShortcut.key, state, actions);
        }
    }

    pressedKey = null;
    activeShortcut = null;
    longPressExecuted = false;
};

const handleBlur = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    pressedKey = null;
    activeShortcut = null;
    longPressExecuted = false;
};
