import { validateImageDimensions } from '../image_parser';

describe('image_parser', () => {
    describe('validateImageDimensions', () => {
        test('accepts 100x200 (ratio 2.0)', () => {
            expect(validateImageDimensions(100, 200)).toBe(true);
        });

        test('accepts 100x230 (ratio 2.30, within 15%)', () => {
            expect(validateImageDimensions(100, 230)).toBe(true);
        });

        test('accepts 100x170 (ratio 1.70, within 15%)', () => {
            expect(validateImageDimensions(100, 170)).toBe(true);
        });

        test('rejects 100x250 (ratio 2.5)', () => {
            expect(validateImageDimensions(100, 250)).toBe(false);
        });

        test('rejects 100x150 (ratio 1.5)', () => {
            expect(validateImageDimensions(100, 150)).toBe(false);
        });

        test('accepts standard sizes', () => {
            expect(validateImageDimensions(200, 400)).toBe(true);
            expect(validateImageDimensions(300, 600)).toBe(true);
            expect(validateImageDimensions(150, 300)).toBe(true);
        });

        test('rejects at boundary', () => {
            // 15% of 2.0 = 0.30, so ratio must be between 1.70 and 2.30
            // ratio = 2.31 is out
            expect(validateImageDimensions(100, 231)).toBe(false);
            // ratio = 1.69 is out
            expect(validateImageDimensions(100, 169)).toBe(false);
        });
    });
});
