import { Piece } from '../../enums';
import { Field, PlayField } from '../../fumen/field';
import { fieldToCC } from '../fieldConverter';

describe('fieldToCC', () => {
    test('empty field produces 400 zeros', () => {
        const field = new Field({});
        const result = fieldToCC(field);
        expect(result.length).toBe(400);
        expect(result.every(v => v === 0)).toBe(true);
    });

    test('blocks in field are mapped to 1', () => {
        const field = new Field({});
        // Set a block at (0, 0) - bottom-left
        field.setToPlayField(0, Piece.I);
        // Set a block at (9, 0) - bottom-right
        field.setToPlayField(9, Piece.T);

        const result = fieldToCC(field);
        expect(result[0]).toBe(1);  // y=0, x=0
        expect(result[9]).toBe(1);  // y=0, x=9
        expect(result[1]).toBe(0);  // y=0, x=1 (empty)
    });

    test('blocks at row 22 (top visible row) are mapped correctly', () => {
        const field = new Field({});
        // y=22 is the topmost visible row; index in playField = x + 22*10
        field.setToPlayField(5 + 22 * 10, Piece.Gray);

        const result = fieldToCC(field);
        expect(result[22 * 10 + 5]).toBe(1);
    });

    test('rows 23-39 are always zero', () => {
        const field = new Field({});
        // Fill all visible rows with blocks
        for (let y = 0; y < 23; y += 1) {
            for (let x = 0; x < 10; x += 1) {
                field.setToPlayField(x + y * 10, Piece.Gray);
            }
        }

        const result = fieldToCC(field);
        // y=0..22 should be 1
        for (let i = 0; i < 230; i += 1) {
            expect(result[i]).toBe(1);
        }
        // y=23..39 should be 0
        for (let i = 230; i < 400; i += 1) {
            expect(result[i]).toBe(0);
        }
    });

    test('sent line is excluded', () => {
        const sentLine = new PlayField({ length: 10 });
        for (let x = 0; x < 10; x += 1) {
            sentLine.setAt(x, Piece.Gray);
        }
        const field = new Field({ sentLine });

        const result = fieldToCC(field);
        // All 400 bytes should be 0 (sent line not included)
        expect(result.every(v => v === 0)).toBe(true);
    });

    test('Gray pieces are treated as filled', () => {
        const field = new Field({});
        field.setToPlayField(0, Piece.Gray);

        const result = fieldToCC(field);
        expect(result[0]).toBe(1);
    });

    test('all piece types map to 1', () => {
        const field = new Field({});
        const pieces = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Gray];
        pieces.forEach((piece, i) => {
            field.setToPlayField(i, piece);
        });

        const result = fieldToCC(field);
        pieces.forEach((_, i) => {
            expect(result[i]).toBe(1);
        });
        expect(result[8]).toBe(0); // x=8 is empty
    });
});
