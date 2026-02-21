import { Piece } from '../lib/enums';
import type { action } from '../actions';
import type { TreeOperationActions } from './tree_operations';
import { NextState, sequence } from './commons';
import { State } from '../states';
import { Page, Move } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';
import { encode } from '../lib/fumen/fumen';
import { PageFieldOperation, Pages } from '../lib/pages';
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

declare const M: any;

type RunType = 'single' | 'top3';

interface SessionBase {
    runId: number;
    runType: RunType;
    wrapper: ColdClearWrapper;
}

interface SingleRunSession extends SessionBase {
    runType: 'single';
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

type RunSession = SingleRunSession | Top3RunSession;

type ColdClearRuntimeActions = ColdClearActions
    & Pick<TreeOperationActions, 'addColdClearBranches'>
    & Pick<ScreenActions, 'changeToTreeViewScreen'>;

let currentSession: RunSession | null = null;

const THINK_MS = 1000;
const INIT_TIMEOUT_MS = 10000;
const TOP_BRANCH_COUNT = 5;

// Action reference (set after Hyperapp mounts)
let appActions: ColdClearRuntimeActions | null = null;

export const initColdClearActions = (actions: ColdClearRuntimeActions) => {
    appActions = actions;
};

export interface ColdClearActions {
    startColdClearSearch: () => action;
    startColdClearTopThreeSearch: () => action;
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

const getTreeForState = (state: State) => {
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
    state: State,
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

const createBranchComment = (hold: Piece | null, queue: Piece[]): string => {
    return buildQueueComment(hold, queue);
};

const emitFinish = (runId: number) => {
    if (appActions) {
        appActions.coldClearFinishSearch(runId);
    }
};

async function finishSingleSearch(runId: number) {
    const session = currentSession;
    if (!session || session.runId !== runId || session.runType !== 'single') {
        return;
    }

    currentSession = null;
    terminateSession(session);

    if (session.resultPages.length === 0) {
        M.toast({ html: i18n.ColdClear.NoMoveFound(), classes: 'top-toast', displayLength: 1500 });
    } else {
        try {
            const encoded = await encode(session.resultPages, true);
            const params = new URLSearchParams();
            params.set('d', `v115@${encoded}`);
            params.set('screen', 'list');
            const url = `${window.location.origin}${window.location.pathname}#?${params.toString()}`;

            const openedTab = window.open(url, '_blank');
            if (!openedTab) {
                await navigator.clipboard.writeText(url);
                M.toast({ html: i18n.ColdClear.PopupBlocked(), classes: 'top-toast', displayLength: 3000 });
            }
        } catch (error) {
            M.toast({ html: i18n.ColdClear.WorkerError(), classes: 'top-toast', displayLength: 1500 });
        }
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

        const page = state.fumen.pages[state.fumen.currentIndex];
        if (!isPageSupported(page)) {
            return undefined;
        }

        const parsed = parseQueueComment(state.comment.text);
        if (!parsed) {
            return undefined;
        }

        if (currentSession) {
            terminateSession(currentSession);
            currentSession = null;
        }

        const runId = nextRunId;
        nextRunId += 1;

        const pages = new Pages(state.fumen.pages);
        const field = pages.getField(state.fumen.currentIndex, PageFieldOperation.Command);
        const session: SingleRunSession = {
            runId,
            field,
            runType: 'single',
            wrapper: new ColdClearWrapper(),
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
            coldClear: {
                runId,
                runType: 'single',
                targetNodeId: null,
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

        const page = state.fumen.pages[state.fumen.currentIndex];
        if (!isPageSupported(page)) {
            return undefined;
        }

        const parsed = parseQueueComment(state.comment.text);
        if (!parsed) {
            return undefined;
        }

        const tree = getTreeForState(state);
        const target = resolveTargetNode(state, tree);
        if (!target) {
            return undefined;
        }
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

    stopColdClearSearch: () => (state): NextState => {
        if (!state.coldClear.isRunning) {
            return undefined;
        }

        const runId = state.coldClear.runId;
        const session = currentSession;
        if (session && session.runId === runId) {
            if (session.runType === 'single') {
                finishSingleSearch(runId);
            } else {
                finishTop3Search(runId);
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
        } else {
            currentSession.wrapper.requestTopMoves(TOP_BRANCH_COUNT);
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

        const nextComment = buildQueueComment(session.hold, session.queue);

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
            return {
                coldClear: {
                    ...state.coldClear,
                    progress: { current: session.resultPages.length, total: session.totalMoves },
                },
            };
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

        if (!currentSession || currentSession.runId !== runId || currentSession.runType !== 'top3') {
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

            const nextField = session.field.copy();
            try {
                nextField.put(move);
                nextField.clearLine();
            } catch (e) {
                return;
            }

            candidatePages.push({
                index: 0,
                field: { obj: nextField },
                comment: {
                    text: createBranchComment(queueState.hold, queueState.queue),
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
            }),
            appActions.coldClearFinishSearch(runId),
            appActions.changeToTreeViewScreen(),
        ]);
    },

    onColdClearNoMove: ({ runId }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
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
