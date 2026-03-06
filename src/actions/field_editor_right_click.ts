import { isMinoPiece, Piece, toPositionIndex } from '../lib/enums';
import { Move } from '../lib/fumen/types';
import { getBlockPositions } from '../lib/piece';

export const isCurrentPieceIndex = (piece: Move | undefined, index: number): boolean => {
    if (piece === undefined || !isMinoPiece(piece.type)) {
        return false;
    }

    return getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y)
        .map(toPositionIndex)
        .some(positionIndex => positionIndex === index);
};

// Returns true only when the clicked cell is part of the SPAWN mino AND
// the underlying raw field block is empty (no normal block beneath the SPAWN mino).
// Normal block erase is prioritized: if a field block exists at a SPAWN mino position,
// the field block is erased instead of removing the SPAWN mino.
export const shouldReturnCurrentPieceOnRightClick = (
    rawFieldPiece: Piece,
    piece: Move | undefined,
    index: number,
): boolean => {
    return isCurrentPieceIndex(piece, index) && rawFieldPiece === Piece.Empty;
};
