// tslint:disable-next-line:import-name
import initWasm, { ColdClearBot } from '../cold_clear_wasm/cold_clear_wasm_api';
import { WorkerMessage, WorkerResponse } from './types';

let bot: ColdClearBot | null = null;
let thinkMs = 1000;

const postResponse = (msg: WorkerResponse) => {
    (self as any).postMessage(msg);
};

(self as any).onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    try {
        if (msg.type === 'init') {
            await initWasm();
            bot = ColdClearBot.new(msg.field, msg.hold, msg.b2b, msg.combo, new Uint8Array(msg.queue));
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
                    hold: result.hold,
                    piece: result.piece,
                    rotation: result.rotation,
                    x: result.x,
                    y: result.y,
                });
            } else {
                postResponse({ type: 'noMove' });
            }
        }
    } catch (e) {
        postResponse({ type: 'error', message: String(e) });
    }
};
