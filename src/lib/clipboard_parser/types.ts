import { Piece } from '../enums';
import { Field } from '../fumen/field';

export interface ClipboardParseResult {
    success: true;
    field: Field;
    warning?: string;
}

export interface ClipboardParseError {
    success: false;
    error: string;
    errorKey: string;
}

export type ClipboardParseOutcome = ClipboardParseResult | ClipboardParseError;

export interface TextParseOptions {
    expectedRows?: number;
    expectedCols?: number;
}

export interface ImageParseOptions {
    ratioTolerance?: number;
    alphaThreshold?: number;
    unknownColorThreshold?: number;
}

export const VALID_PIECE_SYMBOLS = new Set(['.', '_', ' ', 'I', 'O', 'T', 'L', 'J', 'S', 'Z', 'G', 'X']);

export const symbolToPiece = (symbol: string): Piece | null => {
    switch (symbol.toUpperCase()) {
    case '.':
    case '_':
    case ' ':
        return Piece.Empty;
    case 'I':
        return Piece.I;
    case 'O':
        return Piece.O;
    case 'T':
        return Piece.T;
    case 'L':
        return Piece.L;
    case 'J':
        return Piece.J;
    case 'S':
        return Piece.S;
    case 'Z':
        return Piece.Z;
    case 'G':
    case 'X':
        return Piece.Gray;
    default:
        return null;
    }
};
