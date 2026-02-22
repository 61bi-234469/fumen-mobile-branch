import { Piece } from '../../enums';
import { buildQueueComment, parseQueueComment } from '../queueParser';

describe('parseQueueComment', () => {
    test('parse queue without hold', () => {
        const result = parseQueueComment('IOTLJSZ');
        expect(result).toEqual({
            hold: null,
            queue: [Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z],
        });
    });

    test('parse queue with hold', () => {
        const result = parseQueueComment('T:IOSL');
        expect(result).toEqual({
            hold: Piece.T,
            queue: [Piece.I, Piece.O, Piece.S, Piece.L],
        });
    });

    test('parse single piece', () => {
        const result = parseQueueComment('I');
        expect(result).toEqual({
            hold: null,
            queue: [Piece.I],
        });
    });

    test('parse hold with single queue piece', () => {
        const result = parseQueueComment('T:I');
        expect(result).toEqual({
            hold: Piece.T,
            queue: [Piece.I],
        });
    });

    test('return null for empty string', () => {
        expect(parseQueueComment('')).toBeNull();
    });

    test('return null for non-piece characters', () => {
        expect(parseQueueComment('hello')).toBeNull();
    });

    test('return null for multiple colons', () => {
        expect(parseQueueComment('T:I:O')).toBeNull();
    });

    test('return null for quiz format', () => {
        expect(parseQueueComment('#Q=[]()')).toBeNull();
    });

    test('parse lowercase queue', () => {
        const result = parseQueueComment('iot');
        expect(result).toEqual({
            hold: null,
            queue: [Piece.I, Piece.O, Piece.T],
        });
    });

    test('return null for leading space', () => {
        expect(parseQueueComment(' IOTL')).toBeNull();
    });

    test('return null for trailing space', () => {
        expect(parseQueueComment('IOTL ')).toBeNull();
    });

    test('parse mixed case queue', () => {
        const result = parseQueueComment('IoTl');
        expect(result).toEqual({
            hold: null,
            queue: [Piece.I, Piece.O, Piece.T, Piece.L],
        });
    });

    test('parse lowercase hold with lowercase queue', () => {
        const result = parseQueueComment('t:iosl');
        expect(result).toEqual({
            hold: Piece.T,
            queue: [Piece.I, Piece.O, Piece.S, Piece.L],
        });
    });

    test('parse mixed case hold and queue', () => {
        const result = parseQueueComment('T:iosl');
        expect(result).toEqual({
            hold: Piece.T,
            queue: [Piece.I, Piece.O, Piece.S, Piece.L],
        });
    });

    test('return null for colon only', () => {
        expect(parseQueueComment(':')).toBeNull();
    });

    test('return null for hold with empty queue (colon at end)', () => {
        expect(parseQueueComment('T:')).toBeNull();
    });

    test('parse scored queue without hold', () => {
        const result = parseQueueComment('score=123.45 | IOTL');
        expect(result).toEqual({
            hold: null,
            queue: [Piece.I, Piece.O, Piece.T, Piece.L],
        });
    });

    test('parse scored queue with hold', () => {
        const result = parseQueueComment('score=-8.30 | T:IOL');
        expect(result).toEqual({
            hold: Piece.T,
            queue: [Piece.I, Piece.O, Piece.L],
        });
    });

    test('parse outside-top queue with hold', () => {
        const result = parseQueueComment('outsideTop=10000 | T:IOL');
        expect(result).toEqual({
            hold: Piece.T,
            queue: [Piece.I, Piece.O, Piece.L],
        });
    });

    test('return null for invalid score format', () => {
        expect(parseQueueComment('score=abc | IOTL')).toBeNull();
    });

    test('return null for score-only text', () => {
        expect(parseQueueComment('score=12.34')).toBeNull();
    });

    test('return null for invalid scored queue grammar', () => {
        expect(parseQueueComment('score=12.3 | IOTL')).toBeNull();
        expect(parseQueueComment('score=12.34|IOTL')).toBeNull();
        expect(parseQueueComment('Score=12.34 | IOTL')).toBeNull();
    });
});

describe('buildQueueComment', () => {
    test('build with hold and queue', () => {
        expect(buildQueueComment(Piece.T, [Piece.I, Piece.O, Piece.S])).toBe('T:IOS');
    });

    test('build without hold', () => {
        expect(buildQueueComment(null, [Piece.I, Piece.O, Piece.T])).toBe('IOT');
    });

    test('return empty string when queue is empty (with hold)', () => {
        expect(buildQueueComment(Piece.T, [])).toBe('');
    });

    test('return empty string when queue is empty (without hold)', () => {
        expect(buildQueueComment(null, [])).toBe('');
    });

    test('build single piece queue without hold', () => {
        expect(buildQueueComment(null, [Piece.Z])).toBe('Z');
    });

    test('build single piece queue with hold', () => {
        expect(buildQueueComment(Piece.I, [Piece.Z])).toBe('I:Z');
    });
});

describe('hold swap logic', () => {
    test('no hold used: consume front of queue', () => {
        // Input: T:IOSL, place I (no hold)
        const parsed = parseQueueComment('T:IOSL')!;
        // I is placed from queue front, hold stays T
        const newHold = parsed.hold; // T
        const newQueue = parsed.queue.slice(1); // [O, S, L]
        expect(buildQueueComment(newHold, newQueue)).toBe('T:OSL');
    });

    test('hold used: swap hold and queue front', () => {
        // Input: T:IOSL, place T (hold used), I goes to hold
        const parsed = parseQueueComment('T:IOSL')!;
        // Hold T is placed, queue front I moves to hold
        const newHold = parsed.queue[0]; // I
        const newQueue = parsed.queue.slice(1); // [O, S, L]
        expect(buildQueueComment(newHold, newQueue)).toBe('I:OSL');
    });

    test('no hold, hold used: first piece becomes hold, second is placed', () => {
        // Input: IOTLJSZ, hold empty, hold is used
        // I goes to hold, O is placed
        const parsed = parseQueueComment('IOTLJSZ')!;
        const newHold = parsed.queue[0]; // I
        const newQueue = parsed.queue.slice(2); // [T, L, J, S, Z]
        expect(buildQueueComment(newHold, newQueue)).toBe('I:TLJSZ');
    });
});
