import { nextRotationToLeft, nextRotationToRight, Piece, Rotation } from './enums';
import { Field } from './fumen/field';
import { getBlockPositions } from './piece';

const zeroOffset: [number, number] = [0, 0];

type Offset = { plus: [number, number]; minus: [number, number] };
type HtmlRotation = 0 | 1 | 2 | 3;
type HtmlRotationOffsets = { [r in HtmlRotation]: Offset };

const makeAll = (plus: [number, number], minus: [number, number]): Offset => ({ plus, minus });
const makeZero = (): Offset => ({ plus: zeroOffset, minus: zeroOffset });

// rtta[ct=0] in the legacy HTML, converted to y-up coordinates.
const iOffsetsByHtml: HtmlRotationOffsets = {
    0: makeAll([+1, 0], [+1, 0]),
    1: makeAll([-1, 0], [-1, 0]),
    2: makeAll([+1, 0], [+1, 0]),
    3: makeAll([-1, 0], [-1, 0]),
};

const ltjOffsetsByHtml: HtmlRotationOffsets = {
    0: makeAll([0, 0], [0, 0]),
    1: makeAll([0, -1], [0, 0]),
    2: makeAll([0, +1], [0, +1]),
    3: makeAll([0, 0], [0, -1]),
};

const zeroOffsetsByHtml: HtmlRotationOffsets = {
    0: makeZero(),
    1: makeZero(),
    2: makeZero(),
    3: makeZero(),
};

const CLASSIC_OFFSETS_BY_HTML: { [p in Piece]?: HtmlRotationOffsets } = {
    [Piece.I]: iOffsetsByHtml,
    [Piece.L]: ltjOffsetsByHtml,
    [Piece.O]: zeroOffsetsByHtml,
    [Piece.Z]: zeroOffsetsByHtml,
    [Piece.T]: ltjOffsetsByHtml,
    [Piece.J]: ltjOffsetsByHtml,
    [Piece.S]: zeroOffsetsByHtml,
};

const isClassicTwoStatePiece = (piece: Piece): boolean => {
    return piece === Piece.I || piece === Piece.S || piece === Piece.Z;
};

const isClassicTwoStateI = (piece: Piece): boolean => {
    return piece === Piece.I;
};

const isClassicTwoStateSZ = (piece: Piece): boolean => {
    return piece === Piece.S || piece === Piece.Z;
};

const normalizeClassicRotation = (piece: Piece, rotation: Rotation): Rotation => {
    if (!isClassicTwoStatePiece(piece)) {
        return rotation;
    }

    if (isClassicTwoStateI(piece)) {
        if (rotation === Rotation.Reverse) {
            return Rotation.Spawn;
        }
    } else if (isClassicTwoStateSZ(piece)) {
        if (rotation === Rotation.Spawn) {
            return Rotation.Reverse;
        }
    }

    if (rotation === Rotation.Left) {
        return Rotation.Right;
    }

    return rotation;
};

const nextClassicRotation = (piece: Piece, rotation: Rotation, clockwise: boolean): Rotation => {
    if (isClassicTwoStateI(piece)) {
        return rotation === Rotation.Spawn ? Rotation.Right : Rotation.Spawn;
    }

    if (isClassicTwoStateSZ(piece)) {
        return rotation === Rotation.Reverse ? Rotation.Right : Rotation.Reverse;
    }

    return clockwise ? nextRotationToRight(rotation) : nextRotationToLeft(rotation);
};

// project Rotation -> legacy HTML p[1] index for ct=0 branch
const toHtmlRotation = (rotation: Rotation): HtmlRotation => {
    switch (rotation) {
    case Rotation.Spawn:
        return 2;
    case Rotation.Right:
        return 1;
    case Rotation.Reverse:
        return 0;
    case Rotation.Left:
        return 3;
    }
};

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

