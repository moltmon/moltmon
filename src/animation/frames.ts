// Re-export ANSI codes and colors from creatureLoader
export {
  CLEAR_SCREEN,
  MOVE_HOME,
  HIDE_CURSOR,
  SHOW_CURSOR,
  RESET,
  WHITE,
  YELLOW,
  CYAN,
  MAGENTA,
  GREEN,
  PINK,
  BLACK,
  RED,
  DIM,
  BROWN,
  moveCursor,
} from './creatureLoader.js';

import {
  loadDefaultCreature,
  loadCreatureById as loadCreatureByIdFromLoader,
  type ParsedCreature,
} from './creatureLoader.js';

// Load the default creature
let creature: ParsedCreature;
try {
  creature = loadDefaultCreature();
} catch (e) {
  console.error('Failed to load creature:', e);
  process.exit(1);
}

// Function to switch creature by ID
export function switchCreature(id: string): void {
  try {
    creature = loadCreatureByIdFromLoader(id);
  } catch (e) {
    console.error(`Failed to load creature ${id}:`, e);
  }
}

// Re-export loadCreatureById for direct use
export { loadCreatureByIdFromLoader as loadCreatureById };

// Getter functions to access current creature data dynamically
export function getFrameHeight(): number {
  return creature.frameHeight;
}

export function getEggFrames(): string[][] {
  return creature.sequences.egg;
}

export function getHatchFrames(): string[][] {
  return creature.sequences.hatch;
}

export function getIdleSequence(): string[][] {
  return creature.sequences.idle;
}

export function getSickSequence(): string[][] {
  return creature.sequences.sick;
}

export function getDeadFrame(): string[] {
  return creature.deadFrame;
}

export function getPoopArt(): string[] {
  return creature.poop.art;
}

export function getPoopPositions(): [number, number][] {
  return creature.poop.positions;
}

export function getCreatureSounds(): { idle: string; hungry: string; sick: string } {
  return creature.sounds;
}

export function getCurrentCreature(): ParsedCreature {
  return creature;
}

// Export static references for backwards compatibility (these won't update after switchCreature)
export const FRAME_HEIGHT = creature.frameHeight;

// Export individual frames for backwards compatibility
export const EGG_NORMAL = creature.frames['egg_normal'];
export const EGG_TALL = creature.frames['egg_tall'];
export const EGG_SHORT = creature.frames['egg_short'];

export const HATCH_1 = creature.frames['hatch_1'];
export const HATCH_2 = creature.frames['hatch_2'];
export const HATCH_3 = creature.frames['hatch_3'];
export const HATCH_4 = creature.frames['hatch_4'];
export const HATCH_5 = creature.frames['hatch_5'];

export const CAT_CENTER = creature.frames['idle_center'];
export const CAT_LEFT = creature.frames['idle_left'];
export const CAT_LEFT_UP = creature.frames['idle_left_up'];
export const CAT_RIGHT = creature.frames['idle_right'];
export const CAT_RIGHT_UP = creature.frames['idle_right_up'];

export const CAT_SICK_1 = creature.frames['sick_1'];
export const CAT_SICK_2 = creature.frames['sick_2'];

export const CAT_DEAD = creature.deadFrame;

// Export poop art and positions
export const POOP_ART = creature.poop.art;
export const POOP_POSITIONS = creature.poop.positions;

// Export frame sequences
export const EGG_FRAMES = creature.sequences.egg;
export const HATCH_FRAMES = creature.sequences.hatch;
export const CAT_HOP_SEQUENCE = creature.sequences.idle;
export const CAT_SICK_SEQUENCE = creature.sequences.sick;

// Export the loaded creature for direct access
export const currentCreature = creature;

// Export sounds
export const CREATURE_SOUNDS = creature.sounds;
