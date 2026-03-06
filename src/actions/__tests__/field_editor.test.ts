import { Piece, Rotation, toPositionIndex } from '../../lib/enums';
import { getBlockPositions } from '../../lib/piece';
import { shouldReturnCurrentPieceOnRightClick } from '../field_editor_right_click';

describe('shouldReturnCurrentPieceOnRightClick', () => {
    const currentPiece = {
        type: Piece.T,
        rotation: Rotation.Spawn,
        coordinate: { x: 4, y: 0 },
    };

    const spawnIndex = toPositionIndex(getBlockPositions(
        currentPiece.type,
        currentPiece.rotation,
        currentPiece.coordinate.x,
        currentPiece.coordinate.y,
    )[0]);

    test('does not return piece when the clicked cell is not part of the current piece', () => {
        expect(shouldReturnCurrentPieceOnRightClick(Piece.L, currentPiece, 0)).toBe(false);
    });

    test('returns the current piece when the clicked cell is part of the SPAWN mino with no underlying block', () => {
        expect(shouldReturnCurrentPieceOnRightClick(Piece.Empty, currentPiece, spawnIndex)).toBe(true);
    });

    test('prefers normal block erase when the clicked SPAWN mino cell has an underlying field block', () => {
        expect(shouldReturnCurrentPieceOnRightClick(Piece.T, currentPiece, spawnIndex)).toBe(false);
    });

    test('does not return piece when clicking empty cell not part of SPAWN mino', () => {
        expect(shouldReturnCurrentPieceOnRightClick(Piece.Empty, currentPiece, 0)).toBe(false);
    });
});