const buildCandidates = (
    piece: Piece,
    currentRotation: Rotation,
    nextRotation: Rotation,
    clockwise: boolean,
    field: Field,
    x: number,
    y: number,
): [number, number][] => {
    const currentHtml = toHtmlRotation(currentRotation);
    const nextHtml = toHtmlRotation(nextRotation);

    const offsets = CLASSIC_OFFSETS_BY_HTML[piece];
    // In legacy krot, right rotation uses rot=-1 -> "minus" branch.
    const primary = offsets !== undefined
        ? (clockwise ? offsets[currentHtml].minus : offsets[currentHtml].plus)
        : zeroOffset;

    const [pdx, pdy] = primary;
    const candidates: [number, number][] = [[pdx, pdy]];

    if (piece === Piece.I) {
        if (currentHtml === 0 || currentHtml === 2) {
            const canMoveDown = fits(field, Piece.I, currentRotation, x, y - 1);
            if (!canMoveDown) {
                candidates.push([pdx, pdy + 1]);
                candidates.push([pdx, pdy + 2]);
            }
        } else {
            candidates.push([pdx - 1, pdy]);
            candidates.push([pdx + 1, pdy]);
            candidates.push([pdx + 2, pdy]);
        }
        return candidates;
    }

    if (piece === Piece.O) {
        return candidates;
    }

    const nx = x + pdx;
    const ny = y + pdy;

    let rtcenter = false;
    for (let dy = -1; dy <= 1; dy += 1) {
        const ry = ny + dy;
        if (nx >= 0 && nx <= 9 && ry >= 0 && ry <= 22) {
            const idx = ry * 10 + nx;
            if (field.getAtIndex(idx, true) !== Piece.Empty) {
                rtcenter = true;
                break;
            }
        }
    }

    if ((piece === Piece.L && currentHtml === 0) || (piece === Piece.J && currentHtml === 2)) {
        const rx = nx + 1;
        const ry = ny + 1;
        if (rx >= 0 && rx <= 9 && ry >= 0 && ry <= 22) {
            if (field.getAtIndex(ry * 10 + rx, true) !== Piece.Empty) {
                rtcenter = false;
            }
        }
    }

    if ((piece === Piece.L && currentHtml === 2) || (piece === Piece.J && currentHtml === 0)) {
        const rx = nx - 1;
        const ry = ny + 1;
        if (rx >= 0 && rx <= 9 && ry >= 0 && ry <= 22) {
            if (field.getAtIndex(ry * 10 + rx, true) !== Piece.Empty) {
                rtcenter = false;
            }
        }
    }

    const isHorizontal = currentHtml === 1 || currentHtml === 3;
    if (isHorizontal || !rtcenter) {
        candidates.push([pdx + 1, pdy]);
        candidates.push([pdx - 1, pdy]);
    }

    // Legacy condition: add one-cell up test when destination p[1] is 2.
    if (piece === Piece.T && nextHtml === 2) {
        candidates.push([pdx, pdy + 1]);
    }

    return candidates;
};

export const classicTestLeftRotation = (
    piece: Piece,
    currentRotation: Rotation,
    field: Field,
    x: number,
    y: number,
): { test: [number, number][]; rotation: Rotation } => {
    const normalizedCurrentRotation = normalizeClassicRotation(piece, currentRotation);
    const nextRotation = nextClassicRotation(piece, normalizedCurrentRotation, false);
    const test = buildCandidates(piece, normalizedCurrentRotation, nextRotation, false, field, x, y);
    return { test, rotation: nextRotation };
};

export const classicTestRightRotation = (
    piece: Piece,
    currentRotation: Rotation,
    field: Field,
    x: number,
    y: number,
): { test: [number, number][]; rotation: Rotation } => {
    const normalizedCurrentRotation = normalizeClassicRotation(piece, currentRotation);
    const nextRotation = nextClassicRotation(piece, normalizedCurrentRotation, true);
    const test = buildCandidates(piece, normalizedCurrentRotation, nextRotation, true, field, x, y);
    return { test, rotation: nextRotation };
};
