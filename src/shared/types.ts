// Pet states
export enum PetState {
  EGG = 'EGG',
  HATCHING = 'HATCHING',
  IDLE = 'IDLE',
  HUNGRY = 'HUNGRY',
  SICK = 'SICK',
  DEAD = 'DEAD',
}

// Events emitted by the state machine
export enum PetEvent {
  HATCHED = 'HATCHED',
  BECAME_HUNGRY = 'BECAME_HUNGRY',
  FED = 'FED',
  POOPED = 'POOPED',
  CLEANED = 'CLEANED',
  BECAME_SICK = 'BECAME_SICK',
  HEALED = 'HEALED',
  DIED = 'DIED',
  REBORN = 'REBORN',
}

// Command types
export type CommandType = 'FEED' | 'CLEAN' | 'HEAL' | 'HATCH';

// Cause of death
export type CauseOfDeath = 'STARVATION' | 'UNTREATED_SICKNESS' | null;

// Pet statistics
export interface PetStats {
  timesFed: number;
  timesSick: number;
  timesPooped: number;
  timesCleaned: number;
  bornAt: number;
  diedAt: number | null;
  causeOfDeath: CauseOfDeath;
  personality: string | null;
}

// State persisted to file and exposed via MCP
export interface PetStateData {
  // Existing fields
  state: PetState;
  lastEvent: PetEvent | null;
  lastEventTime: number;
  hungerTimerStart: number | null;
  lastFedTime: number | null;
  createdAt: number;

  // Poop fields
  poopCount: number;
  nextPoopTime: number | null;

  // Sickness fields
  sicknessStartTime: number | null;
  poopSicknessDeadline: number | null;

  // Hunger fields
  hungryStartTime: number | null;

  // Pet identity and stats
  petId: number;
  stats: PetStats;

  // Creature identity
  creatureId: string | null;
}

// Summary of a pet (alive or dead)
export interface PetSummary {
  petId: number;
  bornAt: number;
  diedAt: number | null;
  survivalTimeMs: number;
  stats: PetStats;
  isAlive: boolean;
}

// History of all pets
export interface HistoryData {
  pets: PetSummary[];
  currentPetId: number;
}

// Commands written by MCP server, read by animation
export interface Command {
  type: CommandType;
  timestamp: number;
  creatureId?: string;
  personality?: string;
}

export interface CommandQueue {
  pendingCommands: Command[];
}
