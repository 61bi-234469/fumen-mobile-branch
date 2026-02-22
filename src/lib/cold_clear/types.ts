import { Piece, Rotation } from '../enums';

// === Worker Message Types (Main → Worker) ===

export interface CCInitMessage {
    type: 'init';
    field: Uint8Array;  // 400 bytes (40x10)
    hold: number;       // CC piece value (0-6) or 255 for none
    b2b: boolean;
    combo: number;
    queue: number[];    // CC piece values (0-6)
    thinkMs: number;
}

export interface CCRequestMoveMessage {
    type: 'requestMove';
}

export interface CCRequestTopMovesMessage {
    type: 'requestTopMoves';
    count: number;
}

export type WorkerMessage = CCInitMessage | CCRequestMoveMessage | CCRequestTopMovesMessage;

// === Worker Response Types (Worker → Main) ===

export interface CCMove {
    hold: boolean;      // Whether hold was used
    piece: number;      // CC piece value (0-6)
    rotation: number;   // CC rotation value (0-3)
    x: number;          // Rotation center X (left=0)
    y: number;          // Rotation center Y (bottom=0)
    score?: number;     // Move evaluation score from Cold Clear (optional)
}

export interface CCMoveResult extends CCMove {
    type: 'moveResult';
}

export interface CCTopMovesResult {
    type: 'topMovesResult';
    moves: CCMove[];
}

export interface CCInitDone {
    type: 'initDone';
}

export interface CCError {
    type: 'error';
    message: string;
}

export interface CCNoMove {
    type: 'noMove';
}

export type WorkerResponse = CCMoveResult | CCTopMovesResult | CCInitDone | CCError | CCNoMove;

// === Piece Mapping Tables ===
// CC C-API order: I=0, O=1, T=2, L=3, J=4, S=5, Z=6
// App Piece enum: Empty=0, I=1, L=2, O=3, Z=4, T=5, J=6, S=7, Gray=8

export const PIECE_TO_CC: Record<number, number> = {
    [Piece.I]: 0,
    [Piece.O]: 1,
    [Piece.T]: 2,
    [Piece.L]: 3,
    [Piece.J]: 4,
    [Piece.S]: 5,
    [Piece.Z]: 6,
};

export const CC_TO_PIECE: Record<number, Piece> = {
    0: Piece.I,
    1: Piece.O,
    2: Piece.T,
    3: Piece.L,
    4: Piece.J,
    5: Piece.S,
    6: Piece.Z,
};

export const CC_HOLD_NONE = 255;

// === Rotation Mapping ===
// CC RotationState: North=0, South=1, East=2, West=3
// App Rotation:     Spawn=0, Right=1, Reverse=2, Left=3

export const CC_ROTATION_TO_APP: Record<number, Rotation> = {
    0: Rotation.Spawn,    // North → Spawn
    1: Rotation.Reverse,  // South → Reverse
    2: Rotation.Right,    // East  → Right
    3: Rotation.Left,     // West  → Left
};
