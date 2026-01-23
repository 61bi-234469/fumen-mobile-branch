import { Piece } from '../enums';
import { Field } from '../fumen/field';
import { ClipboardParseOutcome, TextParseOptions, VALID_PIECE_SYMBOLS, symbolToPiece } from './types';

const EXPECTED_ROWS = 20;
const EXPECTED_COLS = 10;

/**
 * Normalizes line endings and trims the text appropriately
 */
const normalizeText = (text: string): string[] => {
    // Normalize line endings: CRLF -> LF, CR -> LF
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into lines
    let lines = normalized.split('\n');

    // Trim trailing spaces per line
    lines = lines.map(line => line.trimEnd());

    // Remove leading empty lines
    while (lines.length > 0 && lines[0].trim() === '') {
        lines.shift();
    }

    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
        lines.pop();
    }

    return lines;
};

/**
 * Validates that a character is a valid piece symbol
 */
const isValidSymbol = (char: string): boolean => {
    return VALID_PIECE_SYMBOLS.has(char.toUpperCase()) || VALID_PIECE_SYMBOLS.has(char);
};

/**
 * Attempts to parse text as a 20x10 field
 */
export const parseFieldText = (
    text: string,
    options: TextParseOptions = {},
): ClipboardParseOutcome => {
    const expectedRows = options.expectedRows ?? EXPECTED_ROWS;
    const expectedCols = options.expectedCols ?? EXPECTED_COLS;

    const lines = normalizeText(text);

    // Validate row count
    if (lines.length !== expectedRows) {
        return {
            success: false,
            error: `Expected ${expectedRows} rows, got ${lines.length}`,
            errorKey: 'Clipboard.Errors.InvalidRowCount',
        };
    }

    // Validate each line and collect pieces
    const pieces: Piece[][] = [];

    for (let row = 0; row < lines.length; row += 1) {
        const line = lines[row];

        // Validate column count
        if (line.length !== expectedCols) {
            return {
                success: false,
                error: `Row ${row + 1}: Expected ${expectedCols} columns, got ${line.length}`,
                errorKey: 'Clipboard.Errors.InvalidColumnCount',
            };
        }

        const rowPieces: Piece[] = [];

        for (let col = 0; col < line.length; col += 1) {
            const char = line[col];

            if (!isValidSymbol(char)) {
                return {
                    success: false,
                    error: `Row ${row + 1}, Col ${col + 1}: Invalid symbol '${char}'`,
                    errorKey: 'Clipboard.Errors.InvalidSymbol',
                };
            }

            const piece = symbolToPiece(char);
            if (piece === null) {
                return {
                    success: false,
                    error: `Row ${row + 1}, Col ${col + 1}: Unknown symbol '${char}'`,
                    errorKey: 'Clipboard.Errors.UnknownSymbol',
                };
            }

            rowPieces.push(piece);
        }

        pieces.push(rowPieces);
    }

    // Convert to Field object
    // Text is top-to-bottom, Field is bottom-to-top
    const field = new Field({});

    for (let textRow = 0; textRow < expectedRows; textRow += 1) {
        const fieldRow = expectedRows - 1 - textRow;
        for (let col = 0; col < expectedCols; col += 1) {
            const piece = pieces[textRow][col];
            if (piece !== Piece.Empty) {
                field.setToPlayField(col + fieldRow * expectedCols, piece);
            }
        }
    }

    return { field, success: true };
};

/**
 * Quick check if text might be a 20x10 field (before full parsing)
 */
export const looksLikeFieldText = (text: string): boolean => {
    const lines = normalizeText(text);

    // Must have exactly 20 lines
    if (lines.length !== EXPECTED_ROWS) {
        return false;
    }

    // Each line should be exactly 10 chars and contain only valid symbols
    return lines.every(line =>
        line.length === EXPECTED_COLS &&
        Array.from(line).every(char => isValidSymbol(char)),
    );
};
