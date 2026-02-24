import { Piece, isMinoPiece } from '../lib/enums';
import type { action } from '../actions';
import type { TreeOperationActions } from './tree_operations';
import { NextState, sequence } from './commons';
import { State } from '../states';
import { Page, Move } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';
import { PageFieldOperation, Pages } from '../lib/pages';
import { getBlockPositions } from '../lib/piece';
import {
    parseQueueComment,
    parseQueueStateComment,
    buildQueueComment,
    buildQueueStateComment,
} from '../lib/cold_clear/queueParser';
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
import { localStorageWrapper } from '../memento';

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
    b2b: boolean;
    combo: number;
    totalMoves: number;
    holdAllowed: boolean;
    speculate: boolean;
    nextLimit: number | null;
    colorize: boolean;
    srs: boolean;
}

interface Top3RunSession extends SessionBase {
    runType: 'top3';
    targetNodeId: TreeNodeId;
    field: Field;
    hold: Piece | null;
    queue: Piece[];
    b2b: boolean;
    combo: number;
    topBranchCount: number;
    holdAllowed: boolean;
    speculate: boolean;
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
    b2b: boolean;
    combo: number;
    searchHold: Piece | null;
    searchQueue: Piece[];
    holdAllowed: boolean;
    speculate: boolean;
    nextLimit: number | null;
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
export const COLD_CLEAR_TOP_BRANCH_COUNT_DEFAULT = 5;
export const COLD_CLEAR_TOP_BRANCH_COUNT_MIN = 1;
export const COLD_CLEAR_TOP_BRANCH_COUNT_MAX = 20;
export const COLD_CLEAR_NEXT_LIMIT_MIN = 1;
export const COLD_CLEAR_NEXT_LIMIT_MAX = 30;
export const COLD_CLEAR_NEXT_LIMIT_DEFAULT = 5;
const PLACED_SCORE_INITIAL_THINK_MS = THINK_MS;
const PLACED_SCORE_MAX_THINK_MS = THINK_MS * 8;
const PLACED_SCORE_INITIAL_CANDIDATE_COUNT = 5000;
const PLACED_SCORE_MAX_CANDIDATE_COUNT = 20000;
const PLACED_SCORE_MAX_RETRY = 1;
const MAX_PRINTABLE_SCORE = 1000000;
const OUTSIDE_TOP_CANDIDATES_COMMENT_PREFIX = 'outsideTop';
const SCORE_SEGMENT_REGEX = /^score=(-?(?:0|[1-9]\d*)\.\d{2})$/;
const ONE_BAG_PIECES: Piece[] = [Piece.I, Piece.O, Piece.T, Piece.J, Piece.L, Piece.S, Piece.Z];

// Action reference (set after Hyperapp mounts)
let appActions: ColdClearRuntimeActions | null = null;

export const initColdClearActions = (actions: ColdClearRuntimeActions) => {
    appActions = actions;
};

export interface ColdClearActions {
    startColdClearSearch: () => action;
    startColdClearTopThreeSearch: () => action;
    setColdClearTopBranchCount: (data: { count: number }) => action;
    setColdClearHoldAllowed: (data: { holdAllowed: boolean }) => action;
    setColdClearSpeculate: (data: { speculate: boolean }) => action;
    setColdClearNextLimit: (data: { nextLimit: number | null }) => action;
    evaluatePlacedSpawnMinoScore: () => action;
    appendColdClearOneBagToComment: () => action;
    swapCurrentPieceWithHoldQueue: () => action;
    previewColdClearQueueComment: (data: {
        hold: Piece | null;
        queue: Piece[];
        b2b: boolean;
        combo: number;
    }) => action;
    commitColdClearQueueComment: () => action;
    stopColdClearSearch: () => action;
    onColdClearMoveResult: (data: { runId: number, result: CCMoveResult }) => action;
    onColdClearTopMovesResult: (data: { runId: number, results: CCMove[] }) => action;
    onColdClearInitDone: (data: { runId: number }) => action;
    onColdClearError: (data: { runId: number, error: string }) => action;
    onColdClearNoMove: (data: { runId: number }) => action;
    onColdClearSequenceDone: (data: { runId: number }) => action;
    coldClearFinishSearch: (runId: number) => action;
}

let nextRunId = 1;

const normalizeTopBranchCount = (count: number): number => {
    if (!Number.isFinite(count)) {
        return COLD_CLEAR_TOP_BRANCH_COUNT_DEFAULT;
    }
    const normalizedCount = Math.floor(count);
    return Math.max(COLD_CLEAR_TOP_BRANCH_COUNT_MIN, Math.min(COLD_CLEAR_TOP_BRANCH_COUNT_MAX, normalizedCount));
};

const normalizeCombo = (combo: number | undefined): number => {
    if (typeof combo !== 'number' || !Number.isFinite(combo)) {
        return 0;
    }
    return Math.max(0, Math.floor(combo));
};

const normalizeNextLimit = (nextLimit: number | null): number | null => {
    if (nextLimit === null) {
        return null;
    }
    if (!Number.isFinite(nextLimit)) {
        return null;
    }
    const normalized = Math.floor(nextLimit);
    if (normalized < COLD_CLEAR_NEXT_LIMIT_MIN || COLD_CLEAR_NEXT_LIMIT_MAX < normalized) {
        return null;
    }
    return normalized;
};

const saveColdClearViewSettings = (
    state: Readonly<State>,
    overrides?: Partial<{
        topBranchCount: number;
        holdAllowed: boolean;
        speculate: boolean;
        nextLimit: number | null;
    }>,
) => {
    if (typeof localStorage === 'undefined') {
        return;
    }

    localStorageWrapper.saveViewSettings({
        trimTopBlank: state.listView?.trimTopBlank ?? false,
        buttonDropMovesSubtree: state.tree?.buttonDropMovesSubtree ?? false,
        grayAfterLineClear: state.tree?.grayAfterLineClear ?? false,
        coldClearTopBranchCount: overrides?.topBranchCount ?? state.coldClear.topBranchCount,
        coldClearHoldAllowed: overrides?.holdAllowed ?? state.coldClear.holdAllowed,
        coldClearSpeculate: overrides?.speculate ?? state.coldClear.speculate,
        coldClearNextLimit: overrides?.nextLimit !== undefined
            ? overrides.nextLimit
            : state.coldClear.nextLimit,
    });
};

const clearQueuePreviewIfNeeded = (state: Readonly<State>): NextState => {
    if (!state.coldClear.queuePreview) {
        return undefined;
    }
    return {
        coldClear: {
            ...state.coldClear,
            queuePreview: null,
        },
    };
};

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

const resolveCommentTextWithPreview = (
    pages: Page[],
    pageIndex: number,
    preview: Readonly<State>['coldClear']['queuePreview'],
): string | null => {
    if (preview && preview.pageIndex === pageIndex) {
        return preview.text;
    }
    return resolveCommentTextFromPage(pages, pageIndex);
};

const parseQueueCommentFromPage = (
    pages: Page[],
    pageIndex: number,
    preview: Readonly<State>['coldClear']['queuePreview'] = null,
) => {
    const commentText = resolveCommentTextWithPreview(pages, pageIndex, preview);
    if (commentText === null) {
        return null;
    }
    return parseQueueStateComment(commentText);
};

const parseScoreFromComment = (commentText: string): number | null => {
    const segments = commentText.split(' | ');
    for (const segment of segments) {
        const tokens = segment.split(' ');
        for (const token of tokens) {
            const matched = SCORE_SEGMENT_REGEX.exec(token);
            if (!matched) {
                continue;
            }
            const score = Number.parseFloat(matched[1]);
            if (Number.isFinite(score)) {
                return score;
            }
        }
    }
    return null;
};

const commitQueuePreviewIfNeeded = (state: Readonly<State>): void => {
    const preview = state.coldClear.queuePreview;
    if (!preview || !appActions) {
        return;
    }

    const currentComment = resolveCommentTextFromPage(state.fumen.pages, preview.pageIndex);
    if (currentComment === null || currentComment === preview.text) {
        return;
    }

    appActions.setCommentText({
        pageIndex: preview.pageIndex,
        text: preview.text,
    });
};

export interface ColdClearMenuQueueState {
    pageIndex: number;
    hold: Piece | null;
    queue: Piece[];
    b2b: boolean;
    combo: number;
    score: number | null;
}

export const resolveCurrentColdClearMenuQueueState = (
    state: Readonly<State>,
): ColdClearMenuQueueState | null => {
    const pageIndex = state.fumen.currentIndex;
    const commentText = resolveCommentTextWithPreview(
        state.fumen.pages,
        pageIndex,
        state.coldClear.queuePreview,
    );
    if (commentText === null) {
        return null;
    }

    const parsed = parseQueueStateComment(commentText);
    if (!parsed) {
        return null;
    }

    return {
        pageIndex,
        hold: parsed.hold,
        queue: parsed.queue.slice(),
        b2b: parsed.b2b,
        combo: parsed.combo,
        score: parseScoreFromComment(commentText),
    };
};

type SearchInputError =
    | 'targetNotFound'
    | 'unsupportedPageFlags'
    | 'invalidQueueComment';

type SearchInput = {
    tree: ReturnType<typeof getTreeForState>;
    page: Page;
    parsed: NonNullable<ReturnType<typeof parseQueueStateComment>>;
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

    const parsed = parseQueueCommentFromPage(
        state.fumen.pages,
        target.pageIndex,
        state.coldClear.queuePreview,
    );
    if (!parsed || parsed.queue.length === 0) {
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
    parsed: NonNullable<ReturnType<typeof parseQueueStateComment>>;
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

    const parsed = parseQueueCommentFromPage(
        state.fumen.pages,
        target.pageIndex,
        state.coldClear.queuePreview,
    );
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

export const isColdClearSearchBlockedByHoldQueue = (
    state: Readonly<State>,
): boolean => {
    if (!state.coldClear.holdAllowed || state.coldClear.nextLimit !== 1) {
        return false;
    }
    const queueState = resolveCurrentColdClearMenuQueueState(state);
    return queueState !== null && queueState.hold === null;
};

export const canSwapCurrentPieceWithHoldQueue = (state: Readonly<State>): boolean => {
    if (!state.coldClear.holdAllowed) {
        return false;
    }
    const pageIndex = state.fumen.currentIndex;
    const parsed = parseQueueCommentFromPage(state.fumen.pages, pageIndex, state.coldClear.queuePreview);
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

const buildScoredQueueComment = (
    score: number | undefined,
    hold: Piece | null,
    queue: Piece[],
    b2b: boolean,
    combo: number,
): string => {
    const queueStateComment = buildQueueStateComment(hold, queue, b2b, combo);
    if (!isScorePrintable(score)) {
        return queueStateComment;
    }

    const scoreComment = `score=${formatScore(score)}`;
    if (!queueStateComment) {
        return scoreComment;
    }

    return `${scoreComment} | ${queueStateComment}`;
};

const buildPlacedSpawnScoredQueueComment = (
    score: number | undefined,
    hold: Piece | null,
    queue: Piece[],
    b2b: boolean,
    combo: number,
): string | null => {
    if (!isScorePrintable(score)) {
        return null;
    }

    const queueComment = buildQueueStateComment(hold, queue, b2b, combo);
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
    const initQueue = session.nextLimit === null
        ? session.searchQueue
        : session.searchQueue.slice(0, session.nextLimit);
    const ccQueue = initQueue.map(piece => PIECE_TO_CC[piece]);
    return {
        type: 'init',
        field: ccField,
        hold: ccHold,
        b2b: session.b2b,
        combo: session.combo,
        queue: ccQueue,
        holdAllowed: session.holdAllowed,
        speculate: session.speculate,
        thinkMs: session.thinkMs,
    };
};

const buildSingleInitMessage = (session: SingleRunSession): CCInitMessage => {
    const ccField = fieldToCC(session.field);
    const ccHold = session.hold !== null ? PIECE_TO_CC[session.hold] : CC_HOLD_NONE;
    const initQueue = session.nextLimit === null
        ? session.queue
        : session.queue.slice(0, session.nextLimit);
    const ccQueue = initQueue.map(p => PIECE_TO_CC[p]);
    return {
        type: 'init',
        field: ccField,
        hold: ccHold,
        b2b: session.b2b,
        combo: session.combo,
        queue: ccQueue,
        holdAllowed: session.holdAllowed,
        speculate: session.speculate,
        thinkMs: THINK_MS,
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
    case 'sequenceDone':
        appActions.onColdClearSequenceDone({ runId });
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

        if (isColdClearSearchBlockedByHoldQueue(state)) {
            M.toast({ html: i18n.ColdClear.InsufficientQueueForHold(), classes: 'top-toast', displayLength: 1500 });
            return undefined;
        }

        commitQueuePreviewIfNeeded(state);

        const resolved = resolveSingleSearchInput(state);
        if (!resolved.input) {
            showSearchValidationError(resolved.error ?? 'targetNotFound');
            return clearQueuePreviewIfNeeded(state);
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
            b2b: parsed.b2b,
            combo: normalizeCombo(parsed.combo),
            totalMoves: parsed.queue.length,
            holdAllowed: state.coldClear.holdAllowed,
            speculate: state.coldClear.speculate,
            nextLimit: state.coldClear.nextLimit,
            colorize: page.flags.colorize,
            srs: page.flags.srs,
        };
        currentSession = session;

        startWorkerSession(session, buildSingleInitMessage(session), () => session.resultPages.length > 0);

        return {
            tree: shouldEnableTree ? {
                ...state.tree,
                enabled: true,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: target.nodeId,
            } : state.tree,
            coldClear: {
                ...state.coldClear,
                runId,
                runType: 'single',
                targetNodeId: target.nodeId,
                isRunning: true,
                abortRequested: false,
                progress: { current: 0, total: session.totalMoves },
                queuePreview: null,
            },
        };
    },

    startColdClearTopThreeSearch: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        if (isColdClearSearchBlockedByHoldQueue(state)) {
            M.toast({ html: i18n.ColdClear.InsufficientQueueForHold(), classes: 'top-toast', displayLength: 1500 });
            return undefined;
        }

        commitQueuePreviewIfNeeded(state);

        const resolved = resolveTopBranchSearchInput(state);
        if (!resolved.input) {
            showSearchValidationError(resolved.error ?? 'targetNotFound');
            return clearQueuePreviewIfNeeded(state);
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
        const topBranchCount = normalizeTopBranchCount(state.coldClear.topBranchCount);

        const session: Top3RunSession = {
            runId,
            field,
            topBranchCount,
            runType: 'top3',
            wrapper: new ColdClearWrapper(),
            targetNodeId: target.nodeId,
            hold: parsed.hold,
            queue: parsed.queue.slice(),
            b2b: parsed.b2b,
            combo: normalizeCombo(parsed.combo),
            holdAllowed: state.coldClear.holdAllowed,
            speculate: state.coldClear.speculate,
            colorize: page.flags.colorize,
            srs: page.flags.srs,
        };
        currentSession = session;

        const ccField = fieldToCC(field);
        const ccHold = parsed.hold !== null ? PIECE_TO_CC[parsed.hold] : CC_HOLD_NONE;
        const initQueue = state.coldClear.nextLimit === null
            ? parsed.queue
            : parsed.queue.slice(0, state.coldClear.nextLimit);
        const ccQueue = initQueue.map(p => PIECE_TO_CC[p]);

        const initMsg: CCInitMessage = {
            type: 'init',
            field: ccField,
            hold: ccHold,
            b2b: parsed.b2b,
            combo: normalizeCombo(parsed.combo),
            queue: ccQueue,
            holdAllowed: state.coldClear.holdAllowed,
            speculate: state.coldClear.speculate,
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
                ...state.coldClear,
                runId,
                runType: 'top3',
                targetNodeId: target.nodeId,
                isRunning: true,
                abortRequested: false,
                progress: { current: 0, total: 1 },
                queuePreview: null,
            },
        };
    },

    setColdClearTopBranchCount: ({ count }) => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const normalizedCount = normalizeTopBranchCount(count);
        if (state.coldClear.topBranchCount === normalizedCount) {
            return undefined;
        }

        saveColdClearViewSettings(state, { topBranchCount: normalizedCount });

        return {
            coldClear: {
                ...state.coldClear,
                topBranchCount: normalizedCount,
            },
        };
    },

    setColdClearHoldAllowed: ({ holdAllowed }) => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }
        if (state.coldClear.holdAllowed === holdAllowed) {
            return undefined;
        }

        saveColdClearViewSettings(state, { holdAllowed });

        return {
            coldClear: {
                ...state.coldClear,
                holdAllowed,
            },
        };
    },

