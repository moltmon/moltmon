import {
  PetState,
  PetEvent,
  PetStateData,
  CauseOfDeath,
  PetSummary,
} from '../shared/types.js';
import {
  writeState,
  readCommands,
  clearCommands,
  updateCurrentPetInHistory,
  addPetToHistory,
  createFreshState,
  calculateNextPoopTime,
  calculateSicknessDeadline,
} from '../shared/state.js';
import { getConfig } from '../shared/config.js';

export class PetStateMachine {
  private state: PetStateData;
  private listeners: Array<(event: PetEvent) => void> = [];
  private deathListeners: Array<(summary: PetSummary) => void> = [];
  private rebirthScheduled = false;

  constructor(existingState?: PetStateData) {
    if (existingState) {
      this.state = existingState;
    } else {
      // Create a fresh state with petId 1
      this.state = createFreshState(1);
    }
  }

  // Called every animation frame
  async tick(): Promise<void> {
    // Check for incoming commands (feed, clean, heal)
    await this.processCommands();

    const now = Date.now();
    const config = getConfig();

    // Skip all timers if dead or in egg/hatching states
    if (
      this.state.state === PetState.DEAD ||
      this.state.state === PetState.EGG ||
      this.state.state === PetState.HATCHING
    ) {
      await writeState(this.state);
      return;
    }

    // 1. Check poop timer (only in IDLE state)
    if (
      this.state.state === PetState.IDLE &&
      this.state.nextPoopTime !== null &&
      now >= this.state.nextPoopTime
    ) {
      this.poop();
    }

    // 2. Check poop -> sickness deadline (only if IDLE or HUNGRY)
    if (
      this.state.poopCount > 0 &&
      this.state.poopSicknessDeadline !== null &&
      now >= this.state.poopSicknessDeadline &&
      (this.state.state === PetState.IDLE || this.state.state === PetState.HUNGRY)
    ) {
      this.becomeSick();
    }

    // 3. Check sickness -> death (untreated sickness)
    if (
      this.state.state === PetState.SICK &&
      this.state.sicknessStartTime !== null
    ) {
      if (now - this.state.sicknessStartTime >= config.deathAfterSickMs) {
        this.die('UNTREATED_SICKNESS');
      }
    }

    // 4. Check hunger timer -> hungry (only in IDLE)
    if (
      this.state.state === PetState.IDLE &&
      this.state.hungerTimerStart !== null
    ) {
      const elapsed = now - this.state.hungerTimerStart;
      if (elapsed >= config.hungerIntervalMs) {
        this.becomeHungry();
      }
    }

    // 5. Check starvation -> death (1 hour hungry)
    if (
      this.state.state === PetState.HUNGRY &&
      this.state.hungryStartTime !== null
    ) {
      if (now - this.state.hungryStartTime >= config.starvationDeathMs) {
        this.die('STARVATION');
      }
    }

    // Persist state for MCP server
    await writeState(this.state);
  }

  hatch(creatureId: string, personality: string): void {
    if (this.state.state === PetState.EGG) {
      this.state.creatureId = creatureId;
      this.state.stats.personality = personality;
      this.transition(PetState.HATCHING, null);
    }
  }

  completeHatching(): void {
    if (this.state.state === PetState.HATCHING) {
      this.transition(PetState.IDLE, PetEvent.HATCHED);
      this.startHungerTimer();
      this.scheduleNextPoop();
    }
  }

  feed(): void {
    if (this.state.state === PetState.HUNGRY) {
      this.transition(PetState.IDLE, PetEvent.FED);
      this.state.lastFedTime = Date.now();
      this.state.hungryStartTime = null;
      this.state.stats.timesFed++;
      this.startHungerTimer();
      this.scheduleNextPoop();
    }
  }

  clean(): void {
    if (this.state.poopCount > 0) {
      this.state.poopCount = 0;
      this.state.poopSicknessDeadline = null;
      this.state.stats.timesCleaned++;
      this.state.lastEvent = PetEvent.CLEANED;
      this.state.lastEventTime = Date.now();
      this.emit(PetEvent.CLEANED);
    }
  }

  heal(): void {
    if (this.state.state === PetState.SICK) {
      this.transition(PetState.IDLE, PetEvent.HEALED);
      this.state.sicknessStartTime = null;
      this.startHungerTimer();
      this.scheduleNextPoop();
    }
  }

