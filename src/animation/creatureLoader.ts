import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ANSI escape codes
export const CLEAR_SCREEN = '\x1b[2J';
export const MOVE_HOME = '\x1b[H';
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';

// Color map for resolving tokens
const COLOR_MAP: Record<string, string> = {
  reset: '\x1b[0m',
  white: '\x1b[97m',
  yellow: '\x1b[93m',
  cyan: '\x1b[96m',
  magenta: '\x1b[95m',
  pink: '\x1b[95m',
  green: '\x1b[92m',
  black: '\x1b[30m',
  red: '\x1b[91m',
  dim: '\x1b[2m',
  brown: '\x1b[38;5;94m',
};

// Creature JSON structure
export interface CreatureData {
  id: string;
  name: string;
  version: string;
  frameHeight: number;
  colors: {
    primary: string;
    accent: string;
    sick: string;
    dead: string;
  };
  frames: Record<string, string[]>;
  sequences: Record<string, { frames: string[]; frameMs: number }>;
  assets: {
    poop: {
      art: string[];
      positions: [number, number][];
    };
  };
  sounds: {
    idle: string;
    hungry: string;
    sick: string;
  };
}

// Parsed creature with resolved ANSI codes
export interface ParsedCreature {
  id: string;
  name: string;
  frameHeight: number;
  frames: Record<string, string[]>;
  sequences: {
    egg: string[][];
    hatch: string[][];
    idle: string[][];
    sick: string[][];
  };
  deadFrame: string[];
  poop: {
    art: string[];
    positions: [number, number][];
  };
  sounds: {
    idle: string;
    hungry: string;
    sick: string;
  };
  timing: {
    egg: number;
    hatch: number;
    idle: number;
    sick: number;
  };
}

// Resolve color tokens in a string
function resolveColors(str: string): string {
  return str.replace(/\{(\w+)\}/g, (_, colorName) => {
    return COLOR_MAP[colorName] || '';
  });
}

// Resolve all color tokens in a frame
function resolveFrame(frame: string[]): string[] {
  return frame.map(resolveColors);
}

// Load and parse a creature JSON file
export function loadCreature(jsonPath: string): ParsedCreature {
  const content = readFileSync(jsonPath, 'utf-8');
  const data: CreatureData = JSON.parse(content);

  // Resolve all frames
  const resolvedFrames: Record<string, string[]> = {};
  for (const [name, frame] of Object.entries(data.frames)) {
    resolvedFrames[name] = resolveFrame(frame);
  }

  // Build sequences from resolved frames
  const buildSequence = (seqName: string): string[][] => {
    const seq = data.sequences[seqName];
    if (!seq) return [];
    return seq.frames.map(frameName => resolvedFrames[frameName]);
  };

  return {
    id: data.id,
    name: data.name,
    frameHeight: data.frameHeight,
    frames: resolvedFrames,
    sequences: {
      egg: buildSequence('egg'),
      hatch: buildSequence('hatch'),
      idle: buildSequence('idle'),
      sick: buildSequence('sick'),
    },
    deadFrame: resolvedFrames['dead'],
    poop: {
      art: resolveFrame(data.assets.poop.art),
      positions: data.assets.poop.positions,
    },
    sounds: data.sounds,
    timing: {
      egg: data.sequences.egg?.frameMs || 300,
      hatch: data.sequences.hatch?.frameMs || 400,
      idle: data.sequences.idle?.frameMs || 250,
      sick: data.sequences.sick?.frameMs || 250,
    },
  };
}

// Get path to creatures directory
function getCreaturesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '..', 'creatures');
}

// List all available creatures
export function listCreatures(): string[] {
  const dir = getCreaturesDir();
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .sort();
}

// Load creature by ID (e.g., "001_blue_cat")
export function loadCreatureById(id: string): ParsedCreature {
  const dir = getCreaturesDir();
  return loadCreature(join(dir, `${id}.json`));
}

// Load the default creature (first one alphabetically)
export function loadDefaultCreature(): ParsedCreature {
  const creatures = listCreatures();
  if (creatures.length === 0) {
    throw new Error('No creatures found in creatures directory');
  }
  return loadCreatureById(creatures[0]);
}

// Cursor movement helper
export const moveCursor = (row: number, col: number): string => `\x1b[${row};${col}H`;

// Export color constants for renderer.ts compatibility
export const RESET = COLOR_MAP.reset;
export const WHITE = COLOR_MAP.white;
export const YELLOW = COLOR_MAP.yellow;
export const CYAN = COLOR_MAP.cyan;
export const MAGENTA = COLOR_MAP.magenta;
export const GREEN = COLOR_MAP.green;
export const PINK = COLOR_MAP.pink;
export const BLACK = COLOR_MAP.black;
export const RED = COLOR_MAP.red;
export const DIM = COLOR_MAP.dim;
export const BROWN = COLOR_MAP.brown;
