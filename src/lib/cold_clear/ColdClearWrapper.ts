import { CCInitMessage, WorkerMessage, WorkerResponse } from './types';

export class ColdClearWrapper {
    private worker: Worker | null = null;
    private onMessage: ((msg: WorkerResponse) => void) | null = null;

    start(initMsg: CCInitMessage, onMessage: (msg: WorkerResponse) => void): void {
        this.onMessage = onMessage;
        this.worker = new Worker(new URL('./cold_clear.worker.ts', import.meta.url));
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            if (this.onMessage) {
                this.onMessage(event.data);
            }
        };
        this.worker.onerror = (error) => {
            if (this.onMessage) {
                this.onMessage({ type: 'error', message: String(error.message) });
            }
        };
        this.worker.postMessage(initMsg);
    }

    requestMove(): void {
        if (this.worker) {
            this.worker.postMessage({ type: 'requestMove' } as WorkerMessage);
        }
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.onMessage = null;
    }
}
