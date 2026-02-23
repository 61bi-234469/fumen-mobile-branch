import { PieceShortcuts } from '../states';

export type PieceShortcutKey = keyof PieceShortcuts;

type PieceShortcutActions = {
    moveToLeft?: () => void;
    moveToRight?: () => void;
    harddrop?: () => void;
    rotateToLeft?: () => void;
    rotateToRight?: () => void;
    clearPiece?: () => void;
};

export const executePieceShortcut = (
    key: PieceShortcutKey,
    actions: PieceShortcutActions,
) => {
    switch (key) {
    case 'MoveLeft':
        actions.moveToLeft?.();
        break;
    case 'MoveRight':
        actions.moveToRight?.();
        break;
    case 'Drop':
        actions.harddrop?.();
        break;
    case 'RotateLeft':
        actions.rotateToLeft?.();
        break;
    case 'RotateRight':
        actions.rotateToRight?.();
        break;
    case 'Reset':
        actions.clearPiece?.();
        break;
    }
};
