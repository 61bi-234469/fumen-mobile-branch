import { Piece, isMinoPiece } from '../lib/enums';
import type { action } from '../actions';
import type { TreeOperationActions } from './tree_operations';
import { NextState, sequence } from './commons';
import { State } from '../states';
import { Page, Move } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';
import { PageFieldOperation, Pages } from '../lib/pages';
import { getBlockPositions } from '../lib/piece';
import { parseQueueComment, buildQueueComment } from '../lib/cold_clear/queueParser';
import { fieldToCC } from '../lib/cold_clear/fieldConverter';
import {
    CCInitMessage,
    CCMove,
    CCMoveResult,
    CC_TO_PIECE,
    CC_ROTATION_TO_APP,
    CC_HOLD_NONE,
    PIECE_TO_CC,
    WorkerResponse,
} from '../lib/cold_clear/types';
import { ColdClearWrapper } from '../lib/cold_clear/ColdClearWrapper';
import { i18n } from '../locales/keys';
import {
    createTreeFromPages,
    ensureVirtualRoot,
    findNode,
    findNodeByPageIndex,
    isVirtualNode,
} from '../lib/fumen/tree_utils';
import { TreeNodeId } from '../lib/fumen/tree_types';
import type { ScreenActions } from './screen';
import type { CommentActions } from './comment';
import type { FieldEditorActions } from './field_editor';

declare const M: any;

type RunType = 'single' | 'top3' | 'placed';

interface SessionBase {
    runId: number;
    runType: RunType;
    wrapper: ColdClearWrapper;
}

interface SingleRunSession extends SessionBase {
    runType: 'single';
    targetNodeId: TreeNodeId;
    resultPages: Page[];
    field: Field;
    hold: Piece | null;
    queue: Piece[];
    totalMoves: number;
    colorize: boolean;
    srs: boolean;
}

interface Top3RunSession extends SessionBase {
    runType: 'top3';
    targetNodeId: TreeNodeId;
    field: Field;
    hold: Piece | null;
    queue: Piece[];
    colorize: boolean;
    srs: boolean;
}

interface PlacedRunSession extends SessionBase {
    runType: 'placed';
    targetNodeId: TreeNodeId;
    targetPageIndex: number;
    placedPiece: Move;
    field: Field;
    thinkMs: number;
    requestedCandidateCount: number;
    retryCount: number;
    hold: Piece | null;
    queue: Piece[];
    searchHold: Piece | null;
    searchQueue: Piece[];
}

type RunSession = SingleRunSession | Top3RunSession | PlacedRunSession;

type ColdClearRuntimeActions = ColdClearActions
    & Pick<TreeOperationActions, 'addColdClearBranches'>
    & Pick<ScreenActions, 'changeToTreeViewScreen' | 'changeToDrawerScreen' | 'changeToMovePieceMode'>
    & Pick<CommentActions, 'setCommentText'>
    & Pick<FieldEditorActions, 'spawnPiece'>;

let currentSession: RunSession | null = null;

const THINK_MS = 1000;
const INIT_TIMEOUT_MS = 10000;
const TOP_BRANCH_COUNT = 5;
export const COLD_CLEAR_TOP_BRANCH_COUNT = TOP_BRANCH_COUNT;
const PLACED_SCORE_INITIAL_THINK_MS = THINK_MS;
const PLACED_SCORE_MAX_THINK_MS = THINK_MS * 8;
const PLACED_SCORE_INITIAL_CANDIDATE_COUNT = 5000;
const PLACED_SCORE_MAX_CANDIDATE_COUNT = 20000;
const PLACED_SCORE_MAX_RETRY = 1;
const MAX_PRINTABLE_SCORE = 1000000;
const OUTSIDE_TOP_CANDIDATES_COMMENT_PREFIX = 'outsideTop';
const ONE_BAG_PIECES: Piece[] = [Piece.I, Piece.O, Piece.T, Piece.J, Piece.L, Piece.S, Piece.Z];

// Action reference (set after Hyperapp mounts)
let appActions: ColdClearRuntimeActions | null = null;

export const initColdClearActions = (actions: ColdClearRuntimeActions) => {
    appActions = actions;
};

export interface ColdClearActions {
    startColdClearSearch: () => action;
    startColdClearTopThreeSearch: () => action;
    evaluatePlacedSpawnMinoScore: () => action;
    appendColdClearOneBagToComment: () => action;
    swapCurrentPieceWithHoldQueue: () => action;
    stopColdClearSearch: () => action;
    onColdClearMoveResult: (data: { runId: number, result: CCMoveResult }) => action;
    onColdClearTopMovesResult: (data: { runId: number, results: CCMove[] }) => action;
    onColdClearInitDone: (data: { runId: number }) => action;
    onColdClearError: (data: { runId: number, error: string }) => action;
    onColdClearNoMove: (data: { runId: number }) => action;
    coldClearFinishSearch: (runId: number) => action;
}

