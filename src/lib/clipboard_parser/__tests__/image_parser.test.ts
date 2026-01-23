import { validateImageDimensions } from '../image_parser';

describe('image_parser', () => {
    describe('validateImageDimensions', () => {
        test('accepts 100x200 (ratio 2.0, 20 rows)', () => {
            expect(validateImageDimensions(100, 200)).toBe(true);
        });

        test('accepts 100x50 (ratio 0.5, 5 rows)', () => {
            expect(validateImageDimensions(100, 50)).toBe(true);
        });

        test('accepts 100x230 (ratio 2.30, 23 rows)', () => {
            expect(validateImageDimensions(100, 230)).toBe(true);
        });

        test('accepts 100x170 (ratio 1.70, 17 rows)', () => {
            expect(validateImageDimensions(100, 170)).toBe(true);
        });

        test('rejects 100x270 (ratio 2.7)', () => {
            expect(validateImageDimensions(100, 270)).toBe(false);
        });

        test('rejects 100x12 (ratio 0.12)', () => {
            expect(validateImageDimensions(100, 12)).toBe(false);
        });

        test('accepts standard sizes', () => {
            expect(validateImageDimensions(200, 400)).toBe(true);
            expect(validateImageDimensions(300, 600)).toBe(true);
            expect(validateImageDimensions(150, 300)).toBe(true);
        });

        test('rejects at boundary', () => {
            // 15% of 2.3 = 0.345, so ratio must be between 1.955 and 2.645
            // ratio = 2.66 is out
            expect(validateImageDimensions(100, 266)).toBe(false);
            // ratio = 0.16 falls between 1 and 2 rows
            expect(validateImageDimensions(100, 16)).toBe(false);
        });
    });
});
