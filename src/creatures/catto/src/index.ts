#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ASSETS_DIR = join(__dirname, '..');

// ANSI codes
const CLEAR_SCREEN = '\x1b[2J';
const MOVE_HOME = '\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

type State = 'left' | 'right' | 'sick' | 'dead';

interface Frames {
  left: string[];
  right: string[];
  sick: string[];
  dead: string;
}

function loadFrames(): Frames {
  const load = (name: string) => readFileSync(join(ASSETS_DIR, `${name}.txt`), 'utf-8');
  return {
    left: [load('left_1'), load('left_2')],
    right: [load('right_1'), load('right_2')],
    sick: [load('sick_1'), load('sick_2')],
    dead: load('dead'),
  };
}

function clear(): void {
  process.stdout.write(CLEAR_SCREEN + MOVE_HOME);
}

function hideCursor(): void {
  process.stdout.write(HIDE_CURSOR);
}

function showCursor(): void {
  process.stdout.write(SHOW_CURSOR);
}

function drawFrame(frame: string): void {
  clear();
  process.stdout.write('\n'.repeat(3));
  process.stdout.write(frame);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function animate(frames: Frames, state: State, delayMs: number): Promise<void> {
  if (state === 'dead') {
    drawFrame(frames.dead);
    await new Promise(() => {}); // Wait forever
    return;
  }

  const sequence = frames[state];
  let idx = 0;

  while (true) {
    drawFrame(sequence[idx % sequence.length]);
    idx++;
    await sleep(delayMs);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const state = (args[0] || 'right') as State;
  const delay = parseInt(args[1] || '300', 10);

  const frames = loadFrames();

  const cleanup = () => {
    showCursor();
    clear();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  hideCursor();
  clear();

  await animate(frames, state, delay);
}

main().catch(err => {
  showCursor();
  console.error(err);
  process.exit(1);
});