let nextRunId = 1;

function terminateSession(session: RunSession) {
    session.wrapper.terminate();
}

const getTreeForState = (state: Readonly<State>) => {
    if (state.tree.nodes.length > 0 && state.tree.rootId) {
        return ensureVirtualRoot({
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 2,
        });
    }
    return createTreeFromPages(state.fumen.pages);
};

const resolveTargetNode = (
    state: Readonly<State>,
    tree = getTreeForState(state),
): { nodeId: TreeNodeId; pageIndex: number } | null => {

    if (state.tree.activeNodeId) {
        const activeNode = findNode(tree, state.tree.activeNodeId);
        if (activeNode && !isVirtualNode(activeNode)) {
            return { nodeId: activeNode.id, pageIndex: activeNode.pageIndex };
        }
    }

    const fallbackNode = findNodeByPageIndex(tree, state.fumen.currentIndex);
    if (!fallbackNode || isVirtualNode(fallbackNode)) {
        return null;
    }

    return { nodeId: fallbackNode.id, pageIndex: fallbackNode.pageIndex };
};

const isPageSupported = (page?: Page): page is Page => {
    if (!page) {
        return false;
    }
    return page.flags.lock && !page.flags.mirror && !page.flags.rise && !page.flags.quiz;
};

const resolveCommentTextFromPage = (pages: Page[], pageIndex: number): string | null => {
    const visited = new Set<number>();
    let currentIndex: number | undefined = pageIndex;

    while (currentIndex !== undefined) {
        if (visited.has(currentIndex)) {
            return null;
        }
        visited.add(currentIndex);

        const page: Page | undefined = pages[currentIndex];
        if (!page) {
            return null;
        }

        if (page.comment.text !== undefined) {
            return page.comment.text;
        }

        currentIndex = page.comment.ref;
    }

    return '';
};

const parseQueueCommentFromPage = (pages: Page[], pageIndex: number) => {
    const commentText = resolveCommentTextFromPage(pages, pageIndex);
    if (commentText === null) {
        return null;
    }
    return parseQueueComment(commentText);
};

type SearchInputError =
    | 'targetNotFound'
    | 'unsupportedPageFlags'
    | 'invalidQueueComment';

type SearchInput = {
    tree: ReturnType<typeof getTreeForState>;
    page: Page;
    parsed: NonNullable<ReturnType<typeof parseQueueComment>>;
    target: { nodeId: TreeNodeId; pageIndex: number };
};

type SearchInputResult = {
    input?: SearchInput;
    error?: SearchInputError;
};

const resolveSingleSearchInput = (
    state: Readonly<State>,
): SearchInputResult => {
    const tree = getTreeForState(state);
    const target = resolveTargetNode(state, tree);
    if (!target) {
        return { error: 'targetNotFound' };
    }

    const page = state.fumen.pages[target.pageIndex];
    if (!isPageSupported(page)) {
        return { error: 'unsupportedPageFlags' };
    }

    const parsed = parseQueueCommentFromPage(state.fumen.pages, target.pageIndex);
    if (!parsed) {
        return { error: 'invalidQueueComment' };
    }

    return {
        input: {
            tree,
            target,
            page,
            parsed,
        },
    };
};

const resolveTopBranchSearchInput = (
    state: Readonly<State>,
) => resolveSingleSearchInput(state);

type PlacedSpawnInputError =
    | 'targetNotFound'
    | 'unsupportedPageFlags'
    | 'invalidQueueComment'
    | 'missingPlacedPiece'
    | 'invalidPlacedPiece'
    | 'invalidPlacement'
    | 'floatingPiece';

type PlacedSpawnInput = {
    tree: ReturnType<typeof getTreeForState>;
    page: Page;
    preLockField: Field;
    parsed: NonNullable<ReturnType<typeof parseQueueComment>>;
    placedPiece: Move;
    target: { nodeId: TreeNodeId; pageIndex: number };
};

type PlacedSpawnInputResult = {
    input?: PlacedSpawnInput;
    error?: PlacedSpawnInputError;
};

