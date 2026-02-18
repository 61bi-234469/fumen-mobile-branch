import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import { classicTestLeftRotation, classicTestRightRotation } from '../classic_rotation';
import { getBlockPositions } from '../piece';

const emptyField = () => new Field({});

const fits = (field: Field, piece: Piece, rotation: Rotation, x: number, y: number): boolean => {
    const positions = getBlockPositions(piece, rotation, x, y);
    const outOfBounds = positions.some(pos => pos[0] < 0 || 10 <= pos[0] || pos[1] < 0 || 24 <= pos[1]);
    if (outOfBounds) {
        return false;
    }

    return !positions.some((pos) => {
        const idx = pos[1] * 10 + pos[0];
        return field.getAtIndex(idx, true) !== Piece.Empty;
    });
};

const tryRotation = (
    result: { test: [number, number][]; rotation: Rotation },
    field: Field,
    piece: Piece,
    x: number,
    y: number,
): { found: true; dx: number; dy: number; rotation: Rotation } | { found: false } => {
    for (const [dx, dy] of result.test) {
        if (fits(field, piece, result.rotation, x + dx, y + dy)) {
            const rotation = result.rotation;
            return { dx, dy, rotation, found: true };
        }
    }

    return { found: false };
};

describe('classicTestRightRotation (CW)', () => {
    describe('I piece', () => {
        it('Spawn -> Right: primary x+1 succeeds in open field', () => {
            const field = emptyField();
            const result = classicTestRightRotation(Piece.I, Rotation.Spawn, field, 4, 20);
            expect(result.rotation).toBe(Rotation.Right);
            expect(result.test[0]).toEqual([1, 0]);

            const outcome = tryRotation(result, field, Piece.I, 4, 20);
            expect(outcome.found).toBe(true);
            if (outcome.found) {
                expect(outcome.dx).toBe(1);
            }
        });

        it('Right -> Spawn: primary x-1 succeeds in open field', () => {
            const field = emptyField();
            const result = classicTestRightRotation(Piece.I, Rotation.Right, field, 5, 20);
            expect(result.rotation).toBe(Rotation.Spawn);
            expect(result.test[0]).toEqual([-1, 0]);
            expect(tryRotation(result, field, Piece.I, 5, 20).found).toBe(true);
        });

        it('Right -> Spawn: fallback candidates include x-2, x+0, x+1', () => {
            const field = emptyField();
            const result = classicTestRightRotation(Piece.I, Rotation.Right, field, 5, 20);
            expect(result.test).toContainEqual([-2, 0]);
            expect(result.test).toContainEqual([0, 0]);
            expect(result.test).toContainEqual([1, 0]);
        });

        it('Reverse input is normalized and rotates to Right', () => {
            const field = emptyField();
            const result = classicTestRightRotation(Piece.I, Rotation.Reverse, field, 4, 20);
            expect(result.rotation).toBe(Rotation.Right);
            expect(result.test[0]).toEqual([1, 0]);
        });

        it('Spawn -> Right: up-kick fallback appears when piece cannot move down', () => {
            const field = emptyField();
            const result = classicTestRightRotation(Piece.I, Rotation.Spawn, field, 4, 0);
            expect(result.test).toContainEqual([1, 1]);
            expect(result.test).toContainEqual([1, 2]);
        });
    });

    describe('T piece', () => {
        it('Spawn -> Right: primary [0,+1] in open field', () => {
            const field = emptyField();
            const result = classicTestRightRotation(Piece.T, Rotation.Spawn, field, 4, 10);
            expect(result.rotation).toBe(Rotation.Right);
            expect(result.test[0]).toEqual([0, 1]);
            expect(tryRotation(result, field, Piece.T, 4, 10).found).toBe(true);
        });

        it('Right -> Reverse: primary [0,0]', () => {
            const field = emptyField();
            const result = classicTestRightRotation(Piece.T, Rotation.Right, field, 4, 10);
            expect(result.rotation).toBe(Rotation.Reverse);
            expect(result.test[0]).toEqual([0, 0]);
        });
    });

    it('O piece has only primary candidate', () => {
        const field = emptyField();
        const result = classicTestRightRotation(Piece.O, Rotation.Spawn, field, 4, 10);
        expect(result.test).toHaveLength(1);
        expect(result.test[0]).toEqual([0, 0]);
    });
});