  private poop(): void {
    this.state.poopCount++;
    this.state.stats.timesPooped++;

    // Calculate new sickness deadline
    const newDeadline = calculateSicknessDeadline(this.state.poopCount);

    // Take the lower of current deadline vs new deadline
    if (
      this.state.poopSicknessDeadline === null ||
      newDeadline < this.state.poopSicknessDeadline
    ) {
      this.state.poopSicknessDeadline = newDeadline;
    }

    // Schedule next poop
    this.scheduleNextPoop();

    this.state.lastEvent = PetEvent.POOPED;
    this.state.lastEventTime = Date.now();
    this.emit(PetEvent.POOPED);
  }

  private becomeSick(): void {
    this.transition(PetState.SICK, PetEvent.BECAME_SICK);
    this.state.sicknessStartTime = Date.now();
    this.state.stats.timesSick++;
    // Stop poop timer when sick
    this.state.nextPoopTime = null;
    // Stop hunger timer when sick
    this.state.hungerTimerStart = null;
  }

  private becomeHungry(): void {
    this.transition(PetState.HUNGRY, PetEvent.BECAME_HUNGRY);
    this.state.hungryStartTime = Date.now();
    // Stop poop timer when hungry
    this.state.nextPoopTime = null;
  }

  private die(cause: CauseOfDeath): void {
    this.state.state = PetState.DEAD;
    this.state.lastEvent = PetEvent.DIED;
    this.state.lastEventTime = Date.now();
    this.state.stats.diedAt = Date.now();
    this.state.stats.causeOfDeath = cause;

    // Clear all timers
    this.state.hungerTimerStart = null;
    this.state.hungryStartTime = null;
    this.state.nextPoopTime = null;
    this.state.sicknessStartTime = null;
    this.state.poopSicknessDeadline = null;

    // Create summary and notify listeners
    const summary = this.createSummary();

    // Update history
    updateCurrentPetInHistory(this.state.stats, this.state.petId);

    this.emit(PetEvent.DIED);
    this.emitDeath(summary);
  }

  async rebirth(): Promise<void> {
    if (this.rebirthScheduled) return;
    this.rebirthScheduled = true;

    const config = getConfig();
    await new Promise(resolve => setTimeout(resolve, config.rebirthDelayMs));

    // Create new pet
    const newPetId = this.state.petId + 1;
    this.state = createFreshState(newPetId);

    // Add to history
    await addPetToHistory({
      petId: newPetId,
      bornAt: this.state.stats.bornAt,
      diedAt: null,
      survivalTimeMs: 0,
      stats: this.state.stats,
      isAlive: true,
    });

    await writeState(this.state);

    this.rebirthScheduled = false;
    this.emit(PetEvent.REBORN);
  }

  private createSummary(): PetSummary {
    return {
      petId: this.state.petId,
      bornAt: this.state.stats.bornAt,
      diedAt: this.state.stats.diedAt,
      survivalTimeMs: this.state.stats.diedAt
        ? this.state.stats.diedAt - this.state.stats.bornAt
        : Date.now() - this.state.stats.bornAt,
      stats: { ...this.state.stats },
      isAlive: false,
    };
  }

  private scheduleNextPoop(): void {
    this.state.nextPoopTime = calculateNextPoopTime();
  }

  private startHungerTimer(): void {
    this.state.hungerTimerStart = Date.now();
  }

  private transition(newState: PetState, event: PetEvent | null): void {
    this.state.state = newState;
    if (event) {
      this.state.lastEvent = event;
      this.state.lastEventTime = Date.now();
      this.emit(event);
    }
  }

  private async processCommands(): Promise<void> {
    const queue = await readCommands();
    if (queue.pendingCommands.length > 0) {
      for (const cmd of queue.pendingCommands) {
        if (cmd.type === 'FEED') {
          this.feed();
        } else if (cmd.type === 'CLEAN') {
          this.clean();
        } else if (cmd.type === 'HEAL') {
          this.heal();
        } else if (cmd.type === 'HATCH' && cmd.creatureId && cmd.personality) {
          this.hatch(cmd.creatureId, cmd.personality);
        }
      }
      await clearCommands();
    }
  }

  private emit(event: PetEvent): void {
    this.listeners.forEach(fn => fn(event));
  }

  private emitDeath(summary: PetSummary): void {
    this.deathListeners.forEach(fn => fn(summary));
  }

  onEvent(listener: (event: PetEvent) => void): void {
    this.listeners.push(listener);
  }

  onDeath(listener: (summary: PetSummary) => void): void {
    this.deathListeners.push(listener);
  }

  getState(): PetState {
    return this.state.state;
  }

  getStateData(): PetStateData {
    return { ...this.state };
  }

  getPoopCount(): number {
    return this.state.poopCount;
  }

  getPetId(): number {
    return this.state.petId;
  }

  getCreatureId(): string | null {
    return this.state.creatureId;
  }
}