const resolvePlacedSpawnInput = (
    state: Readonly<State>,
): PlacedSpawnInputResult => {
    const tree = getTreeForState(state);
    const target = resolveTargetNode(state, tree);
    if (!target) {
        return { error: 'targetNotFound' };
    }

    const page = state.fumen.pages[target.pageIndex];
    if (!isPageSupported(page)) {
        return { error: 'unsupportedPageFlags' };
    }

    const parsed = parseQueueCommentFromPage(state.fumen.pages, target.pageIndex);
    if (!parsed) {
        return { error: 'invalidQueueComment' };
    }

    if (!page.piece) {
        return { error: 'missingPlacedPiece' };
    }
    if (!isMinoPiece(page.piece.type)) {
        return { error: 'invalidPlacedPiece' };
    }

    const pages = new Pages(state.fumen.pages);
    const preLockField = pages.getField(target.pageIndex, PageFieldOperation.Command);
    const placedPiece = page.piece;
    const x = placedPiece.coordinate.x;
    const y = placedPiece.coordinate.y;

    if (!preLockField.canPut(placedPiece.type, placedPiece.rotation, x, y)) {
        return { error: 'invalidPlacement' };
    }
    if (!preLockField.isOnGround(placedPiece.type, placedPiece.rotation, x, y)) {
        return { error: 'floatingPiece' };
    }
    return {
        input: {
            tree,
            page,
            preLockField,
            parsed,
            placedPiece,
            target,
        },
    };
};

const buildPlacedSpawnSearchState = (
    hold: Piece | null,
    queue: Piece[],
    placedPiece: Piece,
): { hold: Piece | null; queue: Piece[] } => {
    return {
        hold,
        queue: [placedPiece, ...queue],
    };
};

export const canStartColdClearSequenceSearch = (state: Readonly<State>): boolean => {
    return resolveSingleSearchInput(state).input !== undefined;
};

export const canStartColdClearTopBranchesSearch = (state: Readonly<State>): boolean => {
    return resolveTopBranchSearchInput(state).input !== undefined;
};

export const canEvaluatePlacedSpawnMinoScore = (state: Readonly<State>): boolean => {
    return resolvePlacedSpawnInput(state).input !== undefined;
};

export const canSwapCurrentPieceWithHoldQueue = (state: Readonly<State>): boolean => {
    const pageIndex = state.fumen.currentIndex;
    const parsed = parseQueueCommentFromPage(state.fumen.pages, pageIndex);
    return parsed !== null && parsed.queue.length > 0;
};

const toMove = (result: CCMove): Move | null => {
    const piece = CC_TO_PIECE[result.piece];
    const rotation = CC_ROTATION_TO_APP[result.rotation];

    if (piece === undefined || rotation === undefined) {
        return null;
    }

    return {
        rotation,
        type: piece,
        coordinate: {
            x: result.x,
            y: result.y,
        },
    };
};

const applyQueueAfterMove = (
    hold: Piece | null,
    queue: Piece[],
    usedHold: boolean,
): { hold: Piece | null; queue: Piece[] } | null => {
    if (usedHold) {
        if (hold === null) {
            if (queue.length < 2) {
                return null;
            }
            return {
                hold: queue[0],
                queue: queue.slice(2),
            };
        }

        if (queue.length < 1) {
            return null;
        }

        return {
            hold: queue[0],
            queue: queue.slice(1),
        };
    }

    if (queue.length < 1) {
        return null;
    }

    return {
        hold,
        queue: queue.slice(1),
    };
};

const isSameMove = (left: Move, right: Move): boolean => {
    return left.type === right.type
        && left.rotation === right.rotation
        && left.coordinate.x === right.coordinate.x
        && left.coordinate.y === right.coordinate.y;
};

const toOccupiedCellKey = (move: Move): string => {
    return getBlockPositions(move.type, move.rotation, move.coordinate.x, move.coordinate.y)
        .map(([x, y]) => `${x},${y}`)
        .sort()
        .join(';');
};

const findExactPlacedSpawnResult = (
    results: CCMove[],
    expectedMove: Move,
): CCMove | null => {
    const expectedCellKey = toOccupiedCellKey(expectedMove);
    let sameCellsResult: CCMove | null = null;

    for (const result of results) {
        const move = toMove(result);
        if (!move) {
            continue;
        }

        if (isSameMove(move, expectedMove)) {
            return result;
        }

        if (!sameCellsResult && toOccupiedCellKey(move) === expectedCellKey) {
            sameCellsResult = result;
        }
    }

    return sameCellsResult;
};

const showPlacedSpawnValidationError = (error: PlacedSpawnInputError) => {
    let message = i18n.ColdClear.CannotEvaluatePlacedSpawn();

    switch (error) {
    case 'unsupportedPageFlags':
        message = i18n.ColdClear.InvalidPageFlags();
        break;
    case 'invalidQueueComment':
        message = i18n.ColdClear.InvalidQueueComment();
        break;
    case 'missingPlacedPiece':
    case 'invalidPlacedPiece':
        message = i18n.ColdClear.PlacedPieceRequired();
        break;
    case 'floatingPiece':
        message = i18n.ColdClear.FloatingPieceUnsupported();
        break;
    default:
        break;
    }

    M.toast({ html: message, classes: 'top-toast', displayLength: 1500 });
};

