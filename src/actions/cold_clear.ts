import { Piece, Rotation } from '../lib/enums';
import { action } from '../actions';
import { NextState } from './commons';
import { State } from '../states';
import { Page, Move } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';
import { encode } from '../lib/fumen/fumen';
import { PageFieldOperation, Pages } from '../lib/pages';
import { parseQueueComment, buildQueueComment } from '../lib/cold_clear/queueParser';
import { fieldToCC } from '../lib/cold_clear/fieldConverter';
import {
    CCInitMessage,
    CCMoveResult,
    CC_TO_PIECE,
    CC_ROTATION_TO_APP,
    CC_HOLD_NONE,
    PIECE_TO_CC,
    WorkerResponse,
} from '../lib/cold_clear/types';
import { ColdClearWrapper } from '../lib/cold_clear/ColdClearWrapper';
import { i18n } from '../locales/keys';

declare const M: any;

// Per-run session state — isolated by runId
interface RunSession {
    runId: number;
    wrapper: ColdClearWrapper;
    resultPages: Page[];
    field: Field;
    hold: Piece | null;
    queue: Piece[];
    totalMoves: number;
    colorize: boolean;
    srs: boolean;
}

let currentSession: RunSession | null = null;

const THINK_MS = 1000;
const INIT_TIMEOUT_MS = 10000;

// Action reference (set after Hyperapp mounts)
let appActions: ColdClearActions | null = null;

export const initColdClearActions = (actions: ColdClearActions) => {
    appActions = actions;
};

export interface ColdClearActions {
    startColdClearSearch: () => action;
    stopColdClearSearch: () => action;
    onColdClearMoveResult: (data: { runId: number, result: CCMoveResult }) => action;
    onColdClearInitDone: (data: { runId: number }) => action;
    onColdClearError: (data: { runId: number, error: string }) => action;
    onColdClearNoMove: (data: { runId: number }) => action;
    coldClearFinishSearch: (runId: number) => action;
}

let nextRunId = 1;

function terminateSession(session: RunSession) {
    session.wrapper.terminate();
}

async function finishSearch(runId: number) {
    // Only process if this session is still the active one
    const session = currentSession;
    if (!session || session.runId !== runId) {
        return;
    }

    // Detach session immediately to prevent re-entry
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

    if (appActions) {
        appActions.coldClearFinishSearch(runId);
    }
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
    case 'noMove':
        appActions.onColdClearNoMove({ runId });
        break;
    case 'error':
        appActions.onColdClearError({ runId, error: msg.message });
        break;
    }
}

export const coldClearActions: Readonly<ColdClearActions> = {
    startColdClearSearch: () => (state): NextState => {
        if (state.coldClear.isRunning) {
            return undefined;
        }

        const page = state.fumen.pages[state.fumen.currentIndex];
        if (!page) { return undefined; }

        // Validate flags
        if (!page.flags.lock || page.flags.mirror || page.flags.rise || page.flags.quiz) {
            return undefined;
        }

        // Parse comment
        const commentText = state.comment.text;
        const parsed = parseQueueComment(commentText);
        if (!parsed) {
            return undefined;
        }

        // Terminate any lingering session
        if (currentSession) {
            terminateSession(currentSession);
            currentSession = null;
        }

        // Assign new runId
        const runId = nextRunId;
        nextRunId += 1;

        // Build session
        const pages = new Pages(state.fumen.pages);
        const field = pages.getField(state.fumen.currentIndex, PageFieldOperation.Command);
        const session: RunSession = {
            runId,
            field,
            wrapper: new ColdClearWrapper(),
            resultPages: [],
            hold: parsed.hold,
            queue: parsed.queue.slice(),
            totalMoves: parsed.queue.length,
            colorize: page.flags.colorize,
            srs: page.flags.srs,
        };
        currentSession = session;

        // Convert field and pieces for CC
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

        // Set up init timeout bound to this runId
        const initTimeoutId = setTimeout(() => {
            if (currentSession && currentSession.runId === runId && currentSession.resultPages.length === 0) {
                M.toast({ html: i18n.ColdClear.InitTimeout(), classes: 'top-toast', displayLength: 1500 });
                terminateSession(currentSession);
                currentSession = null;
                if (appActions) {
                    appActions.coldClearFinishSearch(runId);
                }
            }
        }, INIT_TIMEOUT_MS);

        session.wrapper.start(initMsg, (msg: WorkerResponse) => {
            if (msg.type === 'initDone') {
                clearTimeout(initTimeoutId);
            }
            handleWorkerMessage(runId, msg);
        });

        return {
            coldClear: {
                runId,
                isRunning: true,
                abortRequested: false,
                progress: { current: 0, total: session.totalMoves },
            },
        };
    },

    stopColdClearSearch: () => (state): NextState => {
        if (!state.coldClear.isRunning) {
            return undefined;
        }

        const runId = state.coldClear.runId;

        // Finish with accumulated results (finishSearch handles termination)
        finishSearch(runId);

        return {
            coldClear: {
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

        currentSession.wrapper.requestMove();
        return undefined;
    },

    onColdClearMoveResult: ({ runId, result }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }
        if (!currentSession || currentSession.runId !== runId) {
            return undefined;
        }

        const session = currentSession;

        if (state.coldClear.abortRequested) {
            finishSearch(runId);
            return undefined;
        }

        // Convert CC result to app types
        const placedPiece = CC_TO_PIECE[result.piece];
        const rotation = CC_ROTATION_TO_APP[result.rotation];

        const move: Move = {
            rotation,
            type: placedPiece,
            coordinate: { x: result.x, y: result.y },
        };

        // Update hold/queue based on whether hold was used
        if (result.hold) {
            if (session.hold === null) {
                session.hold = session.queue[0];
                session.queue = session.queue.slice(2);
            } else {
                const newHold = session.queue[0];
                session.queue = session.queue.slice(1);
                session.hold = newHold;
            }
        } else {
            session.queue = session.queue.slice(1);
        }

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

        // Apply piece to field and clear lines for next step
        session.field.put({ rotation, type: placedPiece, coordinate: { x: result.x, y: result.y } });
        session.field.clearLine();

        // Check if we should continue
        if (session.queue.length === 0) {
            finishSearch(runId);
            return {
                coldClear: {
                    ...state.coldClear,
                    progress: { current: session.resultPages.length, total: session.totalMoves },
                },
            };
        }

        // Request next move
        session.wrapper.requestMove();

        return {
            coldClear: {
                ...state.coldClear,
                progress: { current: session.resultPages.length, total: session.totalMoves },
            },
        };
    },

    onColdClearNoMove: ({ runId }) => (state): NextState => {
        if (!state.coldClear.isRunning || state.coldClear.runId !== runId) {
            return undefined;
        }

        finishSearch(runId);
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

        if (appActions) {
            appActions.coldClearFinishSearch(runId);
        }

        return undefined;
    },

    coldClearFinishSearch: (runId: number) => (state): NextState => {
        // Guard: only reset state if this runId is still the active one.
        // Prevents a stale async finishSearch from clobbering a newer run.
        if (state.coldClear.runId !== runId) {
            return undefined;
        }
        return {
            coldClear: {
                isRunning: false,
                abortRequested: false,
                runId: state.coldClear.runId,
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
