export interface TimingConfig {
  eggHatchMinMs: number;
  eggHatchMaxMs: number;
  hungerIntervalMs: number;
  starvationDeathMs: number;
  poopMinDelayMs: number;
  poopMaxDelayMs: number;
  sicknessThresholds: { 1: number; 2: number; 3: number };
  deathAfterSickMs: number;
  rebirthDelayMs: number;
}

export const PRODUCTION_TIMING: TimingConfig = {
  eggHatchMinMs: 2 * 60 * 1000,      // 2 minutes
  eggHatchMaxMs: 5 * 60 * 1000,      // 5 minutes
  hungerIntervalMs: 5 * 60 * 1000,   // 5 minutes
  starvationDeathMs: 60 * 60 * 1000, // 1 hour
  poopMinDelayMs: 2 * 60 * 1000,     // 2 minutes
  poopMaxDelayMs: 5 * 60 * 1000,     // 5 minutes
  sicknessThresholds: {
    1: 60 * 60 * 1000,   // 1 hour for 1 poop
    2: 45 * 60 * 1000,   // 45 minutes for 2 poops
    3: 30 * 60 * 1000,   // 30 minutes for 3+ poops
  },
  deathAfterSickMs: 60 * 60 * 1000,  // 1 hour
  rebirthDelayMs: 5 * 1000,          // 5 seconds
};

export const DEV_TIMING: TimingConfig = {
  eggHatchMinMs: 3 * 1000,           // 3 seconds
  eggHatchMaxMs: 5 * 1000,           // 5 seconds
  hungerIntervalMs: 10 * 1000,       // 10 seconds
  starvationDeathMs: 30 * 1000,      // 30 seconds
  poopMinDelayMs: 5 * 1000,          // 5 seconds
  poopMaxDelayMs: 10 * 1000,         // 10 seconds
  sicknessThresholds: {
    1: 20 * 1000,   // 20 seconds for 1 poop
    2: 15 * 1000,   // 15 seconds for 2 poops
    3: 10 * 1000,   // 10 seconds for 3+ poops
  },
  deathAfterSickMs: 20 * 1000,       // 20 seconds
  rebirthDelayMs: 2 * 1000,          // 2 seconds
};

let devMode = false;

export function setDevMode(enabled: boolean): void {
  devMode = enabled;
}

export function isDevMode(): boolean {
  return devMode;
}

export function getConfig(): TimingConfig {
  return devMode ? DEV_TIMING : PRODUCTION_TIMING;
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
