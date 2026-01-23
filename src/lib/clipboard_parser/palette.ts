import { Piece } from '../enums';

export interface RGBColor {
    r: number;
    g: number;
    b: number;
}

/**
 * TETR.IO palette colors (primary detection palette)
 */
export const TETRIO_PALETTE: Record<Piece, RGBColor[]> = {
    [Piece.I]: [
        { r: 0, g: 200, b: 200 },
        { r: 0, g: 255, b: 255 },
        { r: 49, g: 199, b: 239 },
        { r: 66, g: 182, b: 206 },
    ],
    [Piece.O]: [
        { r: 200, g: 200, b: 0 },
        { r: 255, g: 255, b: 0 },
        { r: 247, g: 211, b: 8 },
        { r: 239, g: 239, b: 82 },
    ],
    [Piece.T]: [
        { r: 160, g: 0, b: 160 },
        { r: 255, g: 0, b: 255 },
        { r: 173, g: 77, b: 156 },
        { r: 181, g: 49, b: 189 },
    ],
    [Piece.L]: [
        { r: 200, g: 100, b: 0 },
        { r: 255, g: 165, b: 0 },
        { r: 239, g: 121, b: 33 },
        { r: 239, g: 149, b: 57 },
    ],
    [Piece.J]: [
        { r: 0, g: 0, b: 200 },
        { r: 0, g: 0, b: 255 },
        { r: 66, g: 105, b: 190 },
        { r: 90, g: 101, b: 173 },
    ],
    [Piece.S]: [
        { r: 0, g: 200, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 102, g: 198, b: 92 },
        { r: 107, g: 181, b: 107 },
    ],
    [Piece.Z]: [
        { r: 200, g: 0, b: 0 },
        { r: 255, g: 0, b: 0 },
        { r: 239, g: 32, b: 41 },
        { r: 239, g: 82, b: 82 },
    ],
    [Piece.Empty]: [
        { r: 0, g: 0, b: 0 },
        { r: 32, g: 32, b: 32 },
        { r: 16, g: 16, b: 16 },
    ],
    [Piece.Gray]: [],
};

/**
 * Gray/Garbage detection parameters
 */
export const GRAY_DETECTION = {
    maxChannelDelta: 30,
    minBrightness: 60,
    maxBrightness: 200,
};

/**
 * Color matching tolerance (Euclidean distance)
 */
export const COLOR_TOLERANCE = 80;

/**
 * Calculate Euclidean color distance
 */
export const colorDistance = (c1: RGBColor, c2: RGBColor): number => {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2),
    );
};

/**
 * Check if a color is gray (garbage block)
 */
export const isGrayColor = (color: RGBColor): boolean => {
    const { r, g, b } = color;
    const brightness = (r + g + b) / 3;

    if (brightness < GRAY_DETECTION.minBrightness ||
        brightness > GRAY_DETECTION.maxBrightness) {
        return false;
    }

    const maxDiff = Math.max(
        Math.abs(r - brightness),
        Math.abs(g - brightness),
        Math.abs(b - brightness),
    );

    return maxDiff <= GRAY_DETECTION.maxChannelDelta;
};

/**
 * Match a color to the closest Piece
 */
export const matchColorToPiece = (color: RGBColor): Piece | null => {
    if (isGrayColor(color)) {
        return Piece.Gray;
    }

    let bestMatch: Piece | null = null;
    let bestDistance = COLOR_TOLERANCE;

    for (const pieceStr of Object.keys(TETRIO_PALETTE)) {
        const piece = parseInt(pieceStr, 10) as Piece;
        const colors = TETRIO_PALETTE[piece];

        for (const paletteColor of colors) {
            const dist = colorDistance(color, paletteColor);
            if (dist < bestDistance) {
                bestDistance = dist;
                bestMatch = piece;
            }
        }
    }

    return bestMatch;
};