const showSearchValidationError = (error: SearchInputError) => {
    let message = i18n.ColdClear.UsageHint();

    switch (error) {
    case 'unsupportedPageFlags':
        message = i18n.ColdClear.InvalidPageFlags();
        break;
    case 'invalidQueueComment':
        message = i18n.ColdClear.InvalidQueueComment();
        break;
    default:
        break;
    }

    M.toast({ html: message, classes: 'top-toast', displayLength: 1500 });
};

const showSwapValidationError = (type: 'missingQueue' | 'missingCurrentPiece') => {
    const message = type === 'missingCurrentPiece'
        ? i18n.ColdClear.HoldSwapCurrentPieceRequired()
        : i18n.ColdClear.HoldSwapMissingQueue();
    M.toast({ html: message, classes: 'top-toast', displayLength: 1500 });
};

const isScorePrintable = (score: number | undefined): score is number => {
    return typeof score === 'number'
        && Number.isFinite(score)
        && Math.abs(score) <= MAX_PRINTABLE_SCORE;
};

const formatScore = (score: number): string => {
    if (Object.is(score, -0)) {
        return '-0.00';
    }
    return score.toFixed(2);
};

const buildScoredQueueComment = (score: number | undefined, hold: Piece | null, queue: Piece[]): string => {
    const queueComment = buildQueueComment(hold, queue);
    if (!isScorePrintable(score)) {
        return queueComment;
    }

    const scoreComment = `score=${formatScore(score)}`;
    if (!queueComment) {
        return scoreComment;
    }

    return `${scoreComment} | ${queueComment}`;
};

const buildPlacedSpawnScoredQueueComment = (
    score: number | undefined,
    hold: Piece | null,
    queue: Piece[],
): string | null => {
    if (!isScorePrintable(score)) {
        return null;
    }

    const queueComment = buildQueueComment(hold, queue);
    const scoreComment = `score=${formatScore(score)}`;
    if (!queueComment) {
        return scoreComment;
    }
    return `${scoreComment} | ${queueComment}`;
};

const buildOutsideTopCandidatesQueueComment = (
    candidateCount: number,
    hold: Piece | null,
    queue: Piece[],
): string => {
    const queueComment = buildQueueComment(hold, queue);
    const normalizedCandidateCount = Math.max(0, Math.floor(candidateCount));
    const outsideTopComment = `${OUTSIDE_TOP_CANDIDATES_COMMENT_PREFIX}=${normalizedCandidateCount}`;
    if (!queueComment) {
        return outsideTopComment;
    }

    return `${outsideTopComment} | ${queueComment}`;
};

const shufflePieces = (pieces: Piece[]): Piece[] => {
    const shuffled = pieces.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = tmp;
    }
    return shuffled;
};

const buildCommentWithAppendedOneBag = (currentComment: string): string => {
    const parsed = parseQueueComment(currentComment);
    const oneBag = shufflePieces(ONE_BAG_PIECES);

    if (parsed) {
        return buildQueueComment(parsed.hold, parsed.queue.concat(oneBag));
    }

    return buildQueueComment(null, oneBag);
};

const emitFinish = (runId: number) => {
    if (appActions) {
        appActions.coldClearFinishSearch(runId);
    }
};

const moveToEditorPieceMenu = () => {
    if (appActions) {
        appActions.changeToDrawerScreen({});
        appActions.changeToMovePieceMode();
    }
};

function finishSingleSearch(runId: number) {
    const session = currentSession;
    if (!session || session.runId !== runId || session.runType !== 'single') {
        return;
    }

    currentSession = null;
    terminateSession(session);

    if (session.resultPages.length === 0) {
        M.toast({ html: i18n.ColdClear.NoMoveFound(), classes: 'top-toast', displayLength: 1500 });
    } else if (appActions) {
        appActions.addColdClearBranches({
            parentNodeId: session.targetNodeId,
            pages: session.resultPages,
            focusFirstAdded: true,
            addAsChildChain: true,
        });
        emitFinish(runId);
        appActions.changeToTreeViewScreen();
        return;
    }

    emitFinish(runId);
}

function finishTop3Search(runId: number) {
    const session = currentSession;
    if (!session || session.runId !== runId || session.runType !== 'top3') {
        return;
    }

    currentSession = null;
    terminateSession(session);
    emitFinish(runId);
}

