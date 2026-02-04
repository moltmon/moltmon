import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  PetStateData,
  CommandQueue,
  HistoryData,
  PetSummary,
  PetState,
  PetStats,
} from './types.js';
import { getConfig, randomBetween } from './config.js';

// Use a fixed location in project directory
// Versioned subdirectory allows clean migration on breaking changes (v0 -> v1, etc.)
const DATA_DIR = process.env.MOLTMON_DATA_DIR || join(process.cwd(), '.moltmon', 'v0');
const STATE_FILE = join(DATA_DIR, 'state.json');
const COMMANDS_FILE = join(DATA_DIR, 'commands.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// State file operations
export async function writeState(state: PetStateData): Promise<void> {
  await ensureDataDir();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function readState(): Promise<PetStateData | null> {
  try {
    const content = await readFile(STATE_FILE, 'utf-8');
    return JSON.parse(content) as PetStateData;
  } catch {
    return null;
  }
}

// Command file operations
export async function writeCommand(
  command: CommandQueue['pendingCommands'][0]
): Promise<void> {
  await ensureDataDir();
  const queue = await readCommands();
  queue.pendingCommands.push(command);
  await writeFile(COMMANDS_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

export async function readCommands(): Promise<CommandQueue> {
  try {
    const content = await readFile(COMMANDS_FILE, 'utf-8');
    return JSON.parse(content) as CommandQueue;
  } catch {
    return { pendingCommands: [] };
  }
}

export async function clearCommands(): Promise<void> {
  await ensureDataDir();
  await writeFile(
    COMMANDS_FILE,
    JSON.stringify({ pendingCommands: [] }, null, 2),
    'utf-8'
  );
}

// History file operations
export async function readHistory(): Promise<HistoryData> {
  try {
    const content = await readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(content) as HistoryData;
  } catch {
    return { pets: [], currentPetId: 0 };
  }
}

export async function writeHistory(history: HistoryData): Promise<void> {
  await ensureDataDir();
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

export async function addPetToHistory(summary: PetSummary): Promise<void> {
  const history = await readHistory();
  // Check if pet already exists, update if so
  const existingIndex = history.pets.findIndex(p => p.petId === summary.petId);
  if (existingIndex >= 0) {
    history.pets[existingIndex] = summary;
  } else {
    history.pets.push(summary);
  }
  history.currentPetId = summary.petId;
  await writeHistory(history);
}

export async function updateCurrentPetInHistory(
  stats: PetStats,
  petId: number
): Promise<void> {
  const history = await readHistory();
  const existingIndex = history.pets.findIndex(p => p.petId === petId);

  const summary: PetSummary = {
    petId,
    bornAt: stats.bornAt,
    diedAt: stats.diedAt,
    survivalTimeMs: stats.diedAt
      ? stats.diedAt - stats.bornAt
      : Date.now() - stats.bornAt,
    stats,
    isAlive: stats.diedAt === null,
  };

  if (existingIndex >= 0) {
    history.pets[existingIndex] = summary;
  } else {
    history.pets.push(summary);
  }
  history.currentPetId = petId;
  await writeHistory(history);
}

// Create fresh pet stats
function createFreshStats(): PetStats {
  return {
    timesFed: 0,
    timesSick: 0,
    timesPooped: 0,
    timesCleaned: 0,
    bornAt: Date.now(),
    diedAt: null,
    causeOfDeath: null,
    personality: null,
  };
}

// Create fresh pet state
export function createFreshState(petId: number): PetStateData {
  const now = Date.now();
  return {
    state: PetState.EGG,
    lastEvent: null,
    lastEventTime: now,
    hungerTimerStart: null,
    lastFedTime: null,
    createdAt: now,
    poopCount: 0,
    nextPoopTime: null,
    sicknessStartTime: null,
    poopSicknessDeadline: null,
    hungryStartTime: null,
    petId,
    stats: createFreshStats(),
    creatureId: null,
  };
}

// Migrate old state format to new format
function migrateState(oldState: Partial<PetStateData>): PetStateData {
  const now = Date.now();

  // Use createdAt as bornAt if available, otherwise use now
  const bornAt = oldState.createdAt || now;

  return {
    // Existing fields (with defaults)
    state: oldState.state || PetState.EGG,
    lastEvent: oldState.lastEvent || null,
    lastEventTime: oldState.lastEventTime || now,
    hungerTimerStart: oldState.hungerTimerStart || null,
    lastFedTime: oldState.lastFedTime || null,
    createdAt: oldState.createdAt || now,

    // New poop fields
    poopCount: oldState.poopCount ?? 0,
    nextPoopTime: oldState.nextPoopTime ?? null,

    // New sickness fields
    sicknessStartTime: oldState.sicknessStartTime ?? null,
    poopSicknessDeadline: oldState.poopSicknessDeadline ?? null,

    // Hunger fields
    hungryStartTime: oldState.hungryStartTime ?? null,

    // New identity and stats (migrate with petId 1 for old pets)
    petId: oldState.petId ?? 1,
    stats: oldState.stats ?? {
      timesFed: 0,
      timesSick: 0,
      timesPooped: 0,
      timesCleaned: 0,
      bornAt,
      diedAt: null,
      causeOfDeath: null,
      personality: null,
    },

    // Creature identity
    creatureId: oldState.creatureId ?? null,
  };
}

// Restore existing state or create new one
export async function restoreOrCreateState(): Promise<{
  state: PetStateData;
  isRestored: boolean;
}> {
  const existingState = await readState();

  if (existingState && existingState.state !== PetState.DEAD) {
    // Check if state needs migration (old format missing new fields)
    if (existingState.petId === undefined || existingState.stats === undefined) {
      const migratedState = migrateState(existingState);
      await writeState(migratedState);

      // Also add to history if not already there
      await addPetToHistory({
        petId: migratedState.petId,
        bornAt: migratedState.stats.bornAt,
        diedAt: null,
        survivalTimeMs: Date.now() - migratedState.stats.bornAt,
        stats: migratedState.stats,
        isAlive: true,
      });

      return { state: migratedState, isRestored: true };
    }

    // Restore the existing pet
    return { state: existingState, isRestored: true };
  }

  // Create a new pet
  const history = await readHistory();
  const newPetId = history.currentPetId + 1;
  const freshState = createFreshState(newPetId);

  // Add to history
  await addPetToHistory({
    petId: newPetId,
    bornAt: freshState.stats.bornAt,
    diedAt: null,
    survivalTimeMs: 0,
    stats: freshState.stats,
    isAlive: true,
  });

  await writeState(freshState);
  return { state: freshState, isRestored: false };
}

// Helper to calculate next poop time
export function calculateNextPoopTime(): number {
  const config = getConfig();
  return Date.now() + randomBetween(config.poopMinDelayMs, config.poopMaxDelayMs);
}

// Helper to calculate sickness deadline based on poop count
export function calculateSicknessDeadline(poopCount: number): number {
  const config = getConfig();
  const thresholdKey = Math.min(poopCount, 3) as 1 | 2 | 3;
  const threshold = config.sicknessThresholds[thresholdKey];
  return Date.now() + threshold;
}
