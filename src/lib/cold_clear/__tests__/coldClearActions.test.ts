import { coldClearActions, initColdClearActions, resetForTesting } from '../../../actions/cold_clear';
import { Piece } from '../../enums';
import { Field } from '../../fumen/field';
import { encode } from '../../fumen/fumen';
import { ColdClearWrapper } from '../ColdClearWrapper';

// Mock ColdClearWrapper to avoid actual Worker creation
jest.mock('../ColdClearWrapper', () => ({
    ColdClearWrapper: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        requestMove: jest.fn(),
        requestTopMoves: jest.fn(),
        terminate: jest.fn(),
    })),
}));

// Mock fumen encode
jest.mock('../../fumen/fumen', () => ({
    encode: jest.fn().mockResolvedValue('mockEncoded'),
}));

// Provide Materialize toast mock
(global as any).M = { toast: jest.fn() };

// Provide window.open mock
const mockWindow = { location: { href: '' }, close: jest.fn() };
(global as any).window = {
    ...global.window,
    open: jest.fn().mockReturnValue(mockWindow),
    location: { origin: 'http://localhost', pathname: '/' },
};

// Provide navigator.clipboard mock
(global as any).navigator = {
    ...global.navigator,
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
};

// Mock i18n
jest.mock('../../../locales/keys', () => ({
    i18n: {
        ColdClear: {
            ButtonLabel: () => 'CC',
            StopLabel: () => 'STOP',
            Progress: (c: number, t: number) => `${c}/${t}`,
            NoMoveFound: () => 'No move found',
            WorkerError: () => 'Worker error',
            InitTimeout: () => 'Init timeout',
            PopupBlocked: () => 'Popup blocked',
            TreeModeRequired: () => 'Enable tree mode',
            TopBranchesAdded: (count: number) => `${count} branches added`,
        },
    },
}));

// Extract coldClear from NextState result safely
function getColdClear(result: any) {
    return result && result.coldClear;
}

// Helper: create a minimal mock State for cold clear actions
function makeColdClearState(overrides: {
    isRunning?: boolean;
    abortRequested?: boolean;
    runId?: number;
    runType?: 'single' | 'top3';
    targetNodeId?: string | null;
    progress?: { current: number; total: number } | null;
    commentText?: string;
    flags?: { lock: boolean; mirror: boolean; rise: boolean; quiz: boolean; colorize: boolean; srs: boolean };
    treeEnabled?: boolean;
    activeNodeId?: string | null;
} = {}) {
    const flags = overrides.flags || { lock: true, mirror: false, rise: false, quiz: false, colorize: true, srs: true };
    const initialField = new Field({});
    const treeEnabled = overrides.treeEnabled || false;
    const treeNodes = treeEnabled ? [
        { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['n0'] },
        { id: 'n0', parentId: 'root', pageIndex: 0, childrenIds: [] },
    ] : [];
    return {
        coldClear: {
            isRunning: overrides.isRunning || false,
            abortRequested: overrides.abortRequested || false,
            runId: overrides.runId || 0,
            runType: overrides.runType || 'single',
            targetNodeId: overrides.targetNodeId !== undefined ? overrides.targetNodeId : null,
            progress: overrides.progress || null,
        },
        fumen: {
            currentIndex: 0,
            pages: [{
                flags,
                field: { obj: initialField.copy() },
                piece: undefined,
                comment: { text: overrides.commentText || 'IOTLJSZ' },
                index: 0,
            }],
            maxPage: 1,
            guideLineColor: true,
        },
        comment: { text: overrides.commentText || 'IOTLJSZ', changeKey: 0 },
        cache: {
            currentInitField: new Field({}),
        },
        tree: {
            enabled: treeEnabled,
            nodes: treeNodes,
            rootId: treeEnabled ? 'root' : null,
            activeNodeId: treeEnabled ? (overrides.activeNodeId || 'n0') : null,
        },
    } as any;
}

