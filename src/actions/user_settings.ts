import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { EditShortcuts, PaletteShortcuts, State } from '../states';
import { localStorageWrapper } from '../memento';
import { Piece } from '../lib/enums';

export interface UserSettingsActions {
    copyUserSettingsToTemporary: () => action;
    commitUserSettings: () => action;
    keepGhostVisible: (data: { visible: boolean }) => action;
    keepLoop: (data: { enable: boolean }) => action;
    keepGradient: (data: { gradient: string }) => action;
    keepPaletteShortcut: (data: { palette: keyof PaletteShortcuts, code: string }) => action;
    keepEditShortcut: (data: { shortcut: keyof EditShortcuts, code: string }) => action;
}

export const userSettingsActions: Readonly<UserSettingsActions> = {
    copyUserSettingsToTemporary: () => (state): NextState => {
        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ghostVisible: state.mode.ghostVisible,
                    loop: state.mode.loop,
                    gradient: gradientToStr(state.mode.gradient),
                    paletteShortcuts: { ...state.mode.paletteShortcuts },
                    editShortcuts: { ...state.mode.editShortcuts },
                },
            },
        };
    },
    commitUserSettings: () => (state): NextState => {
        return sequence(state, [
            actions.changeGhostVisible({ visible: state.temporary.userSettings.ghostVisible }),
            actions.changeLoop({ enable: state.temporary.userSettings.loop }),
            actions.changeGradient({ gradientStr: state.temporary.userSettings.gradient }),
            actions.changePaletteShortcuts({
                paletteShortcuts: state.temporary.userSettings.paletteShortcuts,
            }),
            actions.changeEditShortcuts({
                editShortcuts: state.temporary.userSettings.editShortcuts,
            }),
            saveToLocalStorage,
            actions.reopenCurrentPage(),
        ]);
    },
    keepGhostVisible: ({ visible }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    ghostVisible: visible,
                },
            },
        };
    },
    keepLoop: ({ enable }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    loop: enable,
                },
            },
        };
    },
    keepGradient: ({ gradient }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    gradient,
                },
            },
        };
    },
    keepPaletteShortcut: ({ palette, code }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        // 重複チェック：同じcodeを持つ他パレットをクリア（後勝ち）
        const newShortcuts = { ...state.temporary.userSettings.paletteShortcuts };
        if (code) {
            for (const key of Object.keys(newShortcuts) as (keyof PaletteShortcuts)[]) {
                if (newShortcuts[key] === code && key !== palette) {
                    newShortcuts[key] = '';
                }
            }
        }
        newShortcuts[palette] = code;

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    paletteShortcuts: newShortcuts,
                },
            },
        };
    },
    keepEditShortcut: ({ shortcut, code }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        // 重複チェック：同じcodeを持つ他ショートカットをクリア（後勝ち）
        const newShortcuts = { ...state.temporary.userSettings.editShortcuts };
        if (code) {
            for (const key of Object.keys(newShortcuts) as (keyof EditShortcuts)[]) {
                if (newShortcuts[key] === code && key !== shortcut) {
                    newShortcuts[key] = '';
                }
            }
        }
        newShortcuts[shortcut] = code;

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    editShortcuts: newShortcuts,
                },
            },
        };
    },
};

const saveToLocalStorage = (state: Readonly<State>): NextState => {
    localStorageWrapper.saveUserSettings({
        ghostVisible: state.mode.ghostVisible,
        loop: state.mode.loop,
        gradient: gradientToStr(state.mode.gradient),
        paletteShortcuts: JSON.stringify(state.mode.paletteShortcuts),
        editShortcuts: JSON.stringify(state.mode.editShortcuts),
    });
    return undefined;
};

export const gradientPieces = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S];

const gradientToStr = (gradient: State['mode']['gradient']): string => {
    let str = '';
    for (const piece of gradientPieces) {
        str += (gradient[piece] || '0');
    }
    return str;
};
