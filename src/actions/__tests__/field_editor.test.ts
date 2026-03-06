import { Piece, Rotation, toPositionIndex } from '../../lib/enums';
import { Block, HighlightType } from '../../state_types';
import { getBlockPositions } from '../../lib/piece';
import { shouldReturnCurrentPieceOnRightClick } from '../field_editor_right_click';

describe('shouldReturnCurrentPieceOnRightClick', () => {
    const currentPiece = {
        type: Piece.T,
        rotation: Rotation.Spawn,
        coordinate: { x: 4, y: 0 },
    };

    test('prefers normal block handling when the clicked cell is not part of the current piece', () => {
        const block: Block = { piece: Piece.L, highlight: HighlightType.Normal };

        expect(shouldReturnCurrentPieceOnRightClick(block, currentPiece, 0)).toBe(false);
    });

    test('returns the current piece when the clicked cell is part of the current piece', () => {
        const spawnIndex = toPositionIndex(getBlockPositions(
            currentPiece.type,
            currentPiece.rotation,
            currentPiece.coordinate.x,
            currentPiece.coordinate.y,
        )[0]);
        const block: Block = { piece: currentPiece.type, highlight: HighlightType.Highlight2 };

        expect(shouldReturnCurrentPieceOnRightClick(block, currentPiece, spawnIndex)).toBe(true);
    });

    test('keeps current-piece removal on empty cells', () => {
        const block: Block = { piece: Piece.Empty };

        expect(shouldReturnCurrentPieceOnRightClick(block, currentPiece, 0)).toBe(true);
    });
});
