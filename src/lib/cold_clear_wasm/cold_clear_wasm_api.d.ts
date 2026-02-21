/* tslint:disable */
/* eslint-disable */

/**
 * Result of a single move suggestion from Cold Clear.
 */
export class CCMove {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    hold: boolean;
    piece: number;
    rotation: number;
    x: number;
    y: number;
}

/**
 * Cold Clear bot wrapper for WASM.
 * Uses BotState directly (no internal Worker/Interface).
 */
export class ColdClearBot {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a piece to the next queue.
     * piece: piece value (0-6)
     */
    add_next_piece(piece: number): void;
    /**
     * Create a new bot.
     * field: 400 bytes (40 rows x 10 cols, bottom to top, 0=empty, 1=filled)
     * hold: piece value (0-6) or 255 for none
     * b2b: back-to-back state
     * combo: combo count
     * queue: next queue pieces (0-6)
     */
    static new(field: Uint8Array, hold: number, b2b: boolean, combo: number, queue: Uint8Array): ColdClearBot;
    /**
     * Run the think loop for up to think_ms milliseconds,
     * then suggest and advance one move.
     * Returns None if no move can be found (game over, etc.)
     */
    suggest_move_sync(think_ms: number): CCMove | undefined;
}

export function _web_worker_entry_point(scope: DedicatedWorkerGlobalScope): void;

export function init_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_ccmove_free: (a: number, b: number) => void;
    readonly __wbg_coldclearbot_free: (a: number, b: number) => void;
    readonly __wbg_get_ccmove_hold: (a: number) => number;
    readonly __wbg_get_ccmove_piece: (a: number) => number;
    readonly __wbg_get_ccmove_rotation: (a: number) => number;
    readonly __wbg_get_ccmove_x: (a: number) => number;
    readonly __wbg_get_ccmove_y: (a: number) => number;
    readonly __wbg_set_ccmove_hold: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_piece: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_rotation: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_x: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_y: (a: number, b: number) => void;
    readonly coldclearbot_add_next_piece: (a: number, b: number) => void;
    readonly coldclearbot_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly coldclearbot_suggest_move_sync: (a: number, b: number) => number;
    readonly init_panic_hook: () => void;
    readonly _web_worker_entry_point: (a: any) => void;
    readonly wasm_bindgen__closure__destroy__h469194238f790361: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h359933c86cfc0a84: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
