/**
 * FL Studio VST3 plugin wrapper ("Fruity Wrapper") encoding.
 *
 * Reverse-engineered from an FL 21.2 project holding Kontakt 8, Serum 2, Tekno, Pro-Q 3 and OTT.
 * The wrapper is the plugin's event 213 payload:
 *   u32 type (10 = VST3), then sub-events { u32 id, u64 length, bytes }:
 *     1, 2, 30, 31 (effects only), 32   host/IO settings (copied from FL's own output)
 *     50   plugin kind: 8 = generator, 7 = effect
 *     52   VST3 class ID (16 bytes, COM byte order — see vst3ClassId)
 *     54   name, 55 .vst3 path, 56 vendor
 *     53   state: an 80-byte header, then chunks { u32 id, u64 length, bytes }:
 *            3 = component (processor) state, 2 = controller state,
 *            4 = FL's parameter-ID list (omitted — FL rebuilds it from the plugin)
 * The component/controller state is the plugin's own IBStream data, byte-for-byte what
 * Ableton stores as <ProcessorState>/<ControllerState>, so presets carry over unchanged.
 */

export interface FlVst3Plugin {
    name: string;
    vendor?: string;
    path: string;
    classId: Buffer;          // 16 bytes
    kind: 'generator' | 'effect';
    processorState: Buffer;
    controllerState: Buffer;
}

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

// Verbatim from FL 21.2 (identical across every plugin in the reference project)
const STATE_HEADER = (() => { const b = Buffer.alloc(80); b.writeUInt32LE(1, 0); b.writeUInt32LE(1, 4); b.writeUInt32LE(64, 8); b.writeUInt32LE(1, 16); return b; })();
const SUB1 = hex('ffffffffffffffff 0c000000 0000000000000000');
const SUB2 = hex('00a0000000190000008c7d00a4000000000100000000000000');
const IO_ONE = hex('00000000 01000000 00000000');

export function vst3Wrapper(p: FlVst3Plugin): Buffer {
    const chunks = [sub(3, p.processorState)];
    if (p.controllerState.length) chunks.push(sub(2, p.controllerState));
    const state = Buffer.concat([STATE_HEADER, ...chunks]);

    const effect = p.kind === 'effect';
    const kind = Buffer.alloc(16); kind.writeUInt32LE(effect ? 7 : 8, 0);
    const io30 = Buffer.alloc(16); io30.writeUInt32LE(effect ? 1 : 0, 0); io30.writeUInt32LE(1, 4);

    const type = Buffer.alloc(4); type.writeUInt32LE(10, 0);
    return Buffer.concat([
        type,
        sub(1, SUB1),
        sub(2, SUB2),
        sub(30, io30),
        ...(effect ? [sub(31, IO_ONE)] : []),
        sub(32, IO_ONE),
        sub(50, kind),
        sub(52, p.classId),
        sub(54, Buffer.from(p.name, 'utf8')),
        sub(55, Buffer.from(p.path, 'utf8')),
        ...(p.vendor ? [sub(56, Buffer.from(p.vendor, 'utf8'))] : []),
        sub(53, state),
    ]);
}

/** Event 212 for a plugin slot. `insert` is the mixer insert for effects, 0 for channels. */
export function vst3SlotParams(kind: 'generator' | 'effect', insert: number): Buffer {
    const b = hex(kind === 'generator'
        ? '00000000000000000200000000000000500100000000000000000000000000000000000056000000' + '9a0000000000000000000000'
        : '00000000000000000200000000000000400100000000000000000000000000000000000070000000' + 'b30000000000000000000000');
    b.writeUInt32LE(insert, 0);
    return b;
}
