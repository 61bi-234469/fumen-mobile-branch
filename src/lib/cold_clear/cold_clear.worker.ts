// tslint:disable-next-line:import-name
import initWasm, { ColdClearBot } from '../cold_clear_wasm/cold_clear_wasm_api';
import { CCMove, WorkerMessage, WorkerResponse } from './types';

let bot: ColdClearBot | null = null;
let thinkMs = 1000;

const postResponse = (msg: WorkerResponse) => {
    (self as any).postMessage(msg);
};

const toMove = (result: any): CCMove => ({
    hold: result.hold,
    piece: result.piece,
    rotation: result.rotation,
    x: result.x,
    y: result.y,
    b2b: result.b2b === true,
    combo: typeof result.combo === 'number' ? result.combo : 0,
    score: typeof result.score === 'number' ? result.score : undefined,
});

(self as any).onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    try {
        if (msg.type === 'init') {
            await initWasm();
            bot = new ColdClearBot(
                msg.field,
                msg.hold,
                msg.b2b,
                msg.combo,
                new Uint8Array(msg.queue),
                msg.holdAllowed,
                msg.speculate,
            );
            if (msg.weightsPreset !== 0) {
                bot.set_weights_preset(msg.weightsPreset);
            }
            thinkMs = msg.thinkMs;
            postResponse({ type: 'initDone' });
        } else if (msg.type === 'requestMove') {
            if (!bot) {
                postResponse({ type: 'error', message: 'Bot not initialized' });
                return;
            }
            const result = bot.suggest_move_sync(thinkMs);
            if (result) {
                postResponse({
                    type: 'moveResult',
                    ...toMove(result),
                });
            } else {
                postResponse({ type: 'noMove' });
            }
        } else if (msg.type === 'requestTopMoves') {
            if (!bot) {
                postResponse({ type: 'error', message: 'Bot not initialized' });
                return;
            }
            const requestCount = Math.max(0, Math.floor(msg.count));
            if (requestCount <= 0) {
                postResponse({ type: 'topMovesResult', moves: [] });
                return;
            }
            const results = bot.suggest_top_moves_sync(thinkMs, requestCount);
            const moves: CCMove[] = Array.isArray(results) ? results.map(toMove) : [];

            if (moves.length === 0) {
                postResponse({ type: 'noMove' });
            } else {
                postResponse({ type: 'topMovesResult', moves: moves.slice(0, requestCount) });
            }
        } else if (msg.type === 'requestSequence') {
            if (!bot) {
                postResponse({ type: 'error', message: 'Bot not initialized' });
                return;
            }
            const requestCount = Math.max(0, Math.floor(msg.count));
            if (requestCount <= 0) {
                postResponse({ type: 'sequenceDone' });
                return;
            }

            for (let i = 0; i < requestCount; i += 1) {
                const result = bot.suggest_move_sync(thinkMs);
                if (!result) {
                    postResponse({ type: 'noMove' });
                    return;
                }
                postResponse({
                    type: 'moveResult',
                    ...toMove(result),
                });
            }
            postResponse({ type: 'sequenceDone' });
        }
    } catch (e) {
        postResponse({ type: 'error', message: String(e) });
    }
};