describe('classicTestLeftRotation (CCW)', () => {
    describe('I piece', () => {
        it('Spawn -> Right in classic two-state mode', () => {
            const field = emptyField();
            const result = classicTestLeftRotation(Piece.I, Rotation.Spawn, field, 4, 20);
            expect(result.rotation).toBe(Rotation.Right);
            expect(result.test[0]).toEqual([1, 0]);
        });

        it('Right -> Spawn in classic two-state mode', () => {
            const field = emptyField();
            const result = classicTestLeftRotation(Piece.I, Rotation.Right, field, 5, 20);
            expect(result.rotation).toBe(Rotation.Spawn);
            expect(result.test[0]).toEqual([-1, 0]);
        });

        it('Left input is normalized and rotates to Spawn', () => {
            const field = emptyField();
            const result = classicTestLeftRotation(Piece.I, Rotation.Left, field, 5, 20);
            expect(result.rotation).toBe(Rotation.Spawn);
            expect(result.test[0]).toEqual([-1, 0]);
        });
    });

    describe('L piece', () => {
        it('Right -> Spawn (CCW): primary [0,-1]', () => {
            const field = emptyField();
            const result = classicTestLeftRotation(Piece.L, Rotation.Right, field, 4, 10);
            expect(result.rotation).toBe(Rotation.Spawn);
            expect(result.test[0]).toEqual([0, -1]);
        });

        it('Reverse -> Right (CCW): primary [0,0]', () => {
            const field = emptyField();
            const result = classicTestLeftRotation(Piece.L, Rotation.Reverse, field, 4, 10);
            expect(result.rotation).toBe(Rotation.Right);
            expect(result.test[0]).toEqual([0, 0]);
        });
    });

    it('S piece: Spawn -> Right and has fallback candidates in empty field', () => {
        const field = emptyField();
        const result = classicTestLeftRotation(Piece.S, Rotation.Spawn, field, 4, 10);
        expect(result.rotation).toBe(Rotation.Right);
        expect(result.test[0]).toEqual([0, 0]);
        expect(result.test.length).toBeGreaterThan(1);
    });
});

describe('classic two-state pieces', () => {
    const targets = [Piece.I, Piece.S, Piece.Z];

    const expectations = [
        { current: Rotation.Spawn, next: Rotation.Right },
        { current: Rotation.Right, next: Rotation.Spawn },
        { current: Rotation.Reverse, next: Rotation.Right },
        { current: Rotation.Left, next: Rotation.Spawn },
    ];

    targets.forEach((piece) => {
        expectations.forEach(({ current, next }) => {
            it(`CW: ${piece} ${current} -> ${next}`, () => {
                const result = classicTestRightRotation(piece, current, emptyField(), 4, 10);
                expect(result.rotation).toBe(next);
            });

            it(`CCW: ${piece} ${current} -> ${next}`, () => {
                const result = classicTestLeftRotation(piece, current, emptyField(), 4, 10);
                expect(result.rotation).toBe(next);
            });
        });
    });
});

describe('classic four-state pieces remain unchanged', () => {
    it('CCW: T Spawn -> Left', () => {
        const result = classicTestLeftRotation(Piece.T, Rotation.Spawn, emptyField(), 4, 10);
        expect(result.rotation).toBe(Rotation.Left);
    });

    it('CCW: T Left -> Reverse', () => {
        const result = classicTestLeftRotation(Piece.T, Rotation.Left, emptyField(), 4, 10);
        expect(result.rotation).toBe(Rotation.Reverse);
    });

    it('CW: T Spawn -> Right', () => {
        const result = classicTestRightRotation(Piece.T, Rotation.Spawn, emptyField(), 4, 10);
        expect(result.rotation).toBe(Rotation.Right);
    });

    it('CW: T Right -> Reverse', () => {
        const result = classicTestRightRotation(Piece.T, Rotation.Right, emptyField(), 4, 10);
        expect(result.rotation).toBe(Rotation.Reverse);
    });
});
