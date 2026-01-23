import { parseFieldText, looksLikeFieldText } from '../text_parser';
import { Piece } from '../../enums';

describe('text_parser', () => {
    describe('parseFieldText', () => {
        test('valid 20x10 field with all piece types', () => {
            const lines = [
                '..........', // row 1 (top)
                '..........', // row 2
                '..........', // row 3
                '..........', // row 4
                '..........', // row 5
                '..........', // row 6
                '..........', // row 7
                '..........', // row 8
                '..........', // row 9
                '..........', // row 10
                '..........', // row 11
                '..........', // row 12
                '..........', // row 13
                '..........', // row 14
                '..........', // row 15
                '..........', // row 16
                'IIIIIIIIII', // row 17
                'OOOOOOOOOO', // row 18
                'TTTTTTTTTT', // row 19
                'GGGGGGGGGG', // row 20 (bottom)
            ];
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(true);
            if (result.success) {
                for (let x = 0; x < 10; x += 1) {
                    expect(result.field.get(x, 0)).toBe(Piece.Gray);
                    expect(result.field.get(x, 1)).toBe(Piece.T);
                    expect(result.field.get(x, 2)).toBe(Piece.O);
                    expect(result.field.get(x, 3)).toBe(Piece.I);
                }
            }
        });

        test('lowercase symbols are accepted', () => {
            const lines = Array(19).fill('..........').concat(['ioltjszg..']);
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.field.get(0, 0)).toBe(Piece.I);
                expect(result.field.get(1, 0)).toBe(Piece.O);
                expect(result.field.get(2, 0)).toBe(Piece.L);
                expect(result.field.get(3, 0)).toBe(Piece.T);
                expect(result.field.get(4, 0)).toBe(Piece.J);
                expect(result.field.get(5, 0)).toBe(Piece.S);
                expect(result.field.get(6, 0)).toBe(Piece.Z);
                expect(result.field.get(7, 0)).toBe(Piece.Gray);
            }
        });

        test('CRLF line endings', () => {
            const lines = Array(20).fill('..........');
            const result = parseFieldText(lines.join('\r\n'));
            expect(result.success).toBe(true);
        });

        test('CR line endings', () => {
            const lines = Array(20).fill('..........');
            const result = parseFieldText(lines.join('\r'));
            expect(result.success).toBe(true);
        });

        test('trailing spaces are trimmed', () => {
            const lines = Array(20).fill('..........   ');
            const result = parseFieldText(lines.join('\n'));
            expect(result.success).toBe(true);
        });

        test('leading/trailing empty lines are trimmed', () => {
            const fieldLines = Array(20).fill('..........').join('\n');
            const field = `\n\n${fieldLines}\n\n`;
            const result = parseFieldText(field);
            expect(result.success).toBe(true);
        });

        test('rejects 19 rows', () => {
            const lines = Array(19).fill('..........');
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errorKey).toBe('Clipboard.Errors.InvalidRowCount');
            }
        });

        test('rejects 21 rows', () => {
            const lines = Array(21).fill('..........');
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(false);
        });

        test('rejects 9 columns', () => {
            const lines = Array(20).fill('.........');
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errorKey).toBe('Clipboard.Errors.InvalidColumnCount');
            }
        });

        test('rejects invalid symbols', () => {
            const lines = Array(19).fill('..........').concat(['..Q.......']);
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errorKey).toBe('Clipboard.Errors.InvalidSymbol');
            }
        });

        test('accepts G and X for gray', () => {
            const lines = Array(18).fill('..........').concat([
                'GGGGGGGGGG',
                'XXXXXXXXXX',
            ]);
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.field.get(0, 0)).toBe(Piece.Gray);
                expect(result.field.get(0, 1)).toBe(Piece.Gray);
            }
        });

        test('accepts underscore for empty', () => {
            const lines = Array(19).fill('..........').concat(['__________']);
            const result = parseFieldText(lines.join('\n'));

            expect(result.success).toBe(true);
            if (result.success) {
                for (let x = 0; x < 10; x += 1) {
                    expect(result.field.get(x, 0)).toBe(Piece.Empty);
                }
            }
        });
    });

    describe('looksLikeFieldText', () => {
        test('returns true for valid 20x10 format', () => {
            const lines = Array(20).fill('..........');
            expect(looksLikeFieldText(lines.join('\n'))).toBe(true);
        });

        test('returns false for fumen string', () => {
            expect(looksLikeFieldText('v115@vhAAgH')).toBe(false);
        });

        test('returns false for URL', () => {
            expect(looksLikeFieldText('https://example.com')).toBe(false);
        });

        test('returns false for wrong row count', () => {
            const lines = Array(19).fill('..........');
            expect(looksLikeFieldText(lines.join('\n'))).toBe(false);
        });

        test('returns false for wrong column count', () => {
            const lines = Array(20).fill('.........');
            expect(looksLikeFieldText(lines.join('\n'))).toBe(false);
        });
    });
});
