import { FieldConstants, Piece } from '../enums';
import { Field } from '../fumen/field';
import { ClipboardParseOutcome, ImageParseOptions } from './types';
import { RGBColor, matchColorToPiece } from './palette';

// Type declarations for OffscreenCanvas (not available in all environments)
declare const OffscreenCanvas: {
    new(width: number, height: number): HTMLCanvasElement;
} | undefined;

const EXPECTED_COLS = FieldConstants.Width;
const MIN_ROWS = 1;
const MAX_ROWS = FieldConstants.Height;

const DEFAULT_OPTIONS: Required<ImageParseOptions> = {
    ratioTolerance: 0.15,
    alphaThreshold: 128,
    unknownColorThreshold: 0.05,
};

const inferRowCount = (
    width: number,
    height: number,
    ratioTolerance: number,
): number | null => {
    if (width <= 0 || height <= 0) {
        return null;
    }

    const ratio = height / width;
    let bestRows: number | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (let rows = MIN_ROWS; rows <= MAX_ROWS; rows += 1) {
        const expectedRatio = rows / EXPECTED_COLS;
        const diff = Math.abs(ratio - expectedRatio);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestRows = rows;
        }
    }

    if (bestRows === null) {
        return null;
    }

    const expectedRatio = bestRows / EXPECTED_COLS;
    if (bestDiff > ratioTolerance * expectedRatio) {
        return null;
    }

    return bestRows;
};

/**
 * Get average color from center region of a cell
 */
const getCellCenterColor = (
    imageData: ImageData,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    alphaThreshold: number,
): RGBColor | null => {
    const centerX = Math.floor(cellX + cellWidth / 2);
    const centerY = Math.floor(cellY + cellHeight / 2);

    const sampleSize = Math.min(5, Math.floor(cellWidth / 3), Math.floor(cellHeight / 3));
    const halfSample = Math.floor(sampleSize / 2);

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let validPixels = 0;

    for (let dy = -halfSample; dy <= halfSample; dy += 1) {
        for (let dx = -halfSample; dx <= halfSample; dx += 1) {
            const px = centerX + dx;
            const py = centerY + dy;

            if (px < 0 || px >= imageData.width || py < 0 || py >= imageData.height) {
                continue;
            }

            const idx = (py * imageData.width + px) * 4;
            const alpha = imageData.data[idx + 3];

            if (alpha >= alphaThreshold) {
                totalR += imageData.data[idx];
                totalG += imageData.data[idx + 1];
                totalB += imageData.data[idx + 2];
                validPixels += 1;
            }
        }
    }

    if (validPixels === 0) {
        return null;
    }

    return {
        r: Math.round(totalR / validPixels),
        g: Math.round(totalG / validPixels),
        b: Math.round(totalB / validPixels),
    };
};

/**
 * Parse an image blob as a 10-column field with variable rows
 */
export const parseFieldImage = async (
    imageBlob: Blob,
    options: ImageParseOptions = {},
): Promise<ClipboardParseOutcome> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const imageBitmap = await createImageBitmap(imageBlob);
    const { width, height } = imageBitmap;

    const ratio = height / width;
    const inferredRows = inferRowCount(width, height, opts.ratioTolerance);

    if (inferredRows === null) {
        return {
            success: false,
            error: `Invalid aspect ratio: ${ratio.toFixed(2)} (expected ${EXPECTED_COLS} columns, ${MIN_ROWS}-${MAX_ROWS} rows)`,
            errorKey: 'Clipboard.Errors.InvalidImageRatio',
        };
    }

    // Use OffscreenCanvas if available, otherwise fall back to HTMLCanvasElement
    let canvas: HTMLCanvasElement;
    if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
    } else {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
    }

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) {
        return {
            success: false,
            error: 'Failed to create canvas context',
            errorKey: 'Clipboard.Errors.CanvasError',
        };
    }

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);

    const cellWidth = width / EXPECTED_COLS;
    const cellHeight = height / inferredRows;

    const field = new Field({});
    let unknownCells = 0;
    const totalCells = inferredRows * EXPECTED_COLS;

    for (let row = 0; row < inferredRows; row += 1) {
        for (let col = 0; col < EXPECTED_COLS; col += 1) {
            const cellX = col * cellWidth;
            const cellY = row * cellHeight;

            const color = getCellCenterColor(
                imageData, cellX, cellY, cellWidth, cellHeight, opts.alphaThreshold,
            );

            let piece: Piece;

            if (color === null) {
                piece = Piece.Empty;
            } else {
                const matched = matchColorToPiece(color);
                if (matched === null) {
                    unknownCells += 1;
                    piece = Piece.Empty;
                } else {
                    piece = matched;
                }
            }

            if (piece !== Piece.Empty) {
                const fieldRow = inferredRows - 1 - row;
                field.setToPlayField(col + fieldRow * EXPECTED_COLS, piece);
            }
        }
    }

    const unknownRatio = unknownCells / totalCells;

    if (unknownRatio > opts.unknownColorThreshold) {
        return {
            success: false,
            error: `Too many unknown colors: ${(unknownRatio * 100).toFixed(1)}%`,
            errorKey: 'Clipboard.Errors.TooManyUnknownColors',
        };
    }

    const result: ClipboardParseOutcome = { field, success: true };

    if (unknownCells > 0) {
        result.warning = `${unknownCells} cells had unknown colors (treated as empty)`;
    }

    return result;
};

/**
 * Quick validation of image dimensions
 */
export const validateImageDimensions = (
    width: number,
    height: number,
    ratioTolerance: number = 0.15,
): boolean => {
    return inferRowCount(width, height, ratioTolerance) !== null;
};
