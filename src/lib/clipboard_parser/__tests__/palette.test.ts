import { colorDistance, TETRIO_PALETTE, COLOR_TOLERANCE, isGrayColor, matchColorToPiece } from '../palette';
import { Piece } from '../../enums';

describe('palette', () => {
    describe('colorDistance', () => {
        test('same color returns 0', () => {
            const c = { r: 100, g: 150, b: 200 };
            expect(colorDistance(c, c)).toBe(0);
        });

        test('black and white', () => {
            const black = { r: 0, g: 0, b: 0 };
            const white = { r: 255, g: 255, b: 255 };
            const dist = colorDistance(black, white);
            expect(dist).toBeCloseTo(Math.sqrt(3 * 255 * 255));
        });

        test('red difference', () => {
            const c1 = { r: 0, g: 0, b: 0 };
            const c2 = { r: 100, g: 0, b: 0 };
            expect(colorDistance(c1, c2)).toBe(100);
        });
    });

    describe('TETRIO_PALETTE', () => {
        test('all pieces have colors defined', () => {
            const expectedPieces = [Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z, Piece.Empty];
            for (const piece of expectedPieces) {
                expect(TETRIO_PALETTE[piece]).toBeDefined();
                expect(Array.isArray(TETRIO_PALETTE[piece])).toBe(true);
            }
        });

        test('Gray has empty array (handled specially)', () => {
            expect(TETRIO_PALETTE[Piece.Gray]).toEqual([]);
        });
    });

    describe('isGrayColor', () => {
        test('returns true for mid-gray', () => {
            expect(isGrayColor({ r: 128, g: 128, b: 128 })).toBe(true);
        });

        test('returns true for near-gray', () => {
            expect(isGrayColor({ r: 130, g: 128, b: 126 })).toBe(true);
        });

        test('returns false for black (too dark)', () => {
            expect(isGrayColor({ r: 20, g: 20, b: 20 })).toBe(false);
        });

        test('returns false for white (too bright)', () => {
            expect(isGrayColor({ r: 250, g: 250, b: 250 })).toBe(false);
        });

        test('returns false for colored (channel deviation)', () => {
            expect(isGrayColor({ r: 200, g: 100, b: 100 })).toBe(false);
        });

        test('returns true at boundary brightness', () => {
            expect(isGrayColor({ r: 60, g: 60, b: 60 })).toBe(true);
            expect(isGrayColor({ r: 200, g: 200, b: 200 })).toBe(true);
        });
    });

    describe('matchColorToPiece', () => {
        test('matches cyan to I piece', () => {
            expect(matchColorToPiece({ r: 0, g: 255, b: 255 })).toBe(Piece.I);
        });

        test('matches yellow to O piece', () => {
            expect(matchColorToPiece({ r: 255, g: 255, b: 0 })).toBe(Piece.O);
        });

        test('matches purple to T piece', () => {
            expect(matchColorToPiece({ r: 160, g: 0, b: 160 })).toBe(Piece.T);
        });

        test('matches orange to L piece', () => {
            expect(matchColorToPiece({ r: 255, g: 165, b: 0 })).toBe(Piece.L);
        });

        test('matches blue to J piece', () => {
            expect(matchColorToPiece({ r: 0, g: 0, b: 255 })).toBe(Piece.J);
        });

        test('matches green to S piece', () => {
            expect(matchColorToPiece({ r: 0, g: 255, b: 0 })).toBe(Piece.S);
        });

        test('matches red to Z piece', () => {
            expect(matchColorToPiece({ r: 255, g: 0, b: 0 })).toBe(Piece.Z);
        });

        test('matches black to Empty', () => {
            expect(matchColorToPiece({ r: 0, g: 0, b: 0 })).toBe(Piece.Empty);
        });

        test('matches gray to Gray piece', () => {
            expect(matchColorToPiece({ r: 128, g: 128, b: 128 })).toBe(Piece.Gray);
        });

        test('returns null for unknown color', () => {
            expect(matchColorToPiece({ r: 255, g: 100, b: 200 })).toBeNull();
        });
    });
});
