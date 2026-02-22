import { Piece } from '../enums';

export interface ParsedQueue {
    hold: Piece | null;
    queue: Piece[];
}

const QUEUE_REGEX = /^([IOTLJSZiotljsz]:)?[IOTLJSZiotljsz]+$/;
const SCORED_QUEUE_REGEX = /^score=(-?(?:0|[1-9]\d*)\.\d{2}) \| ((?:[IOTLJSZiotljsz]:)?[IOTLJSZiotljsz]+)$/;
const OUTSIDE_TOP_QUEUE_REGEX = /^outsideTop=(\d+) \| ((?:[IOTLJSZiotljsz]:)?[IOTLJSZiotljsz]+)$/;

const CHAR_TO_PIECE: Record<string, Piece> = {
    I: Piece.I,
    O: Piece.O,
    T: Piece.T,
    L: Piece.L,
    J: Piece.J,
    S: Piece.S,
    Z: Piece.Z,
    i: Piece.I,
    o: Piece.O,
    t: Piece.T,
    l: Piece.L,
    j: Piece.J,
    s: Piece.S,
    z: Piece.Z,
};

const PIECE_TO_CHAR: Record<number, string> = {
    [Piece.I]: 'I',
    [Piece.O]: 'O',
    [Piece.T]: 'T',
    [Piece.L]: 'L',
    [Piece.J]: 'J',
    [Piece.S]: 'S',
    [Piece.Z]: 'Z',
};

export function parseQueueComment(text: string): ParsedQueue | null {
    const queueOnly = parseQueueOnlyComment(text);
    if (queueOnly) {
        return queueOnly;
    }

    const scoredMatch = SCORED_QUEUE_REGEX.exec(text);
    if (scoredMatch) {
        return parseQueueOnlyComment(scoredMatch[2]);
    }

    const outsideTopMatch = OUTSIDE_TOP_QUEUE_REGEX.exec(text);
    if (outsideTopMatch) {
        return parseQueueOnlyComment(outsideTopMatch[2]);
    }

    return null;
}

function parseQueueOnlyComment(text: string): ParsedQueue | null {
    if (!text || !QUEUE_REGEX.test(text)) {
        return null;
    }

    const colonIndex = text.indexOf(':');
    if (colonIndex === -1) {
        return {
            hold: null,
            queue: Array.prototype.map.call(text, (c: string) => CHAR_TO_PIECE[c]) as Piece[],
        };
    }

    const holdChar = text.substring(0, colonIndex);
    const queueStr = text.substring(colonIndex + 1);
    return {
        hold: CHAR_TO_PIECE[holdChar],
        queue: Array.prototype.map.call(queueStr, (c: string) => CHAR_TO_PIECE[c]) as Piece[],
    };
}

export function buildQueueComment(hold: Piece | null, queue: Piece[]): string {
    if (queue.length === 0) {
        return '';
    }
    const queueStr = queue.map(p => PIECE_TO_CHAR[p]).join('');
    if (hold === null) {
        return queueStr;
    }
    return `${PIECE_TO_CHAR[hold]}:${queueStr}`;
}
