import { Piece, Rotation } from '../../enums';
import { getBlocks } from '../../piece';
import { CC_TO_PIECE, CC_ROTATION_TO_APP, PIECE_TO_CC } from '../types';

describe('PIECE_TO_CC and CC_TO_PIECE', () => {
    const minoPieces = [Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z];

    test('all mino pieces have CC mappings', () => {
        for (const piece of minoPieces) {
            expect(PIECE_TO_CC[piece]).toBeDefined();
        }
    });

    test('CC values are 0-6', () => {
        const ccValues = minoPieces.map(p => PIECE_TO_CC[p]);
        ccValues.sort((a, b) => a - b);
        expect(ccValues).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    test('round-trip: Piece → CC → Piece', () => {
        for (const piece of minoPieces) {
            const cc = PIECE_TO_CC[piece];
            const back = CC_TO_PIECE[cc];
            expect(back).toBe(piece);
        }
    });

    test('round-trip: CC → Piece → CC', () => {
        for (let cc = 0; cc <= 6; cc += 1) {
            const piece = CC_TO_PIECE[cc];
            const back = PIECE_TO_CC[piece];
            expect(back).toBe(cc);
        }
    });
});

describe('CC_ROTATION_TO_APP', () => {
    test('covers all 4 CC rotation values', () => {
        for (let r = 0; r <= 3; r += 1) {
            expect(CC_ROTATION_TO_APP[r]).toBeDefined();
        }
    });

    test('maps to all 4 app rotation values', () => {
        const appRotations = [0, 1, 2, 3].map(r => CC_ROTATION_TO_APP[r]);
        appRotations.sort((a, b) => a - b);
        expect(appRotations).toEqual([
            Rotation.Spawn, Rotation.Right, Rotation.Reverse, Rotation.Left,
        ]);
    });

    test('North=0 → Spawn', () => {
        expect(CC_ROTATION_TO_APP[0]).toBe(Rotation.Spawn);
    });

    test('South=1 → Reverse', () => {
        expect(CC_ROTATION_TO_APP[1]).toBe(Rotation.Reverse);
    });

    test('East=2 → Right', () => {
        expect(CC_ROTATION_TO_APP[2]).toBe(Rotation.Right);
    });

    test('West=3 → Left', () => {
        expect(CC_ROTATION_TO_APP[3]).toBe(Rotation.Left);
    });
});

describe('piece shape compatibility (app vs CC)', () => {
    // CC piece shapes (North-facing, from libtetris/src/piece.rs PieceState::cells()):
    // I: [(-1,0), (0,0), (1,0), (2,0)]
    // O: [(0,0), (1,0), (0,1), (1,1)]
    // T: [(-1,0), (0,0), (1,0), (0,1)]
    // L: [(-1,0), (0,0), (1,0), (1,1)]
    // J: [(-1,0), (0,0), (1,0), (-1,1)]
    // S: [(-1,0), (0,0), (0,1), (1,1)]
    // Z: [(-1,1), (0,1), (0,0), (1,0)]
    //
    // App pieces (North/Spawn-facing, from src/lib/piece.ts getPieces()):
    // I: [[0,0], [-1,0], [1,0], [2,0]]
    // T: [[0,0], [-1,0], [1,0], [0,1]]
    // O: [[0,0], [1,0], [0,1], [1,1]]
    // L: [[0,0], [-1,0], [1,0], [1,1]]
    // J: [[0,0], [-1,0], [1,0], [-1,1]]
    // S: [[0,0], [-1,0], [0,1], [1,1]]
    // Z: [[0,0], [1,0], [0,1], [-1,1]]
    //
    // Both use (0,0) as rotation center. Cell sets match (order differs but set is same).

    const sortCells = (cells: number[][]) =>
        cells.map(c => `${c[0]},${c[1]}`).sort().join(';');

    const ccShapes: Record<number, number[][]> = {
        0: [[-1, 0], [0, 0], [1, 0], [2, 0]],      // I
        1: [[0, 0], [1, 0], [0, 1], [1, 1]],        // O
        2: [[-1, 0], [0, 0], [1, 0], [0, 1]],       // T
        3: [[-1, 0], [0, 0], [1, 0], [1, 1]],       // L
        4: [[-1, 0], [0, 0], [1, 0], [-1, 1]],      // J
        5: [[-1, 0], [0, 0], [0, 1], [1, 1]],       // S
        6: [[-1, 1], [0, 1], [0, 0], [1, 0]],       // Z
    };

    // CC rotation transformation: (x,y) → East: (y,-x), South: (-x,-y), West: (-y,x)
    const rotateCCEast = (cells: number[][]) => cells.map(([x, y]) => [y, -x]);
    const rotateCCSouth = (cells: number[][]) => cells.map(([x, y]) => [-x, -y]);
    const rotateCCWest = (cells: number[][]) => cells.map(([x, y]) => [-y, x]);

    const minoPieces = [Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z];

    test('all mino pieces match CC shapes for all rotations', () => {
        for (const piece of minoPieces) {
            const ccPieceVal = PIECE_TO_CC[piece];
            const ccNorth = ccShapes[ccPieceVal];

            // App: getBlocks returns cells relative to rotation center at (0,0)
            // CC: cells are also relative to rotation center

            // Test all 4 rotations
            const ccRotated: Record<number, number[][]> = {
                0: ccNorth,                // North
                1: rotateCCSouth(ccNorth), // South
                2: rotateCCEast(ccNorth),  // East
                3: rotateCCWest(ccNorth),  // West
            };

            for (let ccRot = 0; ccRot <= 3; ccRot += 1) {
                const appRot = CC_ROTATION_TO_APP[ccRot];
                const appBlocks = getBlocks(piece, appRot);
                const ccBlocks = ccRotated[ccRot];

                expect(sortCells(appBlocks)).toBe(sortCells(ccBlocks));
            }
        }
    });
});
