import { isMinoPiece, Piece, toPositionIndex } from '../lib/enums';
import { Move } from '../lib/fumen/types';
import { getBlockPositions } from '../lib/piece';
import { Block, HighlightType } from '../state_types';

export const isCurrentPieceIndex = (piece: Move | undefined, index: number): boolean => {
    if (piece === undefined || !isMinoPiece(piece.type)) {
        return false;
    }

    return getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y)
        .map(toPositionIndex)
        .some(positionIndex => positionIndex === index);
};

export const isNormalBlock = (block: Block | undefined): boolean => {
    if (block === undefined) {
        return false;
    }

    return block.piece !== Piece.Empty
        && block.piece !== 'inference'
        && block.highlight !== HighlightType.Lighter;
};

export const shouldReturnCurrentPieceOnRightClick = (
    block: Block | undefined,
    piece: Move | undefined,
    index: number,
): boolean => {
    return isCurrentPieceIndex(piece, index) || !isNormalBlock(block);
};
