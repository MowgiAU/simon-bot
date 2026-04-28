/**
 * PianoRoll — FL Studio 21 piano roll.
 * Slate blue-gray grid, green note blocks, muted palette.
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';

interface Note {
    pitch: number;
    start: number;
    length: number;
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
const BLACK_KEYS = [1, 3, 6, 8, 10];
const CELL_W = 24;
const CELL_H = 14;
const KEY_WIDTH = 44;

// FL21 palette
const GRID_WHITE  = '#353D4A';
const GRID_BLACK  = '#303848';
const GRID_BEAT_W = '#3A4250';
const GRID_BEAT_B = '#343C4A';
const KEY_WHITE   = '#4A5268';
const KEY_BLACK   = '#2E3440';
const NOTE_COLOR  = '#8ABF60';
const NOTE_LABEL  = '#2A3A20';
const BEAT_LINE   = '#4A5268';

export const PianoRoll: React.FC<PianoRollProps> = ({
    notes, onChange, steps = 16, octaves = 3, startOctave = 3, highlightPitch,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const totalPitches = octaves * 12;
    const lowestPitch = startOctave * 12;
    const width = KEY_WIDTH + steps * CELL_W;
    const height = totalPitches * CELL_H;

    const pitchToY = (pitch: number) => (lowestPitch + totalPitches - 1 - pitch) * CELL_H;
    const yToPitch = (y: number) => lowestPitch + totalPitches - 1 - Math.floor(y / CELL_H);
    const xToStep = (x: number) => Math.floor((x - KEY_WIDTH) / CELL_W);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        for (let p = 0; p < totalPitches; p++) {
            const pitch = lowestPitch + totalPitches - 1 - p;
            const y = p * CELL_H;
            const noteIdx = pitch % 12;
            const isBlack = BLACK_KEYS.includes(noteIdx);
            const isHighlighted = pitch === highlightPitch;
            const isC = noteIdx === 0;

            // Piano key
            ctx.fillStyle = isHighlighted ? '#3A5040' : isBlack ? KEY_BLACK : KEY_WHITE;
            ctx.fillRect(0, y, KEY_WIDTH, CELL_H);
            ctx.strokeStyle = '#2A3040';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(0, y, KEY_WIDTH, CELL_H);

            // Key label
            if (isC) {
                ctx.fillStyle = '#8090A0';
                ctx.font = '9px Segoe UI, Tahoma, sans-serif';
                ctx.fillText(`C${Math.floor(pitch / 12)}`, 3, y + CELL_H - 3);
            }

            // Grid cells
            for (let s = 0; s < steps; s++) {
                const x = KEY_WIDTH + s * CELL_W;
                const isBeatStart = s % 4 === 0;
                ctx.fillStyle = isBlack
                    ? (isBeatStart ? GRID_BEAT_B : GRID_BLACK)
                    : (isBeatStart ? GRID_BEAT_W : GRID_WHITE);
                ctx.fillRect(x, y, CELL_W - 1, CELL_H - 1);
            }
        }

        // Beat lines
        ctx.strokeStyle = BEAT_LINE;
        ctx.lineWidth = 1;
        for (let s = 0; s <= steps; s++) {
            if (s % 4 !== 0) continue;
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

            ctx.fillStyle = NOTE_COLOR;
            ctx.beginPath();
            ctx.roundRect(x + 1, y + 1, w, CELL_H - 2, 2);
            ctx.fill();

            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(x + 1, y + 1, w, 2);

            // Note label
            const nn = NOTE_NAMES[note.pitch % 12];
            ctx.fillStyle = NOTE_LABEL;
            ctx.font = 'bold 8px Segoe UI, Tahoma, sans-serif';
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

        const existing = notes.findIndex(n => n.pitch === pitch && step >= n.start && step < n.start + n.length);
        if (existing >= 0) {
            onChange(notes.filter((_, i) => i !== existing));
        } else {
            onChange([...notes, { pitch, start: step, length: 1 }]);
        }
    };

    return (
        <div style={{
            background: '#3A4050',
            overflow: 'hidden',
        }}>
            {/* Title bar */}
            <div style={{
                height: 26,
                background: '#333A48',
                borderBottom: '1px solid #4A5060',
                display: 'flex', alignItems: 'center',
                padding: '0 10px',
            }}>
                <span style={{ fontSize: '11px', color: '#B0B8C8', fontWeight: 500 }}>Piano roll</span>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 300 }}>
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseDown={handleMouseDown}
                    style={{ cursor: 'crosshair', display: 'block' }}
                />
            </div>
        </div>
    );
};
