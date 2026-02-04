import { PetStateMachine } from './stateMachine.js';
import { PetState, PetSummary } from '../shared/types.js';
import { restoreOrCreateState } from '../shared/state.js';
import { setDevMode, getConfig } from '../shared/config.js';
import {
  clear,
  hideCursor,
  showCursor,
  drawFrame,
  showEggMessage,
  showWaitingForHatchMessage,
  showCrackMessage,
  showHatchedFlash,
  showMeetMessage,
  showNyaaMessage,
  showHungryMessage,
  showSickMessage,
  showPoopMessage,
  showDeadMessage,
  showGoodbyeMessage,
  showRestoredMessage,
  showNewPetMessage,
  showDeathSummary,
  showRebirthMessage,
  sleep,
} from './renderer.js';
import {
  getEggFrames,
  getHatchFrames,
  getIdleSequence,
  getSickSequence,
  getDeadFrame,
  switchCreature,
} from './frames.js';

// Parse CLI arguments
function parseArgs(): { devMode: boolean } {
  const args = process.argv.slice(2);
  const devMode = args.includes('--dev-mode') || args.includes('-d');
  return { devMode };
}

// Wait for AI to trigger hatch via MCP
async function eggAnimation(machine: PetStateMachine): Promise<void> {
  showEggMessage();
  await sleep(1000);

  let frameIdx = 0;
  const eggFrames = getEggFrames();

  // Loop indefinitely until hatch command is received
  while (machine.getState() === PetState.EGG) {
    await machine.tick();
    const frame = eggFrames[frameIdx % eggFrames.length];
    drawFrame(frame, 5);
    showWaitingForHatchMessage();

    frameIdx++;
    await sleep(300);
  }
}

async function hatchAnimation(machine: PetStateMachine): Promise<void> {
  // Load the correct creature based on creatureId set by HATCH command
  const creatureId = machine.getCreatureId();
  if (creatureId) {
    switchCreature(creatureId);
  }

  const hatchFrames = getHatchFrames();
  for (const frame of hatchFrames) {
    await machine.tick();
    drawFrame(frame, 5);
    showCrackMessage();
    await sleep(400);
  }

  machine.completeHatching();
  showHatchedFlash();
  await sleep(1000);
}

// Returns true if pet died and needs rebirth
async function creatureAnimationLoop(machine: PetStateMachine): Promise<PetSummary | null> {
  showMeetMessage();
  await sleep(1000);

  let frameIdx = 0;
  let pendingDeath: PetSummary | null = null;

  // Listen for death events
  const deathListener = (summary: PetSummary) => {
    pendingDeath = summary;
  };
  machine.onDeath(deathListener);

  while (true) {
    await machine.tick();

    const state = machine.getState();
    const poopCount = machine.getPoopCount();

    // Handle death state - return to trigger rebirth in main loop
    if (state === PetState.DEAD || pendingDeath) {
      if (pendingDeath) {
        return pendingDeath;
      }
    }

    // Get current sequences (may have changed after switchCreature)
    const idleSequence = getIdleSequence();
    const sickSequence = getSickSequence();

    // Select appropriate frame based on state
    let frame: string[];
    if (state === PetState.SICK) {
      frame = sickSequence[frameIdx % sickSequence.length];
    } else {
      frame = idleSequence[frameIdx % idleSequence.length];
    }

    drawFrame(frame, 5);

    // Show status message
    if (state === PetState.SICK) {
      showSickMessage();
    } else if (state === PetState.HUNGRY) {
      showHungryMessage();
    } else {
      showNyaaMessage();
    }

    // Show poop indicator
    showPoopMessage(poopCount);

    frameIdx++;
    await sleep(250);
  }
}

async function runFullLifecycle(machine: PetStateMachine, skipToState?: PetState): Promise<void> {
  // Determine starting point based on current state
  const currentState = skipToState || machine.getState();

  if (currentState === PetState.EGG) {
    // Wait for AI to trigger hatch via MCP
    await eggAnimation(machine);
    // After egg animation exits, state should be HATCHING
    await hatchAnimation(machine);
  } else if (currentState === PetState.HATCHING) {
    // If restored in hatching state, load creature and continue
    const creatureId = machine.getCreatureId();
    if (creatureId) {
      switchCreature(creatureId);
    }
    await hatchAnimation(machine);
  } else {
    // For IDLE, HUNGRY, SICK - load creature from state and continue
    const creatureId = machine.getCreatureId();
    if (creatureId) {
      switchCreature(creatureId);
    }
  }

  // Run creature animation until death
  const deathSummary = await creatureAnimationLoop(machine);

  if (deathSummary) {
    // Show dead creature
    drawFrame(getDeadFrame(), 5);
    showDeadMessage();
    await sleep(2000);

    // Show death summary
    showDeathSummary(deathSummary);
    await sleep(3000);

    // Trigger rebirth
    await machine.rebirth();

    // Show rebirth message
    showRebirthMessage(machine.getPetId());
    await sleep(2000);
  }
}

async function main(): Promise<void> {
  // Parse CLI arguments
  const { devMode } = parseArgs();
  if (devMode) {
    setDevMode(true);
    console.log('Dev mode enabled - using fast timers');
    await sleep(1000);
  }

  // Restore or create state
  const { state, isRestored } = await restoreOrCreateState();
  const machine = new PetStateMachine(state);

  // Setup cleanup handlers
  const cleanup = () => {
    showCursor();
    showGoodbyeMessage();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  try {
    hideCursor();
    clear();

    if (isRestored) {
      showRestoredMessage(machine.getPetId());
      await sleep(1500);
    } else {
      showNewPetMessage(machine.getPetId());
      await sleep(1500);
    }

    // Main game loop - runs forever, handles death/rebirth iteratively
    while (true) {
      await runFullLifecycle(machine);
      // After rebirth, machine is in EGG state, loop continues
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ERR_USE_AFTER_CLOSE') {
      console.error(err);
    }
  } finally {
    showCursor();
  }
}

main().catch(err => {
  showCursor();
  console.error(err);
  process.exit(1);
});