function finishPlacedSpawnEvaluation(
    runId: number,
    showNoResultToast: boolean,
    moveToPieceMenu: boolean = true,
) {
    const session = currentSession;
    if (!session || session.runId !== runId || session.runType !== 'placed') {
        return;
    }

    currentSession = null;
    terminateSession(session);

    if (showNoResultToast) {
        M.toast({ html: i18n.ColdClear.CannotEvaluatePlacedSpawn(), classes: 'top-toast', displayLength: 1500 });
    }

    emitFinish(runId);
    if (moveToPieceMenu) {
        moveToEditorPieceMenu();
    }
}

const buildPlacedSpawnInitMessage = (session: PlacedRunSession): CCInitMessage => {
    const ccField = fieldToCC(session.field);
    const ccHold = session.searchHold !== null ? PIECE_TO_CC[session.searchHold] : CC_HOLD_NONE;
    const ccQueue = session.searchQueue.map(piece => PIECE_TO_CC[piece]);
    return {
        type: 'init',
        field: ccField,
        hold: ccHold,
        b2b: false,
        combo: 0,
        queue: ccQueue,
        thinkMs: session.thinkMs,
    };
};

function retryPlacedSpawnEvaluation(session: PlacedRunSession): boolean {
    if (session.retryCount >= PLACED_SCORE_MAX_RETRY) {
        return false;
    }

    const nextThinkMs = Math.min(PLACED_SCORE_MAX_THINK_MS, session.thinkMs * 2);
    const nextCandidateCount = Math.min(
        PLACED_SCORE_MAX_CANDIDATE_COUNT,
        session.requestedCandidateCount * 2,
    );
    if (nextThinkMs === session.thinkMs && nextCandidateCount === session.requestedCandidateCount) {
        return false;
    }

    terminateSession(session);
    session.wrapper = new ColdClearWrapper();
    session.thinkMs = nextThinkMs;
    session.requestedCandidateCount = nextCandidateCount;
    session.retryCount += 1;

    startWorkerSession(session, buildPlacedSpawnInitMessage(session), () => false);
    return true;
}

function handleWorkerMessage(runId: number, msg: WorkerResponse) {
    if (!appActions) { return; }

    switch (msg.type) {
    case 'initDone':
        appActions.onColdClearInitDone({ runId });
        break;
    case 'moveResult':
        appActions.onColdClearMoveResult({ runId, result: msg });
        break;
    case 'topMovesResult':
        appActions.onColdClearTopMovesResult({ runId, results: msg.moves });
        break;
    case 'noMove':
        appActions.onColdClearNoMove({ runId });
        break;
    case 'error':
        appActions.onColdClearError({ runId, error: msg.message });
        break;
    }
}

function startWorkerSession(
    session: RunSession,
    initMsg: CCInitMessage,
    hasResults: () => boolean,
) {
    const initTimeoutId = setTimeout(() => {
        const current = currentSession;
        if (!current || current.runId !== session.runId) {
            return;
        }
        if (hasResults()) {
            return;
        }

        M.toast({ html: i18n.ColdClear.InitTimeout(), classes: 'top-toast', displayLength: 1500 });
        terminateSession(current);
        currentSession = null;
        emitFinish(session.runId);
    }, INIT_TIMEOUT_MS);

    session.wrapper.start(initMsg, (msg: WorkerResponse) => {
        if (msg.type === 'initDone') {
            clearTimeout(initTimeoutId);
        }
        handleWorkerMessage(session.runId, msg);
    });
}