describe('coldClearActions run isolation', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        resetForTesting();
        jest.clearAllMocks();
        mockWindow.location.href = '';
        mockWindow.close.mockClear();
    });

    afterEach(() => {
        resetForTesting();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('startColdClearSearch returns new runId', () => {
        const state = makeColdClearState();
        const result = coldClearActions.startColdClearSearch()(state);
        const cc = getColdClear(result);
        expect(cc).toBeDefined();
        expect(cc.runId).toBe(1);
        expect(cc.isRunning).toBe(true);
    });

    test('startColdClearSearch does not pre-open tab', () => {
        const state = makeColdClearState({ commentText: 'I' });
        coldClearActions.startColdClearSearch()(state);

        expect((global as any).window.open).not.toHaveBeenCalled();
    });

    test('startColdClearSearch uses command-applied field', () => {
        const state = makeColdClearState({ commentText: 'I' });
        state.fumen.pages[0].commands = {
            pre: {
                'block-0': { type: 'block', x: 0, y: 0, piece: Piece.I },
            },
        };

        const result = coldClearActions.startColdClearSearch()(state);
        expect(getColdClear(result).isRunning).toBe(true);

        const wrapperCtor = ColdClearWrapper as any as jest.Mock;
        const wrapperInstance = wrapperCtor.mock.results[0].value;
        const initMsg = wrapperInstance.start.mock.calls[0][0];

        expect(initMsg.field[0]).toBe(1);
    });

    test('startColdClearSearch increments runId on each call', () => {
        const state1 = makeColdClearState();
        const result1 = coldClearActions.startColdClearSearch()(state1);
        expect(getColdClear(result1).runId).toBe(1);

        // Stop the first run so we can start again
        const runningState = makeColdClearState({ isRunning: true, runId: 1 });
        coldClearActions.stopColdClearSearch()(runningState);

        const state2 = makeColdClearState();
        const result2 = coldClearActions.startColdClearSearch()(state2);
        expect(getColdClear(result2).runId).toBe(2);
    });

    test('startColdClearSearch returns undefined if already running', () => {
        const state = makeColdClearState({ isRunning: true, runId: 1 });
        const result = coldClearActions.startColdClearSearch()(state);
        expect(result).toBeUndefined();
    });

    test('startColdClearSearch returns undefined for invalid flags', () => {
        const state = makeColdClearState({
            flags: { lock: false, mirror: false, rise: false, quiz: false, colorize: true, srs: true },
        });
        const result = coldClearActions.startColdClearSearch()(state);
        expect(result).toBeUndefined();
    });

    test('startColdClearSearch returns undefined for invalid comment', () => {
        const state = makeColdClearState({ commentText: 'hello' });
        const result = coldClearActions.startColdClearSearch()(state);
        expect(result).toBeUndefined();
    });

    test('stopColdClearSearch sets isRunning=false and abortRequested=true', () => {
        const state = makeColdClearState({ isRunning: true, runId: 5 });
        const result = coldClearActions.stopColdClearSearch()(state);
        const cc = getColdClear(result);
        expect(cc).toBeDefined();
        expect(cc.isRunning).toBe(false);
        expect(cc.abortRequested).toBe(true);
        expect(cc.runId).toBe(5);
    });

    test('stopColdClearSearch returns undefined if not running', () => {
        const state = makeColdClearState({ isRunning: false });
        const result = coldClearActions.stopColdClearSearch()(state);
        expect(result).toBeUndefined();
    });

    test('onColdClearInitDone ignores stale runId', () => {
        // Start a search to create session with runId=1
        const state = makeColdClearState();
        coldClearActions.startColdClearSearch()(state);

        // Init done with stale runId (99) should be ignored
        const runningState = makeColdClearState({ isRunning: true, runId: 1 });
        const result = coldClearActions.onColdClearInitDone({ runId: 99 })(runningState);
        expect(result).toBeUndefined();
    });

    test('onColdClearMoveResult ignores stale runId', () => {
        const runningState = makeColdClearState({ isRunning: true, runId: 5 });
        const result = coldClearActions.onColdClearMoveResult({
            runId: 3, // stale
            result: { type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 4, y: 0 },
        })(runningState);
        expect(result).toBeUndefined();
    });

    test('onColdClearError ignores stale runId', () => {
        const runningState = makeColdClearState({ isRunning: true, runId: 5 });
        const result = coldClearActions.onColdClearError({
            runId: 3,
            error: 'test error',
        })(runningState);
        expect(result).toBeUndefined();
    });

    test('onColdClearNoMove ignores stale runId', () => {
        const runningState = makeColdClearState({ isRunning: true, runId: 5 });
        const result = coldClearActions.onColdClearNoMove({ runId: 3 })(runningState);
        expect(result).toBeUndefined();
    });

    test('coldClearFinishSearch resets state', () => {
        const state = makeColdClearState({ isRunning: true, runId: 7 });
        const result = coldClearActions.coldClearFinishSearch(7)(state);
        const cc = getColdClear(result);
        expect(cc).toBeDefined();
        expect(cc.isRunning).toBe(false);
        expect(cc.abortRequested).toBe(false);
        expect(cc.runId).toBe(7);
        expect(cc.progress).toBeNull();
    });

    test('coldClearFinishSearch ignores stale runId', () => {
        const state = makeColdClearState({ isRunning: true, runId: 10 });
        const result = coldClearActions.coldClearFinishSearch(8)(state);
        expect(result).toBeUndefined();
    });

    test('onColdClearMoveResult with matching runId updates progress', () => {
        // Start search to set up session
        const state = makeColdClearState();
        const startResult = coldClearActions.startColdClearSearch()(state);
        const runId = getColdClear(startResult).runId;

        // Mock appActions to prevent finishSearch from being called
        const mockActions: any = {
            coldClearFinishSearch: jest.fn(),
            onColdClearInitDone: jest.fn(),
            onColdClearMoveResult: jest.fn(),
            onColdClearNoMove: jest.fn(),
            onColdClearError: jest.fn(),
        };
        initColdClearActions(mockActions);

        const runningState = makeColdClearState({ runId, isRunning: true });
        const result = coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 4, y: 0 },
        })(runningState);

        const cc = getColdClear(result);
        expect(cc).toBeDefined();
        expect(cc.progress).toBeDefined();
        expect(cc.progress.current).toBe(1);
    });

    test('onColdClearMoveResult triggers finishSearch when abortRequested', () => {
        // Start search
        const state = makeColdClearState();
        const startResult = coldClearActions.startColdClearSearch()(state);
        const runId = getColdClear(startResult).runId;

        const mockActions: any = {
            coldClearFinishSearch: jest.fn(),
            onColdClearInitDone: jest.fn(),
            onColdClearMoveResult: jest.fn(),
            onColdClearNoMove: jest.fn(),
            onColdClearError: jest.fn(),
        };
        initColdClearActions(mockActions);

        // State with abortRequested
        const abortState = makeColdClearState({ runId, isRunning: true, abortRequested: true });
        const result = coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 4, y: 0 },
        })(abortState);

        // Should return undefined (finishSearch handles the rest asynchronously)
        expect(result).toBeUndefined();
    });

    test('start, stop, start sequence produces different runIds', () => {
        // First run
        const state1 = makeColdClearState();
        const r1 = getColdClear(coldClearActions.startColdClearSearch()(state1));
        expect(r1.runId).toBe(1);

        // Stop
        coldClearActions.stopColdClearSearch()(makeColdClearState({ isRunning: true, runId: 1 }));

        // Second run
        const state2 = makeColdClearState();
        const r2 = getColdClear(coldClearActions.startColdClearSearch()(state2));
        expect(r2.runId).toBe(2);

        // Stop
        coldClearActions.stopColdClearSearch()(makeColdClearState({ isRunning: true, runId: 2 }));

        // Third run
        const state3 = makeColdClearState();
        const r3 = getColdClear(coldClearActions.startColdClearSearch()(state3));
        expect(r3.runId).toBe(3);
    });

    test('progress reports correct total from queue length', () => {
        const state = makeColdClearState({ commentText: 'T:IO' }); // hold=T, queue=[I,O] → total=2
        const result = coldClearActions.startColdClearSearch()(state);
        const cc = getColdClear(result);
        expect(cc.progress).toEqual({ current: 0, total: 2 });
    });

    test('startColdClearTopThreeSearch auto-enables tree mode when disabled', () => {
        const state = makeColdClearState({ treeEnabled: false, commentText: 'IOTL' });
        const result = coldClearActions.startColdClearTopThreeSearch()(state);
        expect(result).toBeDefined();
        const nextState = result as any;
        expect(nextState.tree.enabled).toBe(true);
        expect(nextState.tree.nodes.length).toBeGreaterThan(0);
    });

    test('startColdClearTopThreeSearch sets runType and target node', () => {
        const state = makeColdClearState({ treeEnabled: true, commentText: 'IOTL' });
        const result = coldClearActions.startColdClearTopThreeSearch()(state);
        const cc = getColdClear(result);
        expect(cc).toBeDefined();
        expect(cc.runType).toBe('top3');
        expect(cc.targetNodeId).toBe('n0');
        expect(cc.isRunning).toBe(true);
    });

    test('top3 initDone requests top 5 moves', () => {
        const state = makeColdClearState({ treeEnabled: true, commentText: 'IOTL' });
        const startResult = coldClearActions.startColdClearTopThreeSearch()(state);
        const runId = getColdClear(startResult).runId;

        const runningState = makeColdClearState({
            runId,
            treeEnabled: true,
            isRunning: true,
            runType: 'top3',
            targetNodeId: 'n0',
        });
        coldClearActions.onColdClearInitDone({ runId })(runningState);

        const wrapperCtor = ColdClearWrapper as any as jest.Mock;
        const wrapperInstance = wrapperCtor.mock.results[0].value;
        expect(wrapperInstance.requestTopMoves).toHaveBeenCalledWith(5);
    });

    test('top3 completion transitions to tree view after finish', () => {
        const state = makeColdClearState({ treeEnabled: true, commentText: 'IOTL' });
        const startResult = coldClearActions.startColdClearTopThreeSearch()(state);
        const runId = getColdClear(startResult).runId;

        const mockActions: any = {
            addColdClearBranches: jest.fn().mockReturnValue(() => ({ tree: { enabled: true } })),
            coldClearFinishSearch: jest.fn().mockReturnValue(() => ({ coldClear: { isRunning: false } })),
            changeToTreeViewScreen: jest.fn().mockReturnValue(() => ({ mode: { screen: 2 } })),
        };
        initColdClearActions(mockActions);

        const runningState = makeColdClearState({
            runId,
            treeEnabled: true,
            isRunning: true,
            runType: 'top3',
            targetNodeId: 'n0',
            commentText: 'IOTL',
        });

        const result = coldClearActions.onColdClearTopMovesResult({
            runId,
            results: [{ hold: false, piece: 0, rotation: 0, x: 4, y: 0 }],
        })(runningState);

        expect(result).toBeDefined();
        expect(mockActions.addColdClearBranches).toHaveBeenCalledTimes(1);
        expect(mockActions.coldClearFinishSearch).toHaveBeenCalledWith(runId);
        expect(mockActions.changeToTreeViewScreen).toHaveBeenCalledTimes(1);

        const addOrder = mockActions.addColdClearBranches.mock.invocationCallOrder[0];
        const finishOrder = mockActions.coldClearFinishSearch.mock.invocationCallOrder[0];
        const treeOrder = mockActions.changeToTreeViewScreen.mock.invocationCallOrder[0];
        expect(addOrder).toBeLessThan(finishOrder);
        expect(finishOrder).toBeLessThan(treeOrder);
    });

    test('onColdClearMoveResult generates scored comments for single run', async () => {
        const state = makeColdClearState({ commentText: 'IO' });
        const startResult = coldClearActions.startColdClearSearch()(state);
        const runId = getColdClear(startResult).runId;
        const runningState = makeColdClearState({ runId, isRunning: true, commentText: 'IO' });

        coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 4, y: 0, score: 123.45 },
        })(runningState);

        coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 1, rotation: 0, x: 4, y: 0, score: 50 },
        })(runningState);

        await Promise.resolve();

        const encodeMock = encode as jest.Mock;
        expect(encodeMock).toHaveBeenCalled();
        const pages = encodeMock.mock.calls[0][0];
        expect(pages[0].comment.text).toBe('score=123.45 | O');
        expect(pages[1].comment.text).toBe('score=50.00');
    });

    test('onColdClearMoveResult falls back to queue-only when score is missing', async () => {
        const state = makeColdClearState({ commentText: 'IO' });
        const startResult = coldClearActions.startColdClearSearch()(state);
        const runId = getColdClear(startResult).runId;
        const runningState = makeColdClearState({ runId, isRunning: true, commentText: 'IO' });

        coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 4, y: 0 },
        })(runningState);

        coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 1, rotation: 0, x: 4, y: 0 },
        })(runningState);

        await Promise.resolve();

        const encodeMock = encode as jest.Mock;
        const pages = encodeMock.mock.calls[0][0];
        expect(pages[0].comment.text).toBe('O');
        expect(pages[1].comment.text).toBe('');
    });

    test('onColdClearMoveResult falls back to queue-only for non-finite or out-of-range score', async () => {
        const state = makeColdClearState({ commentText: 'IO' });
        const startResult = coldClearActions.startColdClearSearch()(state);
        const runId = getColdClear(startResult).runId;
        const runningState = makeColdClearState({ runId, isRunning: true, commentText: 'IO' });

        coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 0, rotation: 0, x: 4, y: 0, score: Number.NaN },
        })(runningState);

        coldClearActions.onColdClearMoveResult({
            runId,
            result: { type: 'moveResult', hold: false, piece: 1, rotation: 0, x: 4, y: 0, score: 1000000.01 },
        })(runningState);

        await Promise.resolve();

        const encodeMock = encode as jest.Mock;
        const pages = encodeMock.mock.calls[0][0];
        expect(pages[0].comment.text).toBe('O');
        expect(pages[1].comment.text).toBe('');
    });

    test('startColdClearSearch rejects score-only comment', () => {
        const state = makeColdClearState({ commentText: 'score=12.34' });
        const result = coldClearActions.startColdClearSearch()(state);
        expect(result).toBeUndefined();
    });

    test('startColdClearTopThreeSearch rejects score-only comment', () => {
        const state = makeColdClearState({ treeEnabled: true, commentText: 'score=12.34' });
        const result = coldClearActions.startColdClearTopThreeSearch()(state);
        expect(result).toBeUndefined();
    });

    test('onColdClearTopMovesResult generates scored branch comments', () => {
        const state = makeColdClearState({ treeEnabled: true, commentText: 'IOTL' });
        const startResult = coldClearActions.startColdClearTopThreeSearch()(state);
        const runId = getColdClear(startResult).runId;

        const mockActions: any = {
            addColdClearBranches: jest.fn().mockReturnValue(() => ({ tree: { enabled: true } })),
            coldClearFinishSearch: jest.fn().mockReturnValue(() => ({ coldClear: { isRunning: false } })),
            changeToTreeViewScreen: jest.fn().mockReturnValue(() => ({ mode: { screen: 2 } })),
        };
        initColdClearActions(mockActions);

        const runningState = makeColdClearState({
            runId,
            treeEnabled: true,
            isRunning: true,
            runType: 'top3',
            targetNodeId: 'n0',
            commentText: 'IOTL',
        });

        coldClearActions.onColdClearTopMovesResult({
            runId,
            results: [{ hold: false, piece: 0, rotation: 0, x: 4, y: 0, score: 1.2 }],
        })(runningState);

        const pages = mockActions.addColdClearBranches.mock.calls[0][0].pages;
        expect(pages[0].comment.text).toBe('score=1.20 | OTL');
    });

    test('onColdClearTopMovesResult falls back to queue-only when score is invalid', () => {
        const state = makeColdClearState({ treeEnabled: true, commentText: 'IOTL' });
        const startResult = coldClearActions.startColdClearTopThreeSearch()(state);
        const runId = getColdClear(startResult).runId;

        const mockActions: any = {
            addColdClearBranches: jest.fn().mockReturnValue(() => ({ tree: { enabled: true } })),
            coldClearFinishSearch: jest.fn().mockReturnValue(() => ({ coldClear: { isRunning: false } })),
            changeToTreeViewScreen: jest.fn().mockReturnValue(() => ({ mode: { screen: 2 } })),
        };
        initColdClearActions(mockActions);

        const runningState = makeColdClearState({
            runId,
            treeEnabled: true,
            isRunning: true,
            runType: 'top3',
            targetNodeId: 'n0',
            commentText: 'IOTL',
        });

        coldClearActions.onColdClearTopMovesResult({
            runId,
            results: [{ hold: false, piece: 0, rotation: 0, x: 4, y: 0, score: Number.POSITIVE_INFINITY }],
        })(runningState);

        const pages = mockActions.addColdClearBranches.mock.calls[0][0].pages;
        expect(pages[0].comment.text).toBe('OTL');
    });
});
