import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { EditShortcuts, PaletteShortcuts, PieceShortcuts, State } from '../states';
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
    keepPieceShortcut: (data: { shortcut: keyof PieceShortcuts, code: string }) => action;
    keepPieceShortcutDas: (data: { dasMs: number }) => action;
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
                    pieceShortcuts: { ...state.mode.pieceShortcuts },
                    pieceShortcutDasMs: state.mode.pieceShortcutDasMs,
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
            actions.changePieceShortcuts({
                pieceShortcuts: state.temporary.userSettings.pieceShortcuts,
            }),
            actions.changePieceShortcutDas({
                dasMs: state.temporary.userSettings.pieceShortcutDasMs,
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

        // Cross-category deduplication: clear from all categories
        const newPaletteShortcuts = { ...state.temporary.userSettings.paletteShortcuts };
        const newEditShortcuts = { ...state.temporary.userSettings.editShortcuts };
        const newPieceShortcuts = { ...state.temporary.userSettings.pieceShortcuts };

        if (code) {
            // Clear from Palette (except current)
            for (const key of Object.keys(newPaletteShortcuts) as (keyof PaletteShortcuts)[]) {
                if (newPaletteShortcuts[key] === code && key !== palette) {
                    newPaletteShortcuts[key] = '';
                }
            }
            // Clear from Edit
            for (const key of Object.keys(newEditShortcuts) as (keyof EditShortcuts)[]) {
                if (newEditShortcuts[key] === code) {
                    newEditShortcuts[key] = '';
                }
            }
            // Clear from Piece
            for (const key of Object.keys(newPieceShortcuts) as (keyof PieceShortcuts)[]) {
                if (newPieceShortcuts[key] === code) {
                    newPieceShortcuts[key] = '';
                }
            }
        }
        newPaletteShortcuts[palette] = code;

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    paletteShortcuts: newPaletteShortcuts,
                    editShortcuts: newEditShortcuts,
                    pieceShortcuts: newPieceShortcuts,
                },
            },
        };
    },
    keepEditShortcut: ({ shortcut, code }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        // Cross-category deduplication: clear from all categories
        const newPaletteShortcuts = { ...state.temporary.userSettings.paletteShortcuts };
        const newEditShortcuts = { ...state.temporary.userSettings.editShortcuts };
        const newPieceShortcuts = { ...state.temporary.userSettings.pieceShortcuts };

        if (code) {
            // Clear from Palette
            for (const key of Object.keys(newPaletteShortcuts) as (keyof PaletteShortcuts)[]) {
                if (newPaletteShortcuts[key] === code) {
                    newPaletteShortcuts[key] = '';
                }
            }
            // Clear from Edit (except current)
            for (const key of Object.keys(newEditShortcuts) as (keyof EditShortcuts)[]) {
                if (newEditShortcuts[key] === code && key !== shortcut) {
                    newEditShortcuts[key] = '';
                }
            }
            // Clear from Piece
            for (const key of Object.keys(newPieceShortcuts) as (keyof PieceShortcuts)[]) {
                if (newPieceShortcuts[key] === code) {
                    newPieceShortcuts[key] = '';
                }
            }
        }
        newEditShortcuts[shortcut] = code;

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    paletteShortcuts: newPaletteShortcuts,
                    editShortcuts: newEditShortcuts,
                    pieceShortcuts: newPieceShortcuts,
                },
            },
        };
    },
    keepPieceShortcut: ({ shortcut, code }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        // Cross-category deduplication: clear from all categories
        const newPaletteShortcuts = { ...state.temporary.userSettings.paletteShortcuts };
        const newEditShortcuts = { ...state.temporary.userSettings.editShortcuts };
        const newPieceShortcuts = { ...state.temporary.userSettings.pieceShortcuts };

        if (code) {
            // Clear from Palette
            for (const key of Object.keys(newPaletteShortcuts) as (keyof PaletteShortcuts)[]) {
                if (newPaletteShortcuts[key] === code) {
                    newPaletteShortcuts[key] = '';
                }
            }
            // Clear from Edit
            for (const key of Object.keys(newEditShortcuts) as (keyof EditShortcuts)[]) {
                if (newEditShortcuts[key] === code) {
                    newEditShortcuts[key] = '';
                }
            }
            // Clear from Piece (except current)
            for (const key of Object.keys(newPieceShortcuts) as (keyof PieceShortcuts)[]) {
                if (newPieceShortcuts[key] === code && key !== shortcut) {
                    newPieceShortcuts[key] = '';
                }
            }
        }
        newPieceShortcuts[shortcut] = code;

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    paletteShortcuts: newPaletteShortcuts,
                    editShortcuts: newEditShortcuts,
                    pieceShortcuts: newPieceShortcuts,
                },
            },
        };
    },
    keepPieceShortcutDas: ({ dasMs }) => (state): NextState => {
        if (!state.modal.userSettings) {
            return undefined;
        }

        return {
            temporary: {
                ...state.temporary,
                userSettings: {
                    ...state.temporary.userSettings,
                    pieceShortcutDasMs: dasMs,
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
        pieceShortcuts: JSON.stringify(state.mode.pieceShortcuts),
        pieceShortcutDasMs: state.mode.pieceShortcutDasMs,
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
