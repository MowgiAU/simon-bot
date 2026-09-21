/**
 * FL Studio plugin wrapper ("Fruity Wrapper") encoding for VST3 and VST2 plugins.
 *
 * Reverse-engineered from FL 21.2 projects (Kontakt 8, Serum 2, Tekno, Pro-Q 3, OTT as VST3;
 * BA-1 as VST2) and FL's bundled demo songs (VST2 effects that store parameter lists).
 * The wrapper is the plugin's event 213 payload:
 *   u32 10, then sub-events { u32 id, u64 length, bytes }:
 *     1, 2, 30, 31 (effects only), 32   host/IO settings (copied from FL's own output)
 *     50   plugin kind: VST3 8 = generator, 7 = effect; VST2 4 = generator, 0 = effect
 *     52   VST3 class ID (16 bytes, COM byte order — see vst3ClassId)
 *     51   VST2 unique ID (4 bytes, little-endian)      57  VST2 version (u32, e.g. 2400)
 *     54   name, 55 plugin path, 56 vendor
 *     53   state:
 *       VST3: an 80-byte header, then chunks { u32 id, u64 length, bytes }:
 *             3 = component (processor) state, 2 = controller state,
 *             4 = FL's parameter-ID list (omitted — FL rebuilds it from the plugin)
 *       VST2: i32 -9, u8 kind, then either
 *             kind 0x0d (chunk):  i32 -2, u32 length, 8 zero bytes, the plugin's chunk
 *             kind 0x05 (params): i32 0, u32 0, u32 count, count × f32, then a fixed 29-byte tail
 * The state bytes are the plugin's own data — byte-for-byte what Ableton stores
 * (<ProcessorState>/<ControllerState> for VST3, <Buffer> for VST2) — so presets carry over.
 */

interface FlPluginBase {
    name: string;
    vendor?: string;
    path: string;
    kind: 'generator' | 'effect';
}

export interface FlVst3Plugin extends FlPluginBase {
    format: 'vst3';
    classId: Buffer;          // 16 bytes
    processorState: Buffer;
    controllerState: Buffer;
}

export interface FlVst2Plugin extends FlPluginBase {
    format: 'vst2';
    uniqueId: number;
    vstVersion: number;
    /** The plugin's own chunk (plugins that save one), or… */
    chunk?: Buffer;
    /** …its parameter values, 0–1 (plugins that don't). */
    params?: number[];
}

export type FlPlugin = FlVst3Plugin | FlVst2Plugin;

/**
 * Live stores a VST3 class ID as four signed/unsigned 32-bit "Fields"; FL stores the 16-byte
 * TUID in the VST3 SDK's Windows (COM) layout: l1 little-endian, l2 as two swapped 16-bit
 * halves, l3 and l4 big-endian (INLINE_UID in pluginterfaces/base/funknown.h).
 */
export function vst3ClassId(fields: number[]): Buffer {
    const [l1, l2, l3, l4] = fields.map((f) => f >>> 0);
    const b = Buffer.alloc(16);
    b.writeUInt32LE(l1, 0);
    b[4] = (l2 >>> 16) & 0xff; b[5] = (l2 >>> 24) & 0xff; b[6] = l2 & 0xff; b[7] = (l2 >>> 8) & 0xff;
    b.writeUInt32BE(l3, 8);
    b.writeUInt32BE(l4, 12);
    return b;
}

function sub(id: number, data: Buffer): Buffer {
    const h = Buffer.alloc(12);
    h.writeUInt32LE(id, 0);
    h.writeBigUInt64LE(BigInt(data.length), 4);
    return Buffer.concat([h, data]);
}

const hex = (s: string) => Buffer.from(s.replace(/\s/g, ''), 'hex');
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; };

// Verbatim from FL 21.2 (identical across every plugin in the reference projects)
const VST3_STATE_HEADER = (() => { const b = Buffer.alloc(80); b.writeUInt32LE(1, 0); b.writeUInt32LE(1, 4); b.writeUInt32LE(64, 8); b.writeUInt32LE(1, 16); return b; })();
const SUB1 = hex('ffffffffffffffff 0c000000 0000000000000000');
const SUB2 = hex('00a0000000190000008c7d00a4000000000100000000000000');
const IO_ONE = hex('00000000 01000000 00000000');
const VST2_PARAMS_TAIL = Buffer.concat([u32(1), Buffer.alloc(25)]);

function vst3State(p: FlVst3Plugin): Buffer {
    const chunks = [sub(3, p.processorState)];
    if (p.controllerState.length) chunks.push(sub(2, p.controllerState));
    return Buffer.concat([VST3_STATE_HEADER, ...chunks]);
}

function vst2State(p: FlVst2Plugin): Buffer {
    if (p.chunk) {
        const h = Buffer.alloc(21);
        h.writeInt32LE(-9, 0); h[4] = 0x0d; h.writeInt32LE(-2, 5); h.writeUInt32LE(p.chunk.length, 9);
        return Buffer.concat([h, p.chunk]);
    }
    const params = p.params ?? [];
    const h = Buffer.alloc(17);
    h.writeInt32LE(-9, 0); h[4] = 0x05; h.writeUInt32LE(params.length, 13);
    const values = Buffer.alloc(params.length * 4);
    params.forEach((v, i) => values.writeFloatLE(v, i * 4));
    return Buffer.concat([h, values, VST2_PARAMS_TAIL]);
}

export function pluginWrapper(p: FlPlugin): Buffer {
    const effect = p.kind === 'effect';
    const kind = Buffer.alloc(16);
    kind.writeUInt32LE(p.format === 'vst3' ? (effect ? 7 : 8) : (effect ? 0 : 4), 0);
    const io30 = Buffer.alloc(16); io30.writeUInt32LE(effect ? 1 : 0, 0); io30.writeUInt32LE(1, 4);

    const id = p.format === 'vst3'
        ? [sub(52, p.classId)]
        : [sub(51, u32(p.uniqueId)), sub(57, u32(p.vstVersion))];
    return Buffer.concat([
        u32(10),
        sub(1, SUB1),
        sub(2, SUB2),
        sub(30, io30),
        ...(effect ? [sub(31, IO_ONE)] : []),
        sub(32, IO_ONE),
        sub(50, kind),
        ...id,
        sub(54, Buffer.from(p.name, 'utf8')),
        sub(55, Buffer.from(p.path, 'utf8')),
        ...(p.vendor ? [sub(56, Buffer.from(p.vendor, 'utf8'))] : []),
        sub(53, p.format === 'vst3' ? vst3State(p) : vst2State(p)),
    ]);
}

/** Event 212 for a plugin slot. `insert` is the mixer insert for effects, 0 for channels. */
export function pluginSlotParams(kind: 'generator' | 'effect', insert: number): Buffer {
    const b = hex(kind === 'generator'
        ? '00000000000000000200000000000000500100000000000000000000000000000000000056000000' + '9a0000000000000000000000'
        : '00000000000000000200000000000000400100000000000000000000000000000000000070000000' + 'b30000000000000000000000');
    b.writeUInt32LE(insert, 0);
    return b;
}
