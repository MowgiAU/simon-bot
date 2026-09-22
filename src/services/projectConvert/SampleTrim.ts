/**
 * Cuts an audio file down to a range of sample frames, without re-encoding.
 *
 * Used when a Live Simpler/Sampler plays only part of its sample (its start or end marker was
 * moved): FL's Sampler has no equivalent we can set, so the download ships the sample already
 * trimmed to what Live played. Handles uncompressed WAV (PCM or float, incl. WAVE_FORMAT_EXTENSIBLE)
 * and AIFF/AIFC (uncompressed 'NONE' / little-endian 'sowt'); anything else returns null.
 */

/** Frames [start, end) of an audio file, or null if the format can't be cut losslessly here. */
export function trimAudio(data: Buffer, start: number, end: number | null): Buffer | null {
    const tag = data.toString('ascii', 0, 4);
    if (tag === 'RIFF' && data.toString('ascii', 8, 12) === 'WAVE') return trimWav(data, start, end);
    if (tag === 'FORM' && ['AIFF', 'AIFC'].includes(data.toString('ascii', 8, 12))) return trimAiff(data, start, end);
    return null;
}

const clampRange = (frames: number, start: number, end: number | null): [number, number] => {
    const s = Math.max(0, Math.min(frames, Math.floor(start)));
    const e = Math.max(s, Math.min(frames, end == null ? frames : Math.ceil(end)));
    return [s, e];
};

function trimWav(data: Buffer, start: number, end: number | null): Buffer | null {
    let p = 12, blockAlign = 0, format = 0;
    const chunks: { id: string; body: Buffer }[] = [];
    let dataIndex = -1;
    while (p + 8 <= data.length) {
        const id = data.toString('ascii', p, p + 4);
        const len = data.readUInt32LE(p + 4);
        const body = data.subarray(p + 8, Math.min(data.length, p + 8 + len));
        if (id === 'fmt ') {
            format = body.readUInt16LE(0);
            blockAlign = body.readUInt16LE(12);
            if (format === 0xfffe && body.length >= 26) format = body.readUInt16LE(24);
        }
        if (id === 'data') dataIndex = chunks.length;
        chunks.push({ id, body });
        p += 8 + len + (len & 1);
    }
    // 1 = PCM, 3 = IEEE float; compressed WAVs (ADPCM, MP3-in-WAV…) can't be cut by frame
    if (dataIndex < 0 || !blockAlign || (format !== 1 && format !== 3)) return null;
    const frames = Math.floor(chunks[dataIndex].body.length / blockAlign);
    const [s, e] = clampRange(frames, start, end);
    chunks[dataIndex].body = chunks[dataIndex].body.subarray(s * blockAlign, e * blockAlign);
    // Cue points, loops and other markers refer to the old positions — keep only format and audio
    const kept = chunks.filter((c) => c.id === 'fmt ' || c.id === 'data');
    const parts = kept.flatMap((c) => {
        const head = Buffer.alloc(8);
        head.write(c.id, 0, 'ascii');
        head.writeUInt32LE(c.body.length, 4);
        return c.body.length & 1 ? [head, c.body, Buffer.alloc(1)] : [head, c.body];
    });
    const body = Buffer.concat(parts);
    const riff = Buffer.alloc(12);
    riff.write('RIFF', 0, 'ascii');
    riff.writeUInt32LE(4 + body.length, 4);
    riff.write('WAVE', 8, 'ascii');
    return Buffer.concat([riff, body]);
}

function trimAiff(data: Buffer, start: number, end: number | null): Buffer | null {
    const aifc = data.toString('ascii', 8, 12) === 'AIFC';
    let p = 12, channels = 0, bits = 0, compression = 'NONE';
    const chunks: { id: string; body: Buffer }[] = [];
    let commIndex = -1, ssndIndex = -1;
    while (p + 8 <= data.length) {
        const id = data.toString('ascii', p, p + 4);
        const len = data.readUInt32BE(p + 4);
        const body = Buffer.from(data.subarray(p + 8, Math.min(data.length, p + 8 + len)));
        if (id === 'COMM') {
            commIndex = chunks.length;
            channels = body.readUInt16BE(0);
            bits = body.readUInt16BE(6);
            if (aifc && body.length >= 22) compression = body.toString('ascii', 18, 22);
        }
        if (id === 'SSND') ssndIndex = chunks.length;
        chunks.push({ id, body });
        p += 8 + len + (len & 1);
    }
    if (commIndex < 0 || ssndIndex < 0 || !channels || !bits || !['NONE', 'sowt', 'twos'].includes(compression)) return null;
    const frameBytes = channels * Math.ceil(bits / 8);
    const ssnd = chunks[ssndIndex].body;
    const offset = ssnd.readUInt32BE(0);
    const audio = ssnd.subarray(8 + offset);
    const frames = Math.floor(audio.length / frameBytes);
    const [s, e] = clampRange(frames, start, end);
    const head = Buffer.alloc(8);                              // offset 0, block size 0
    chunks[ssndIndex].body = Buffer.concat([head, audio.subarray(s * frameBytes, e * frameBytes)]);
    chunks[commIndex].body.writeUInt32BE(e - s, 2);           // numSampleFrames
    // Markers and instrument loops point at old frame positions — drop them
    const kept = chunks.filter((c) => !['MARK', 'INST'].includes(c.id));
    const parts = kept.flatMap((c) => {
        const h = Buffer.alloc(8);
        h.write(c.id, 0, 'ascii');
        h.writeUInt32BE(c.body.length, 4);
        return c.body.length & 1 ? [h, c.body, Buffer.alloc(1)] : [h, c.body];
    });
    const body = Buffer.concat(parts);
    const form = Buffer.alloc(12);
    form.write('FORM', 0, 'ascii');
    form.writeUInt32BE(4 + body.length, 4);
    form.write(aifc ? 'AIFC' : 'AIFF', 8, 'ascii');
    return Buffer.concat([form, body]);
}
