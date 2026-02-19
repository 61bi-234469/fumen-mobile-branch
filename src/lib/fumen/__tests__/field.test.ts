import { Field, PlayField } from '../field';
import { Piece, Rotation } from '../../enums';
import { FumenError } from '../../errors';

describe('field', () => {
    describe('load', () => {
        test('regular case', () => {
            const field = PlayField.load(
                'XXXXX_____' +
                'ZZZZZ_____',
                'IIIII_____',
            );

            for (let x = 0; x < 5; x += 1) {
                expect(field.get(x, 0)).toEqual(Piece.I);
                expect(field.get(x, 1)).toEqual(Piece.Z);
                expect(field.get(x, 2)).toEqual(Piece.Gray);
            }

            for (let x = 5; x < 10; x += 1) {
                expect(field.get(x, 0)).toEqual(Piece.Empty);
                expect(field.get(x, 1)).toEqual(Piece.Empty);
                expect(field.get(x, 2)).toEqual(Piece.Empty);
            }

            expect(field.get(0, 3)).toEqual(Piece.Empty);
        });

        test('lower case', () => {
            const field = PlayField.load('I_JL_SZ_TX');
            expect(field).toEqual(PlayField.load('i_jl_sz_tx'));
            expect(field).not.toEqual(PlayField.loadMinify('i_jl_sz_tx'));
            expect(field.numOfBlocks).toEqual(230);
        });

        test('minify', () => {
            const field = PlayField.loadMinify('_XIJLSZTX_');
            expect(field).toEqual(PlayField.loadMinify('_xijlsztx_'));
            expect(field).not.toEqual(PlayField.load('_XIJLSZTX_'));
            expect(field.numOfBlocks).toEqual(10);
        });

        test('9 chars field', () => {
            expect(() => PlayField.load('XXXXX___')).toThrow(FumenError);
        });
    });

    test('get & add', () => {
        const field = new PlayField({});
        for (let y = 0; y < 23; y += 1) {
            for (let x = 0; x < 10; x += 1) {
                expect(field.get(x, y)).toEqual(Piece.Empty);

                field.add(x, y, 3);
                expect(field.get(x, y)).toEqual(3);

                field.add(x, y, -2);
                expect(field.get(x, y)).toEqual(1);

                field.add(x, y, -2);
                expect(field.get(x, y)).toEqual(0);
            }
        }
    });

    describe('put', () => {
        test('I-Spawn', () => {
            const field = new PlayField({});
            field.put({
                type: Piece.I,
                rotation: Rotation.Spawn,
                coordinate: { x: 1, y: 0 },
            });

            expect(field.get(0, 0)).toEqual(Piece.I);
            expect(field.get(1, 0)).toEqual(Piece.I);
            expect(field.get(2, 0)).toEqual(Piece.I);
            expect(field.get(3, 0)).toEqual(Piece.I);
        });

        test('S-Left', () => {
            const field = new PlayField({});
            field.put({
                type: Piece.S,
                rotation: Rotation.Left,
                coordinate: { x: 3, y: 4 },
            });

            expect(field.get(2, 5)).toEqual(Piece.S);
            expect(field.get(2, 4)).toEqual(Piece.S);
            expect(field.get(3, 4)).toEqual(Piece.S);
            expect(field.get(3, 3)).toEqual(Piece.S);
        });
    });

    describe('clearLine', () => {
        test('regular', () => {
            const field = PlayField.load(
                '_XXXXXXXXX' +
                'XXXXXXXXXX' +
                'SLZXOSZTI_',
                'LJSZOXXXXX',
            );

            field.clearLine();

            expect(field).toEqual(PlayField.load(
                '_XXXXXXXXX' +
                'SLZXOSZTI_',
            ));
        });

        test('clear no line', () => {
            const field = PlayField.load(
                'SLZX_OOZLI',
                '_LZXOOOOI_',
                '__________',
                '_LZXOSZTIO',
            );

            field.clearLine();

            expect(field).toEqual(field);
        });

        test('clear all line', () => {
            const field = PlayField.load(
                'SLZXSOOZLI',
                'ZLZXOOOOIX',
                'OOOOOOZTIO',
            );

            field.clearLine();

            expect(field).toEqual(PlayField.load(''));
        });
    });

    test('up', () => {
        const field = PlayField.load(
            'III_______',
            'OOOO______',
        );

        const blockUp = PlayField.loadMinify(
            'SSSSS_____',
            'ZZZZZZ____',
        );

        field.up(blockUp);

        expect(field).toEqual(PlayField.load(
            'III_______',
            'OOOO______',
            'SSSSS_____',
            'ZZZZZZ____',
        ));
    });

    test('mirror', () => {
        const field = PlayField.load(
            'III_______',
            'OOOO______',
            'SSSSS_____',
        );

        field.mirror();

        expect(field).toEqual(PlayField.load(
            '_______III',
            '______OOOO',
            '_____SSSSS',
        ));
    });

    test('to array', () => {
        const field = new PlayField({});
        const array = field.toArray();
        expect(array).toHaveLength(230);
        expect(array.every(value => value === Piece.Empty)).toBeTruthy();

        // 配列に変換後、fieldを操作しても変化しない
        field.put({
            type: Piece.I,
            rotation: Rotation.Left,
            coordinate: { x: 1, y: 0 },
        });
        expect(array).toHaveLength(230);
        expect(array.every(value => value === Piece.Empty)).toBeTruthy();
    });

    describe('convertNonGrayToEmpty', () => {
        test('PlayField: converts all colored pieces to Empty, keeps Gray and Empty', () => {
            const field = PlayField.load(
                'XX________',
                'ILTSZOJ___',
            );

            field.convertNonGrayToEmpty();

            // カラーブロックはすべて Empty に変換される
            expect(field.get(0, 0)).toEqual(Piece.Empty); // I
            expect(field.get(1, 0)).toEqual(Piece.Empty); // L
            expect(field.get(2, 0)).toEqual(Piece.Empty); // T
            expect(field.get(3, 0)).toEqual(Piece.Empty); // S
            expect(field.get(4, 0)).toEqual(Piece.Empty); // Z
            expect(field.get(5, 0)).toEqual(Piece.Empty); // O
            expect(field.get(6, 0)).toEqual(Piece.Empty); // J
            // Gray は残る
            expect(field.get(0, 1)).toEqual(Piece.Gray);  // X
            expect(field.get(1, 1)).toEqual(Piece.Gray);  // X
            // Empty はそのまま
            expect(field.get(7, 0)).toEqual(Piece.Empty);
            expect(field.get(2, 1)).toEqual(Piece.Empty);
        });

        test('PlayField: no change when already all Empty', () => {
            const field = new PlayField({});
            const before = field.toArray().slice();

            field.convertNonGrayToEmpty();

            expect(field.toArray()).toEqual(before);
        });

        test('PlayField: no change when already all Gray', () => {
            const field = PlayField.load('XXXXXXXXXX');

            field.convertNonGrayToEmpty();

            for (let x = 0; x < 10; x += 1) {
                expect(field.get(x, 0)).toEqual(Piece.Gray);
            }
        });

        test('Field: convertNonGrayToEmpty also applies to sentLine', () => {
            const field = new Field({});
            // playField に I ブロックを置く
            field.setToPlayField(0, Piece.I);
            // sentLine に T ブロックを置く
            field.setToSentLine(0, Piece.T);
            // Gray を playField と sentLine に置く
            field.setToPlayField(1, Piece.Gray);
            field.setToSentLine(1, Piece.Gray);

            field.convertNonGrayToEmpty();

            // playField のカラーは Empty に
            expect(field.get(0, 0)).toEqual(Piece.Empty);
            // sentLine のカラーは Empty に（y=-1 が sentLine の row 0）
            expect(field.get(0, -1)).toEqual(Piece.Empty);
            // playField の Gray は残る
            expect(field.get(1, 0)).toEqual(Piece.Gray);
            // sentLine の Gray は残る
            expect(field.get(1, -1)).toEqual(Piece.Gray);
        });
    });
});