    setColdClearSpeculate: ({ speculate }) => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }
        if (state.coldClear.speculate === speculate) {
            return undefined;
        }

        saveColdClearViewSettings(state, { speculate });

        return {
            coldClear: {
                ...state.coldClear,
                speculate,
            },
        };
    },

    setColdClearNextLimit: ({ nextLimit }) => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const normalizedNextLimit = normalizeNextLimit(nextLimit);
        if (state.coldClear.nextLimit === normalizedNextLimit) {
            return undefined;
        }

        saveColdClearViewSettings(state, { nextLimit: normalizedNextLimit });

        return {
            coldClear: {
                ...state.coldClear,
                nextLimit: normalizedNextLimit,
            },
        };
    },

    evaluatePlacedSpawnMinoScore: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        commitQueuePreviewIfNeeded(state);

        const resolved = resolvePlacedSpawnInput(state);
        if (!resolved.input) {
            showPlacedSpawnValidationError(resolved.error ?? 'targetNotFound');
            return clearQueuePreviewIfNeeded(state);
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
            b2b: parsed.b2b,
            combo: normalizeCombo(parsed.combo),
            searchHold: searchState.hold,
            searchQueue: searchState.queue,
            holdAllowed: state.coldClear.holdAllowed,
            speculate: state.coldClear.speculate,
            nextLimit: state.coldClear.nextLimit,
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
                ...state.coldClear,
                runId,
                runType: 'placed',
                targetNodeId: target.nodeId,
                isRunning: true,
                abortRequested: false,
                progress: { current: 0, total: 1 },
                queuePreview: null,
            },
        };
    },

    appendColdClearOneBagToComment: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        commitQueuePreviewIfNeeded(state);

        const pageIndex = state.fumen.currentIndex;
        const currentComment = resolveCommentTextWithPreview(
            state.fumen.pages,
            pageIndex,
            state.coldClear.queuePreview,
        );
        if (currentComment === null) {
            return clearQueuePreviewIfNeeded(state);
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
        const runtimeActions = appActions;

        return sequence(state, [
            () => {
                runtimeActions.setCommentText({ pageIndex, text: nextComment });
                return undefined;
            },
            () => ({
                coldClear: {
                    ...state.coldClear,
                    queuePreview: null,
                },
            }),
        ]);
    },

    swapCurrentPieceWithHoldQueue: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }
        if (!state.coldClear.holdAllowed) {
            return undefined;
        }

        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        if (!page || !page.piece || !isMinoPiece(page.piece.type)) {
            showSwapValidationError('missingCurrentPiece');
            return undefined;
        }

        const parsed = parseQueueCommentFromPage(state.fumen.pages, pageIndex, state.coldClear.queuePreview);
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
        const runtimeActions = appActions;

        const srs = state.fumen.pages[0]?.flags.srs ?? true;
        return sequence(state, [
            () => {
                runtimeActions.setCommentText({ pageIndex, text: nextComment });
                return undefined;
            },
            () => {
                runtimeActions.spawnPiece({ srs, piece: nextSpawnPiece });
                return undefined;
            },
        ]);
    },

    previewColdClearQueueComment: ({ hold, queue, b2b, combo }) => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const pageIndex = state.fumen.currentIndex;
        const currentComment = resolveCommentTextWithPreview(
            state.fumen.pages,
            pageIndex,
            state.coldClear.queuePreview,
        );
        if (currentComment === null) {
            return undefined;
        }

        const score = parseScoreFromComment(currentComment);
        const nextText = buildScoredQueueComment(
            score === null ? undefined : score,
            hold,
            queue,
            b2b,
            combo,
        );
        if (
            state.coldClear.queuePreview
            && state.coldClear.queuePreview.pageIndex === pageIndex
            && state.coldClear.queuePreview.text === nextText
        ) {
            return undefined;
        }

        return {
            coldClear: {
                ...state.coldClear,
                queuePreview: { pageIndex, text: nextText },
            },
        };
    },

    commitColdClearQueueComment: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const preview = state.coldClear.queuePreview;
        if (!preview) {
            return undefined;
        }

        const currentComment = resolveCommentTextFromPage(state.fumen.pages, preview.pageIndex);
        if (!appActions) {
            return undefined;
        }

        if (currentComment !== null && currentComment !== preview.text) {
            appActions.setCommentText({
                pageIndex: preview.pageIndex,
                text: preview.text,
            });
        }

        return {
            coldClear: {
                ...state.coldClear,
                queuePreview: null,
            },
        };
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
            if (currentSession.nextLimit === null) {
                currentSession.wrapper.requestSequence(currentSession.totalMoves);
            } else {
                currentSession.wrapper.requestMove();
            }
        } else if (currentSession.runType === 'top3') {
            currentSession.wrapper.requestTopMoves(currentSession.topBranchCount);
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
        session.b2b = result.b2b === undefined ? session.b2b : result.b2b;
        session.combo = normalizeCombo(result.combo);

        const nextComment = buildScoredQueueComment(
            result.score,
            session.hold,
            session.queue,
            session.b2b,
            session.combo,
        );

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

        if (session.nextLimit !== null) {
            terminateSession(session);
            session.wrapper = new ColdClearWrapper();
            startWorkerSession(session, buildSingleInitMessage(session), () => session.resultPages.length > 0);
        }

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
                const runtimeActions = appActions;

                return sequence(state, [
                    () => {
                        runtimeActions.setCommentText({ pageIndex: session.targetPageIndex, text: outsideTopComment });
                        return undefined;
                    },
                    () => {
                        runtimeActions.coldClearFinishSearch(runId);
                        return undefined;
                    },
                    () => {
                        runtimeActions.changeToDrawerScreen({});
                        return undefined;
                    },
                    () => {
                        runtimeActions.changeToMovePieceMode();
                        return undefined;
                    },
                ]);
            }

            const nextComment = buildPlacedSpawnScoredQueueComment(
                exactResult.score,
                session.hold,
                session.queue,
                session.b2b,
                session.combo,
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
            const runtimeActions = appActions;

            return sequence(state, [
                () => {
                    runtimeActions.setCommentText({ pageIndex: session.targetPageIndex, text: nextComment });
                    return undefined;
                },
                () => {
                    runtimeActions.coldClearFinishSearch(runId);
                    return undefined;
                },
                () => {
                    runtimeActions.changeToDrawerScreen({});
                    return undefined;
                },
                () => {
                    runtimeActions.changeToMovePieceMode();
                    return undefined;
                },
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

        results.slice(0, session.topBranchCount).forEach((result) => {
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
                    text: buildScoredQueueComment(
                        result.score,
                        queueState.hold,
                        queueState.queue,
                        result.b2b === true,
                        normalizeCombo(result.combo),
                    ),
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
        const runtimeActions = appActions;

        return sequence(state, [
            () => {
                runtimeActions.addColdClearBranches({
                    parentNodeId: session.targetNodeId,
                    pages: candidatePages,
                    focusFirstAdded: true,
                });
                return undefined;
            },
            () => {
                runtimeActions.coldClearFinishSearch(runId);
                return undefined;
            },
            () => {
                runtimeActions.changeToTreeViewScreen();
                return undefined;
            },
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

    onColdClearSequenceDone: ({ runId }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }

        if (!currentSession || currentSession.runId !== runId || currentSession.runType !== 'single') {
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
                ...state.coldClear,
                isRunning: false,
                abortRequested: false,
                runId: state.coldClear.runId,
                runType: 'single',
                targetNodeId: null,
                progress: null,
                queuePreview: null,
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
