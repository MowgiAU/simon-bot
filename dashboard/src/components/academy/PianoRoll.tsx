/**
 * PianoRoll — Simplified FL Studio-style piano roll.
 * Grid-based note drawing on a canvas with octave labels.
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { colors, borderRadius } from '../../theme/theme';

interface Note {
    pitch: number;   // MIDI note number (0-127)
    start: number;   // Step position (0-based)
    length: number;  // Duration in steps
}

interface PianoRollProps {
    notes: Note[];
    onChange: (notes: Note[]) => void;
    steps?: number;
    octaves?: number;
    startOctave?: number;
    highlightPitch?: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CELL_W = 24;
const CELL_H = 14;
const KEY_WIDTH = 48;

export const PianoRoll: React.FC<PianoRollProps> = ({
    notes, onChange, steps = 16, octaves = 3, startOctave = 3, highlightPitch,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const totalPitches = octaves * 12;
    const lowestPitch = startOctave * 12; // MIDI note number of bottom
    const width = KEY_WIDTH + steps * CELL_W;
    const height = totalPitches * CELL_H;

    // Pitch index 0 = top of canvas = highest pitch
    const pitchToY = (pitch: number) => (lowestPitch + totalPitches - 1 - pitch) * CELL_H;
    const yToPitch = (y: number) => lowestPitch + totalPitches - 1 - Math.floor(y / CELL_H);
    const xToStep = (x: number) => Math.floor((x - KEY_WIDTH) / CELL_W);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);

        // Grid + key labels
        for (let p = 0; p < totalPitches; p++) {
            const pitch = lowestPitch + totalPitches - 1 - p;
            const y = p * CELL_H;
            const noteIdx = pitch % 12;
            const isBlack = [1, 3, 6, 8, 10].includes(noteIdx);
            const isHighlighted = pitch === highlightPitch;

            // Key background
            ctx.fillStyle = isHighlighted ? 'rgba(16,185,129,0.15)' : isBlack ? '#1a1d1f' : '#252729';
            ctx.fillRect(0, y, KEY_WIDTH, CELL_H);

            // Key label
            if (noteIdx === 0) {
                ctx.fillStyle = colors.textSecondary;
                ctx.font = '9px Inter, sans-serif';
                ctx.fillText(`C${Math.floor(pitch / 12)}`, 4, y + CELL_H - 3);
            }

            // Grid cells
            for (let s = 0; s < steps; s++) {
                const x = KEY_WIDTH + s * CELL_W;
                ctx.fillStyle = isBlack ? '#1a1d1f' : (s % 4 === 0 ? '#222528' : '#1e2123');
                ctx.fillRect(x, y, CELL_W - 1, CELL_H - 1);
            }
        }

        // Beat lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        for (let s = 0; s <= steps; s++) {
            if (s % 4 !== 0) continue;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(KEY_WIDTH + s * CELL_W, 0);
            ctx.lineTo(KEY_WIDTH + s * CELL_W, height);
            ctx.stroke();
        }

        // Notes
        for (const note of notes) {
            const y = pitchToY(note.pitch);
            const x = KEY_WIDTH + note.start * CELL_W;
            const w = note.length * CELL_W - 2;
            ctx.fillStyle = colors.primary;
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, w, CELL_H - 2, 2);
            ctx.fill();

            // Note label
            const nn = NOTE_NAMES[note.pitch % 12];
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px Inter, sans-serif';
            ctx.fillText(nn, x + 3, y + CELL_H - 4);
        }
    }, [notes, width, height, totalPitches, lowestPitch, steps, highlightPitch]);

    useEffect(() => { draw(); }, [draw]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x < KEY_WIDTH) return;

        const pitch = yToPitch(y);
        const step = xToStep(x);
        if (step < 0 || step >= steps || pitch < lowestPitch || pitch >= lowestPitch + totalPitches) return;

        // Toggle: if note exists at this position, remove it; otherwise add
        const existing = notes.findIndex(n => n.pitch === pitch && step >= n.start && step < n.start + n.length);
        if (existing >= 0) {
            onChange(notes.filter((_, i) => i !== existing));
        } else {
            onChange([...notes, { pitch, start: step, length: 1 }]);
        }
        setIsDrawing(true);
    };

    return (
        <div style={{
            background: '#1a1d1f',
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            overflow: 'auto',
            maxHeight: 300,
        }}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                onMouseDown={handleMouseDown}
                onMouseUp={() => setIsDrawing(false)}
                style={{ cursor: 'crosshair', display: 'block' }}
            />
        </div>
    );
};
