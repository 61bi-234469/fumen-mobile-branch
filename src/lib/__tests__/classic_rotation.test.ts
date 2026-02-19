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
        expect(result.test[0]).toEqual([0, 1]);
    });

    it('O piece keeps same occupied cells after repeated CW rotations', () => {
        const field = emptyField();
        const start = { x: 5, y: 21, rotation: Rotation.Reverse };
        const startPositions = getBlockPositions(Piece.O, start.rotation, start.x, start.y)
            .map(([x, y]) => `${x},${y}`)
            .sort();

        let currentRotation = start.rotation;
        let currentX = start.x;
        let currentY = start.y;
        for (let i = 0; i < 4; i += 1) {
            const result = classicTestRightRotation(Piece.O, currentRotation, field, currentX, currentY);
            const [dx, dy] = result.test[0];
            currentRotation = result.rotation;
            currentX += dx;
            currentY += dy;
        }

        const afterPositions = getBlockPositions(Piece.O, currentRotation, currentX, currentY)
            .map(([x, y]) => `${x},${y}`)
            .sort();

        expect(afterPositions).toEqual(startPositions);
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

    it('S piece: Spawn -> Left and has fallback candidates in empty field', () => {
        const field = emptyField();
        const result = classicTestLeftRotation(Piece.S, Rotation.Spawn, field, 4, 10);
        expect(result.rotation).toBe(Rotation.Left);
        expect(result.test[0]).toEqual([0, 0]);
        expect(result.test.length).toBeGreaterThan(1);
    });
});

describe('classic two-state pieces', () => {
    const iExpectations = [
        { current: Rotation.Spawn, next: Rotation.Right },
        { current: Rotation.Right, next: Rotation.Spawn },
        { current: Rotation.Reverse, next: Rotation.Right },
        { current: Rotation.Left, next: Rotation.Spawn },
    ];

    [Piece.I].forEach((piece) => {
        iExpectations.forEach(({ current, next }) => {
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

    const zExpectations = [
        { current: Rotation.Spawn, next: Rotation.Right },
        { current: Rotation.Right, next: Rotation.Reverse },
        { current: Rotation.Reverse, next: Rotation.Right },
        { current: Rotation.Left, next: Rotation.Reverse },
    ];

    [Piece.Z].forEach((piece) => {
        zExpectations.forEach(({ current, next }) => {
            it(`CW: ${piece} ${current} -> ${next}`, () => {
                const result = classicTestRightRotation(piece, current, emptyField(), 4, 10);
                expect(result.rotation).toBe(next);
            });

            it(`CCW: ${piece} ${current} -> ${next}`, () => {
                const result = classicTestLeftRotation(piece, current, emptyField(), 4, 10);
                expect(result.rotation).toBe(next);
            });
        });

        it(`CW twice keeps ${piece} in the same cells from classic spawn state`, () => {
            const field = emptyField();
            const start = { x: 4, y: 21, rotation: Rotation.Reverse };

            const first = classicTestRightRotation(piece, start.rotation, field, start.x, start.y);
            const second = classicTestRightRotation(piece, first.rotation, field, start.x, start.y);

            const startPositions = getBlockPositions(piece, start.rotation, start.x, start.y)
                .map(([x, y]) => `${x},${y}`)
                .sort();
            const afterTwoPositions = getBlockPositions(piece, second.rotation, start.x, start.y)
                .map(([x, y]) => `${x},${y}`)
                .sort();

            expect(afterTwoPositions).toEqual(startPositions);
        });
    });

    const sExpectations = [
        { current: Rotation.Spawn, next: Rotation.Left },
        { current: Rotation.Right, next: Rotation.Reverse },
        { current: Rotation.Reverse, next: Rotation.Left },
        { current: Rotation.Left, next: Rotation.Reverse },
    ];

    [Piece.S].forEach((piece) => {
        sExpectations.forEach(({ current, next }) => {
            it(`CW: ${piece} ${current} -> ${next}`, () => {
                const result = classicTestRightRotation(piece, current, emptyField(), 4, 10);
                expect(result.rotation).toBe(next);
            });

            it(`CCW: ${piece} ${current} -> ${next}`, () => {
                const result = classicTestLeftRotation(piece, current, emptyField(), 4, 10);
                expect(result.rotation).toBe(next);
            });
        });

        it(`CW twice keeps ${piece} in the same cells from classic spawn state`, () => {
            const field = emptyField();
            const start = { x: 4, y: 21, rotation: Rotation.Reverse };

            const first = classicTestRightRotation(piece, start.rotation, field, start.x, start.y);
            const second = classicTestRightRotation(piece, first.rotation, field, start.x, start.y);

            const startPositions = getBlockPositions(piece, start.rotation, start.x, start.y)
                .map(([x, y]) => `${x},${y}`)
                .sort();
            const afterTwoPositions = getBlockPositions(piece, second.rotation, start.x, start.y)
                .map(([x, y]) => `${x},${y}`)
                .sort();

            expect(afterTwoPositions).toEqual(startPositions);
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
