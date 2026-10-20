/* tslint:disable */
/* eslint-disable */

export class StudioLotEngine {
    free(): void;
    [Symbol.dispose](): void;
    assign_production(building_id: number, project_id: string, title: string, phase: string, progress: number): boolean;
    calculate_lot_quality_multiplier(): number;
    demolish_building(building_id: number): boolean;
    get_lot_state_json(): string;
    get_tiles_flat(): Uint8Array;
    constructor(cols: number, rows: number);
    place_building(b_type_str: string, x: number, y: number): number;
    send_agent_to(agent_id: number, target_x: number, target_y: number): boolean;
    spawn_agent(kind_str: string, name: string, x: number, y: number, building_id: number): number;
    sync_studio_facilities(facilities_json: string): void;
    tick(dt: number, current_week: number): void;
    trigger_box_office_surge(film_title: string, weekend_gross_m: number): void;
    upgrade_building(building_id: number): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_studiolotengine_free: (a: number, b: number) => void;
    readonly studiolotengine_assign_production: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly studiolotengine_calculate_lot_quality_multiplier: (a: number) => number;
    readonly studiolotengine_demolish_building: (a: number, b: number) => [number, number, number];
    readonly studiolotengine_get_lot_state_json: (a: number) => [number, number];
    readonly studiolotengine_get_tiles_flat: (a: number) => [number, number];
    readonly studiolotengine_new: (a: number, b: number) => number;
    readonly studiolotengine_place_building: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly studiolotengine_send_agent_to: (a: number, b: number, c: number, d: number) => number;
    readonly studiolotengine_spawn_agent: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly studiolotengine_sync_studio_facilities: (a: number, b: number, c: number) => void;
    readonly studiolotengine_tick: (a: number, b: number, c: number) => void;
    readonly studiolotengine_trigger_box_office_surge: (a: number, b: number, c: number, d: number) => void;
    readonly studiolotengine_upgrade_building: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
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
