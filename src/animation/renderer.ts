import {
  CLEAR_SCREEN,
  MOVE_HOME,
  HIDE_CURSOR,
  SHOW_CURSOR,
  RESET,
  YELLOW,
  MAGENTA,
  GREEN,
  CYAN,
  RED,
  DIM,
  moveCursor,
  getPoopArt,
  getPoopPositions,
  getCreatureSounds,
} from './frames.js';
import { PetSummary } from '../shared/types.js';

export function clear(): void {
  process.stdout.write(CLEAR_SCREEN + MOVE_HOME);
}

export function hideCursor(): void {
  process.stdout.write(HIDE_CURSOR);
}

export function showCursor(): void {
  process.stdout.write(SHOW_CURSOR);
}

export function drawFrame(frame: string[], yOffset = 5): void {
  clear();
  process.stdout.write('\n'.repeat(yOffset));
  for (const line of frame) {
    process.stdout.write(`          ${line}\n`);
  }
}

export function showMessage(text: string, color = RESET): void {
  process.stdout.write(`\n${color}${text}${RESET}\n`);
}

export function showEggMessage(): void {
  process.stdout.write(`\n${MAGENTA}    A mysterious egg appeared...${RESET}\n`);
}

export function showHatchingCountdown(remaining: number): void {
  process.stdout.write(`\n${YELLOW}      Hatching in ${remaining}s...${RESET}`);
}

export function showWaitingForHatchMessage(): void {
  process.stdout.write(`\n${MAGENTA}      Waiting for AI to hatch...${RESET}`);
}

export function showCrackMessage(): void {
  process.stdout.write(`\n${YELLOW}      *crack* *crack*${RESET}`);
}

export function showHatchedFlash(): void {
  for (let i = 0; i < 3; i++) {
    clear();
    process.stdout.write(`\n\n\n\n\n${GREEN}         ★ HATCHED! ★${RESET}`);
    sleepSync(150);
    clear();
    sleepSync(100);
  }
  clear();
  process.stdout.write(`\n\n\n\n\n${GREEN}      ★ A Moltmon appeared! ★${RESET}`);
}

export function showMeetMessage(): void {
  process.stdout.write(`\n${CYAN}     Meet your new companion!${RESET}\n`);
}

export function showNyaaMessage(): void {
  const sounds = getCreatureSounds();
  process.stdout.write(`\n${MAGENTA}       ~ ${sounds.idle} ~${RESET}`);
}

export function showHungryMessage(): void {
  const sounds = getCreatureSounds();
  process.stdout.write(`\n${YELLOW}       ~ ${sounds.hungry} ~${RESET}`);
}

export function showSickMessage(): void {
  const sounds = getCreatureSounds();
  process.stdout.write(`\n${GREEN}       ~ ${sounds.sick} ~${RESET}`);
}

export function showPoopMessage(count: number): void {
  if (count > 0) {
    const poopArt = getPoopArt();
    const poopPositions = getPoopPositions();
    // Draw poops at predefined positions around the screen
    const numPoops = Math.min(count, poopPositions.length);
    for (let i = 0; i < numPoops; i++) {
      const [row, col] = poopPositions[i];
      for (let j = 0; j < poopArt.length; j++) {
        process.stdout.write(moveCursor(row + j, col));
        process.stdout.write(poopArt[j]);
      }
    }
  }
}

export function showDeadMessage(): void {
  process.stdout.write(`\n${DIM}${RED}       ~ ... ~${RESET}`);
}

export function showGoodbyeMessage(): void {
  clear();
  console.log('Thanks for watching! Your Moltmon awaits...');
}

export function showRestoredMessage(petId: number): void {
  process.stdout.write(`\n${CYAN}    Welcome back! Pet #${petId} restored.${RESET}\n`);
}

export function showNewPetMessage(petId: number): void {
  process.stdout.write(`\n${CYAN}    A new Moltmon egg appears! (Pet #${petId})${RESET}\n`);
}

export function showDeathSummary(summary: PetSummary): void {
  clear();
  const survivalSecs = Math.floor(summary.survivalTimeMs / 1000);
  const survivalMins = Math.floor(survivalSecs / 60);
  const survivalHrs = Math.floor(survivalMins / 60);

  let survivalStr: string;
  if (survivalHrs > 0) {
    survivalStr = `${survivalHrs}h ${survivalMins % 60}m`;
  } else if (survivalMins > 0) {
    survivalStr = `${survivalMins}m ${survivalSecs % 60}s`;
  } else {
    survivalStr = `${survivalSecs}s`;
  }

  const cause = summary.stats.causeOfDeath === 'STARVATION'
    ? 'Starvation'
    : 'Untreated Sickness';

  const personality = summary.stats.personality || 'Unknown';

  console.log('');
  console.log(`${RED}  ╔══════════════════════════════════╗${RESET}`);
  console.log(`${RED}  ║       ${DIM}Your Moltmon has died${RESET}${RED}       ║${RESET}`);
  console.log(`${RED}  ╠══════════════════════════════════╣${RESET}`);
  console.log(`${RED}  ║${RESET}  Pet #${summary.petId}                         ${RED}║${RESET}`);
  console.log(`${RED}  ║${RESET}  Personality: ${personality.padEnd(17)}${RED}║${RESET}`);
  console.log(`${RED}  ║${RESET}  Cause: ${cause.padEnd(23)}${RED}║${RESET}`);
  console.log(`${RED}  ║${RESET}  Survived: ${survivalStr.padEnd(20)}${RED}║${RESET}`);
  console.log(`${RED}  ╠══════════════════════════════════╣${RESET}`);
  console.log(`${RED}  ║${RESET}  ${DIM}Stats:${RESET}                           ${RED}║${RESET}`);
  console.log(`${RED}  ║${RESET}    Times fed:    ${String(summary.stats.timesFed).padEnd(14)}${RED}║${RESET}`);
  console.log(`${RED}  ║${RESET}    Times sick:   ${String(summary.stats.timesSick).padEnd(14)}${RED}║${RESET}`);
  console.log(`${RED}  ║${RESET}    Times pooped: ${String(summary.stats.timesPooped).padEnd(14)}${RED}║${RESET}`);
  console.log(`${RED}  ║${RESET}    Times cleaned:${String(summary.stats.timesCleaned).padEnd(14)}${RED}║${RESET}`);
  console.log(`${RED}  ╠══════════════════════════════════╣${RESET}`);
  console.log(`${RED}  ║${RESET}  ${CYAN}A new egg is appearing...${RESET}        ${RED}║${RESET}`);
  console.log(`${RED}  ╚══════════════════════════════════╝${RESET}`);
  console.log('');
}

export function showRebirthMessage(petId: number): void {
  clear();
  console.log('');
  console.log(`${GREEN}  ╔══════════════════════════════════╗${RESET}`);
  console.log(`${GREEN}  ║        ${CYAN}New Life Begins!${RESET}${GREEN}          ║${RESET}`);
  console.log(`${GREEN}  ╠══════════════════════════════════╣${RESET}`);
  console.log(`${GREEN}  ║${RESET}  Pet #${petId} has arrived!             ${GREEN}║${RESET}`);
  console.log(`${GREEN}  ╚══════════════════════════════════╝${RESET}`);
  console.log('');
}

// Synchronous sleep for flash effect
function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