export const coldClearActions: Readonly<ColdClearActions> = {
    startColdClearSearch: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const resolved = resolveSingleSearchInput(state);
        if (!resolved.input) {
            showSearchValidationError(resolved.error ?? 'targetNotFound');
            return undefined;
        }
        const { page, parsed, target, tree } = resolved.input;
        const shouldEnableTree = !state.tree.enabled;

        if (currentSession) {
            terminateSession(currentSession);
            currentSession = null;
        }

        const runId = nextRunId;
        nextRunId += 1;

        const pages = new Pages(state.fumen.pages);
        const field = pages.getField(target.pageIndex, PageFieldOperation.All);
        const session: SingleRunSession = {
            runId,
            field,
            runType: 'single',
            wrapper: new ColdClearWrapper(),
            targetNodeId: target.nodeId,
            resultPages: [],
            hold: parsed.hold,
            queue: parsed.queue.slice(),
            totalMoves: parsed.queue.length,
            colorize: page.flags.colorize,
            srs: page.flags.srs,
        };
        currentSession = session;

        const ccField = fieldToCC(field);
        const ccHold = parsed.hold !== null ? PIECE_TO_CC[parsed.hold] : CC_HOLD_NONE;
        const ccQueue = parsed.queue.map(p => PIECE_TO_CC[p]);

        const initMsg: CCInitMessage = {
            type: 'init',
            field: ccField,
            hold: ccHold,
            b2b: false,
            combo: 0,
            queue: ccQueue,
            thinkMs: THINK_MS,
        };

        startWorkerSession(session, initMsg, () => session.resultPages.length > 0);

        return {
            tree: shouldEnableTree ? {
                ...state.tree,
                enabled: true,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: target.nodeId,
            } : state.tree,
            coldClear: {
                runId,
                runType: 'single',
                targetNodeId: target.nodeId,
                isRunning: true,
                abortRequested: false,
                progress: { current: 0, total: session.totalMoves },
            },
        };
    },

    startColdClearTopThreeSearch: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const resolved = resolveTopBranchSearchInput(state);
        if (!resolved.input) {
            showSearchValidationError(resolved.error ?? 'targetNotFound');
            return undefined;
        }
        const { page, parsed, tree, target } = resolved.input;
        const shouldEnableTree = !state.tree.enabled;

        if (currentSession) {
            terminateSession(currentSession);
            currentSession = null;
        }

        const runId = nextRunId;
        nextRunId += 1;

        const pages = new Pages(state.fumen.pages);
        const field = pages.getField(target.pageIndex, PageFieldOperation.All);

        const session: Top3RunSession = {
            runId,
            field,
            runType: 'top3',
            wrapper: new ColdClearWrapper(),
            targetNodeId: target.nodeId,
            hold: parsed.hold,
            queue: parsed.queue.slice(),
            colorize: page.flags.colorize,
            srs: page.flags.srs,
        };
        currentSession = session;

        const ccField = fieldToCC(field);
        const ccHold = parsed.hold !== null ? PIECE_TO_CC[parsed.hold] : CC_HOLD_NONE;
        const ccQueue = parsed.queue.map(p => PIECE_TO_CC[p]);

        const initMsg: CCInitMessage = {
            type: 'init',
            field: ccField,
            hold: ccHold,
            b2b: false,
            combo: 0,
            queue: ccQueue,
            thinkMs: THINK_MS,
        };

        startWorkerSession(session, initMsg, () => false);

        return {
            tree: shouldEnableTree ? {
                ...state.tree,
                enabled: true,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: target.nodeId,
            } : state.tree,
            coldClear: {
                runId,
                runType: 'top3',
                targetNodeId: target.nodeId,
                isRunning: true,
                abortRequested: false,
                progress: { current: 0, total: 1 },
            },
        };
    },

    evaluatePlacedSpawnMinoScore: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const resolved = resolvePlacedSpawnInput(state);
        if (!resolved.input) {
            showPlacedSpawnValidationError(resolved.error ?? 'targetNotFound');
            return undefined;
        }

        const {
            tree,
            target,
            parsed,
            preLockField,
            placedPiece,
        } = resolved.input;

        if (currentSession) {
            terminateSession(currentSession);
            currentSession = null;
        }

        const runId = nextRunId;
        nextRunId += 1;

        const searchState = buildPlacedSpawnSearchState(
            parsed.hold,
            parsed.queue,
            placedPiece.type,
        );

        const session: PlacedRunSession = {
            runId,
            placedPiece,
            runType: 'placed',
            wrapper: new ColdClearWrapper(),
            targetNodeId: target.nodeId,
            targetPageIndex: target.pageIndex,
            field: preLockField.copy(),
            thinkMs: PLACED_SCORE_INITIAL_THINK_MS,
            requestedCandidateCount: PLACED_SCORE_INITIAL_CANDIDATE_COUNT,
            retryCount: 0,
            hold: parsed.hold,
            queue: parsed.queue.slice(),
            searchHold: searchState.hold,
            searchQueue: searchState.queue,
        };
        currentSession = session;

        startWorkerSession(session, buildPlacedSpawnInitMessage(session), () => false);

        return {
            tree: state.tree.enabled
                ? {
                    ...state.tree,
                    activeNodeId: target.nodeId,
                }
                : {
                    ...state.tree,
                    enabled: true,
                    nodes: tree.nodes,
                    rootId: tree.rootId,
                    activeNodeId: target.nodeId,
                },
            coldClear: {
                runId,
                runType: 'placed',
                targetNodeId: target.nodeId,
                isRunning: true,
                abortRequested: false,
                progress: { current: 0, total: 1 },
            },
        };
    },

    appendColdClearOneBagToComment: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const pageIndex = state.fumen.currentIndex;
        const currentComment = resolveCommentTextFromPage(state.fumen.pages, pageIndex);
        if (currentComment === null) {
            return undefined;
        }

        const nextComment = buildCommentWithAppendedOneBag(currentComment);

        M.toast({
            html: i18n.ColdClear.OneBagAdded(),
            classes: 'top-toast',
            displayLength: 1200,
        });

        if (!appActions) {
            return undefined;
        }

        return sequence(state, [
            appActions.setCommentText({ pageIndex, text: nextComment }),
        ]);
    },

    swapCurrentPieceWithHoldQueue: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        if (!page || !page.piece || !isMinoPiece(page.piece.type)) {
            showSwapValidationError('missingCurrentPiece');
            return undefined;
        }

        const parsed = parseQueueCommentFromPage(state.fumen.pages, pageIndex);
        if (!parsed || parsed.queue.length === 0) {
            showSwapValidationError('missingQueue');
            return undefined;
        }

        const currentPiece = page.piece.type;
        const nextSpawnPiece = parsed.hold !== null ? parsed.hold : parsed.queue[0];
        const nextQueue = parsed.hold !== null ? parsed.queue.slice() : parsed.queue.slice(1);
        const nextComment = buildQueueComment(currentPiece, nextQueue);

        if (!appActions) {
            return undefined;
        }

        const srs = state.fumen.pages[0]?.flags.srs ?? true;
        return sequence(state, [
            appActions.setCommentText({ pageIndex, text: nextComment }),
            appActions.spawnPiece({ piece: nextSpawnPiece, srs }),
        ]);
    },

    stopColdClearSearch: () => (state): NextState => {
        if (!state.coldClear.isRunning) {
            return undefined;
        }

        const runId = state.coldClear.runId;
        const session = currentSession;
        if (session && session.runId === runId) {
            if (session.runType === 'single') {
                finishSingleSearch(runId);
            } else if (session.runType === 'top3') {
                finishTop3Search(runId);
            } else {
                finishPlacedSpawnEvaluation(runId, false, false);
            }
        }

        return {
            coldClear: {
                ...state.coldClear,
                runId,
                isRunning: false,
                abortRequested: true,
                progress: null,
            },
        };
    },

    onColdClearInitDone: ({ runId }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }
        if (!currentSession || currentSession.runId !== runId) {
            return undefined;
        }

        if (currentSession.runType === 'single') {
            currentSession.wrapper.requestMove();
        } else if (currentSession.runType === 'top3') {
            currentSession.wrapper.requestTopMoves(TOP_BRANCH_COUNT);
        } else {
            currentSession.wrapper.requestTopMoves(currentSession.requestedCandidateCount);
        }
        return undefined;
    },

    onColdClearMoveResult: ({ runId, result }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }
        if (!currentSession || currentSession.runId !== runId || currentSession.runType !== 'single') {
            return undefined;
        }

        const session = currentSession;

        if (state.coldClear.abortRequested) {
            finishSingleSearch(runId);
            return undefined;
        }

        const move = toMove(result);
        if (!move) {
            finishSingleSearch(runId);
            return undefined;
        }

        const queueState = applyQueueAfterMove(session.hold, session.queue, result.hold);
        if (!queueState) {
            finishSingleSearch(runId);
            return undefined;
        }

        session.hold = queueState.hold;
        session.queue = queueState.queue;

        const nextComment = buildScoredQueueComment(result.score, session.hold, session.queue);

        const resultPage: Page = {
            index: session.resultPages.length,
            field: { obj: session.field.copy() },
            piece: move,
            comment: { text: nextComment },
            flags: {
                lock: true,
                colorize: session.colorize,
                srs: session.srs,
                mirror: false,
                rise: false,
                quiz: false,
            },
        };

        session.resultPages.push(resultPage);

        session.field.put(move);
        session.field.clearLine();

        if (session.queue.length === 0) {
            finishSingleSearch(runId);
            return undefined;
        }

        session.wrapper.requestMove();

        return {
            coldClear: {
                ...state.coldClear,
                progress: { current: session.resultPages.length, total: session.totalMoves },
            },
        };
    },

    onColdClearTopMovesResult: ({ runId, results }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }

        if (!currentSession || currentSession.runId !== runId) {
            return undefined;
        }

        if (currentSession.runType === 'placed') {
            const session = currentSession;

            if (state.coldClear.abortRequested) {
                finishPlacedSpawnEvaluation(runId, false, false);
                return undefined;
            }

            const exactResult = findExactPlacedSpawnResult(
                results,
                session.placedPiece,
            );
            if (!exactResult) {
                if (retryPlacedSpawnEvaluation(session)) {
                    return undefined;
                }

                const outsideTopComment = buildOutsideTopCandidatesQueueComment(
                    session.requestedCandidateCount,
                    session.hold,
                    session.queue,
                );

                terminateSession(session);
                currentSession = null;

                if (!appActions) {
                    emitFinish(runId);
                    return undefined;
                }

                return sequence(state, [
                    appActions.setCommentText({ pageIndex: session.targetPageIndex, text: outsideTopComment }),
                    appActions.coldClearFinishSearch(runId),
                    appActions.changeToDrawerScreen({}),
                    appActions.changeToMovePieceMode(),
                ]);
            }

            const nextComment = buildPlacedSpawnScoredQueueComment(
                exactResult.score,
                session.hold,
                session.queue,
            );
            if (nextComment === null) {
                finishPlacedSpawnEvaluation(runId, true);
                return undefined;
            }

            terminateSession(session);
            currentSession = null;

            if (!appActions) {
                emitFinish(runId);
                return undefined;
            }

            return sequence(state, [
                appActions.setCommentText({ pageIndex: session.targetPageIndex, text: nextComment }),
                appActions.coldClearFinishSearch(runId),
                appActions.changeToDrawerScreen({}),
                appActions.changeToMovePieceMode(),
            ]);
        }

        if (currentSession.runType !== 'top3') {
            return undefined;
        }

        const session = currentSession;

        if (state.coldClear.abortRequested) {
            finishTop3Search(runId);
            return undefined;
        }

        const tree = getTreeForState(state);
        const targetNode = findNode(tree, session.targetNodeId);
        if (!targetNode || isVirtualNode(targetNode)) {
            finishTop3Search(runId);
            return undefined;
        }

        const parentPage = state.fumen.pages[targetNode.pageIndex];
        if (!parentPage) {
            finishTop3Search(runId);
            return undefined;
        }

        const candidatePages: Page[] = [];

        results.slice(0, TOP_BRANCH_COUNT).forEach((result) => {
            const move = toMove(result);
            if (!move) {
                return;
            }

            const queueState = applyQueueAfterMove(session.hold, session.queue, result.hold);
            if (!queueState) {
                return;
            }

            const displayField = session.field.copy();
            const nextField = displayField.copy();
            try {
                nextField.put(move);
                nextField.clearLine();
            } catch (e) {
                return;
            }

            candidatePages.push({
                index: 0,
                field: { obj: displayField },
                piece: move,
                comment: {
                    text: buildScoredQueueComment(result.score, queueState.hold, queueState.queue),
                },
                flags: {
                    ...parentPage.flags,
                    quiz: false,
                },
            });
        });

        if (candidatePages.length === 0) {
            finishTop3Search(runId);
            M.toast({ html: i18n.ColdClear.NoMoveFound(), classes: 'top-toast', displayLength: 1500 });
            return undefined;
        }

        terminateSession(session);
        currentSession = null;

        M.toast({
            html: i18n.ColdClear.TopBranchesAdded(candidatePages.length),
            classes: 'top-toast',
            displayLength: 1500,
        });

        if (!appActions) {
            return undefined;
        }

        return sequence(state, [
            appActions.addColdClearBranches({
                parentNodeId: session.targetNodeId,
                pages: candidatePages,
                focusFirstAdded: true,
            }),
            appActions.coldClearFinishSearch(runId),
            appActions.changeToTreeViewScreen(),
        ]);
    },

    onColdClearNoMove: ({ runId }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }

        if (currentSession && currentSession.runId === runId && currentSession.runType === 'placed') {
            finishPlacedSpawnEvaluation(runId, true);
            return undefined;
        }

        if (currentSession && currentSession.runId === runId && currentSession.runType === 'top3') {
            finishTop3Search(runId);
            M.toast({ html: i18n.ColdClear.NoMoveFound(), classes: 'top-toast', displayLength: 1500 });
            return undefined;
        }

        finishSingleSearch(runId);
        return undefined;
    },

    onColdClearError: ({ runId, error }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }

        // tslint:disable-next-line:no-console
        console.error('Cold Clear error:', error);

        if (currentSession && currentSession.runId === runId) {
            terminateSession(currentSession);
            currentSession = null;
        }

        M.toast({ html: i18n.ColdClear.WorkerError(), classes: 'top-toast', displayLength: 1500 });

        emitFinish(runId);

        return undefined;
    },

    coldClearFinishSearch: (runId: number) => (state): NextState => {
        if (state.coldClear.runId !== runId) {
            return undefined;
        }
        return {
            modal: {
                ...state.modal,
                coldClearMenu: false,
            },
            coldClear: {
                isRunning: false,
                abortRequested: false,
                runId: state.coldClear.runId,
                runType: 'single',
                targetNodeId: null,
                progress: null,
            },
        };
    },
};

// Test-only helper: reset module-level state between tests
export function resetForTesting() {
    if (currentSession) {
        currentSession.wrapper.terminate();
    }
    currentSession = null;
    nextRunId = 1;
    appActions = null;
}
