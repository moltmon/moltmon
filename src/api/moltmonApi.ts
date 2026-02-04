import {
  PetState,
  PetStateData,
  HistoryData,
  PetSummary,
  CommandType,
} from '../shared/types.js';
import {
  readState,
  writeCommand,
  readHistory,
} from '../shared/state.js';

export interface MoltmonApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class MoltmonApi {
  // External Actions (write commands)

  async feed(): Promise<MoltmonApiResult> {
    const state = await readState();

    if (!state) {
      return { success: false, error: 'Pet not found. Animation may not be running.' };
    }

    if (state.state === PetState.SICK) {
      return {
        success: false,
        error: 'Cannot feed a sick pet. You must heal it first.',
      };
    }

    if (state.state !== PetState.HUNGRY) {
      return {
        success: false,
        error: `Pet is not hungry. Current state: ${state.state}`,
      };
    }

    await writeCommand({ type: 'FEED', timestamp: Date.now() });
    return { success: true, data: { message: 'Feed command sent! Your Moltmon will be happy.' } };
  }

  async clean(): Promise<MoltmonApiResult> {
    const state = await readState();

    if (!state) {
      return { success: false, error: 'Pet not found. Animation may not be running.' };
    }

    if (state.poopCount === 0) {
      return {
        success: false,
        error: 'Nothing to clean. There is no poop.',
      };
    }

    await writeCommand({ type: 'CLEAN', timestamp: Date.now() });
    return { success: true, data: { message: 'Clean command sent! Your Moltmon appreciates a tidy home.' } };
  }

  async heal(): Promise<MoltmonApiResult> {
    const state = await readState();

    if (!state) {
      return { success: false, error: 'Pet not found. Animation may not be running.' };
    }

    if (state.state !== PetState.SICK) {
      return {
        success: false,
        error: `Pet is not sick. Current state: ${state.state}`,
      };
    }

    await writeCommand({ type: 'HEAL', timestamp: Date.now() });
    return { success: true, data: { message: 'Heal command sent! Your Moltmon will recover soon.' } };
  }

  async hatch(personality: string): Promise<MoltmonApiResult> {
    const state = await readState();

    if (!state) {
      return { success: false, error: 'Pet not found. Animation may not be running.' };
    }

    if (state.state !== PetState.EGG) {
      return {
        success: false,
        error: `Pet is not an egg. Current state: ${state.state}`,
      };
    }

    const creatureId = this.determineCreature(personality);

    await writeCommand({
      type: 'HATCH',
      timestamp: Date.now(),
      creatureId,
      personality,
    });

    return {
      success: true,
      data: {
        message: `Hatch command sent! A ${creatureId.includes('cat') ? 'cat' : 'dog'} is hatching!`,
        creatureId,
        personality,
      },
    };
  }

  private determineCreature(personality: string): string {
    const roll = Math.random();
    const normalized = personality.toLowerCase().trim();

    if (normalized === 'brave') {
      return roll < 0.8 ? '002_pink_dog' : '001_blue_cat';
    } else if (normalized === 'curious') {
      return roll < 0.8 ? '001_blue_cat' : '002_pink_dog';
    } else {
      return roll < 0.5 ? '001_blue_cat' : '002_pink_dog';
    }
  }

  // System Queries (read-only)

  async getState(): Promise<MoltmonApiResult<PetStateData>> {
    const state = await readState();

    if (!state) {
      return { success: false, error: 'Pet not found. Animation may not be running.' };
    }

    return { success: true, data: state };
  }

  async getHistory(): Promise<MoltmonApiResult<HistoryData>> {
    const history = await readHistory();
    return { success: true, data: history };
  }

  async getCurrentPetSummary(): Promise<MoltmonApiResult<PetSummary>> {
    const state = await readState();

    if (!state) {
      return { success: false, error: 'Pet not found. Animation may not be running.' };
    }

    const summary: PetSummary = {
      petId: state.petId,
      bornAt: state.stats.bornAt,
      diedAt: state.stats.diedAt,
      survivalTimeMs: state.stats.diedAt
        ? state.stats.diedAt - state.stats.bornAt
        : Date.now() - state.stats.bornAt,
      stats: state.stats,
      isAlive: state.state !== PetState.DEAD,
    };

    return { success: true, data: summary };
  }

  // Helper to get formatted state info (for MCP responses)
  async getFormattedState(): Promise<MoltmonApiResult<{
    state: PetState;
    lastEvent: string | null;
    timeSinceLastEventMs: number;
    isHungry: boolean;
    isSick: boolean;
    isDead: boolean;
    poopCount: number;
    needsFeeding: boolean;
    needsCleaning: boolean;
    needsHealing: boolean;
    petId: number;
    stats: PetStateData['stats'];
  }>> {
    const state = await readState();

    if (!state) {
      return { success: false, error: 'Pet not found. Animation may not be running.' };
    }

    const timeSinceLastEvent = Date.now() - state.lastEventTime;

    return {
      success: true,
      data: {
        state: state.state,
        lastEvent: state.lastEvent,
        timeSinceLastEventMs: timeSinceLastEvent,
        isHungry: state.state === PetState.HUNGRY,
        isSick: state.state === PetState.SICK,
        isDead: state.state === PetState.DEAD,
        poopCount: state.poopCount,
        needsFeeding: state.state === PetState.HUNGRY,
        needsCleaning: state.poopCount > 0,
        needsHealing: state.state === PetState.SICK,
        petId: state.petId,
        stats: state.stats,
      },
    };
  }
}
