import { FieldConstants, Piece } from '../enums';
import { Field } from '../fumen/field';

export function fieldToCC(field: Field): Uint8Array {
    const result = new Uint8Array(400); // 40 rows x 10 cols, all zeros
    // Map app field (23 rows, y=0..22) to CC field (y=0..22)
    // y=23..39 remain 0 (empty)
    // sent line (y=-1) is excluded
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = field.get(x, y);
            if (piece !== Piece.Empty) {
                result[y * FieldConstants.Width + x] = 1;
            }
        }
    }
    return result;
}
