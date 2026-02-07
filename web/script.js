const canvas = document.getElementById('moltmon-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('moltmon-status');

const IMAGE_CACHE = new Map();

function loadImage(src) {
  if (IMAGE_CACHE.has(src)) return IMAGE_CACHE.get(src);
  const img = new Image();
  img.src = src;
  IMAGE_CACHE.set(src, img);
  return img;
}

function sortFrameFiles(files) {
  const withIndex = files.map((file) => {
    const match = file.match(/_(\d+)\.png$/);
    return { file, index: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER };
  });

  withIndex.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return a.file.localeCompare(b.file);
  });

  return withIndex.map((entry) => entry.file);
}

async function fetchCreatures() {
  const response = await fetch('/api/creatures');
  if (!response.ok) throw new Error('Failed to load creatures');
  return response.json();
}

let creatureOrder = [];
let creatureMap = {};
let spriteSets = null;
let activeCreatureId = null;
let currentState = null;
let poopPositions = [];
let lastPoopCount = 0;

const SCALE = 4;
const SIGN_OFFSET = 6;

const poopSprite = loadImage('/sprites/poop.png');
const sickSignSprite = loadImage('/sprites/sick.png');
const deathSignSprite = loadImage('/sprites/death.png');

const state = {
  frameIndex: 0,
  frameStart: performance.now(),
  moveDirection: 'left',
  moveStart: performance.now(),
};

const frameMs = 220;
const padding = 40;
const travel = canvas.width - padding * 2;
const MOVE_CYCLE_MS = 5000;
const STATE_POLL_MS = 500;

function getActiveCreature() {
  if (!activeCreatureId) return null;
  return creatureMap[activeCreatureId] || null;
}

function buildSpriteSets(creature) {
  return {
    left: sortFrameFiles(creature.left).map(loadImage),
    right: sortFrameFiles(creature.right).map(loadImage),
    sick: sortFrameFiles(creature.sick).map(loadImage),
    dead: creature.dead.map(loadImage),
  };
}

function getFrameInterval(phaseName) {
  if (phaseName === 'sick') return frameMs * 1.5;
  return frameMs;
}

function getSprite(phaseName, now) {
  if (!spriteSets) return null;
  const frames = spriteSets[phaseName];
  if (!frames || frames.length === 0) return null;
  if (frames.length === 1) return frames[0];

  const interval = getFrameInterval(phaseName);
  if (now - state.frameStart >= interval) {
    state.frameStart = now;
    state.frameIndex = (state.frameIndex + 1) % frames.length;
  }

  return frames[state.frameIndex];
}

function clear() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackground() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSprite(img, x, y, scale = 4) {
  if (!img || !img.complete) return;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
}

function getSpriteSize(img) {
  if (!img || !img.complete) return { width: 0, height: 0 };
  return { width: img.width * SCALE, height: img.height * SCALE };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function ensurePoopPositions(count) {
  const targetCount = Math.min(3, Math.max(0, count));
  if (targetCount === lastPoopCount) return;

  if (targetCount < lastPoopCount) {
    poopPositions = poopPositions.slice(0, targetCount);
  } else {
    const poopSize = getSpriteSize(poopSprite);
    const minX = padding + poopSize.width / 2;
    const maxX = canvas.width - padding - poopSize.width / 2;
    const minY = padding + poopSize.height / 2;
    const maxY = canvas.height - padding - poopSize.height / 2;

    for (let i = poopPositions.length; i < targetCount; i += 1) {
      let attempts = 0;
      let placed = false;
      while (attempts < 50 && !placed) {
        attempts += 1;
        const x = randomBetween(minX, maxX);
        const y = randomBetween(minY, maxY);
        const ok = poopPositions.every((pos) => {
          const dx = pos.x - x;
          const dy = pos.y - y;
          const minDist = Math.max(poopSize.width, poopSize.height);
          return Math.hypot(dx, dy) > minDist;
        });
        if (ok) {
          poopPositions.push({ x, y });
          placed = true;
        }
      }
    }
  }

  lastPoopCount = targetCount;
}

function drawPoops() {
  if (!poopSprite.complete) return;
  poopPositions.forEach((pos) => {
    drawSprite(poopSprite, pos.x, pos.y, SCALE);
  });
}

function drawSign(sprite, anchorX, anchorY, baseWidth, baseHeight) {
  if (!sprite || !sprite.complete) return;
  const signSize = getSpriteSize(sprite);
  const x = anchorX + baseWidth / 2 - signSize.width / 2;
  const y = anchorY - baseHeight / 2 - signSize.height / 2 - SIGN_OFFSET;
  const clampedX = Math.min(
    canvas.width - padding - signSize.width / 2,
    Math.max(padding + signSize.width / 2, x)
  );
  const clampedY = Math.min(
    canvas.height - padding - signSize.height / 2,
    Math.max(padding + signSize.height / 2, y)
  );
  drawSprite(sprite, clampedX, clampedY, SCALE);
}

function drawCenteredText(text, y, size = 16) {
  ctx.fillStyle = '#1f1f23';
  ctx.font = `${size}px "Space Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, y);
}

function updateStatus(phaseName, poopCount) {
  if (!statusEl) return;
  if (phaseName === 'egg') {
    statusEl.textContent = 'Egg discovered...';
  } else if (phaseName === 'hatch') {
    statusEl.textContent = 'Hatching...';
  } else if (phaseName === 'sick') {
    statusEl.textContent = 'Feeling sick.';
  } else if (phaseName === 'dead') {
    statusEl.textContent = '...';
  } else if (poopCount > 0) {
    statusEl.textContent = `Poop: ${poopCount}`;
  } else {
    statusEl.textContent = '';
  }
}

function render(now) {
  clear();
  drawBackground();

  const phaseName = currentState?.state || 'egg';

  if (phaseName === 'EGG') {
    drawCenteredText('EGG', canvas.height / 2 - 10, 20);
    ensurePoopPositions(0);
    updateStatus('egg', currentState?.poopCount || 0);
    requestAnimationFrame(render);
    return;
  }

  if (phaseName === 'HATCHING') {
    drawCenteredText('HATCHING', canvas.height / 2 - 10, 18);
    ensurePoopPositions(0);
    updateStatus('hatch', currentState?.poopCount || 0);
    requestAnimationFrame(render);
    return;
  }

  if (!spriteSets) {
    drawCenteredText('Loading...', canvas.height / 2 - 10, 16);
    requestAnimationFrame(render);
    return;
  }

  let phaseKey = 'left';
  if (phaseName === 'SICK') {
    phaseKey = 'sick';
  } else if (phaseName === 'DEAD') {
    phaseKey = 'dead';
  } else if (phaseName === 'HUNGRY' || phaseName === 'IDLE') {
    if (now - state.moveStart >= MOVE_CYCLE_MS) {
      state.moveStart = now;
      state.moveDirection = state.moveDirection === 'left' ? 'right' : 'left';
      state.frameStart = now;
      state.frameIndex = 0;
    }
    phaseKey = state.moveDirection;
  }

  const sprite = getSprite(phaseKey, now);
  const spriteSize = getSpriteSize(sprite);

  let x = canvas.width / 2;
  if (phaseKey === 'left') {
    const t = Math.min(1, (now - state.moveStart) / MOVE_CYCLE_MS);
    x = padding + travel * (1 - t);
  } else if (phaseKey === 'right') {
    const t = Math.min(1, (now - state.moveStart) / MOVE_CYCLE_MS);
    x = padding + travel * t;
  }

  const y = canvas.height / 2 + 16;
  drawSprite(sprite, x, y, SCALE);

  ensurePoopPositions(currentState?.poopCount || 0);
  drawPoops();

  if (phaseName === 'SICK') {
    drawSign(sickSignSprite, x, y, spriteSize.width, spriteSize.height);
  } else if (phaseName === 'DEAD') {
    drawSign(deathSignSprite, x, y, spriteSize.width, spriteSize.height);
  }

  updateStatus(
    phaseKey === 'sick' ? 'sick' : phaseKey === 'dead' ? 'dead' : 'idle',
    currentState?.poopCount || 0
  );
  requestAnimationFrame(render);
}

fetchCreatures()
  .then((data) => {
    creatureOrder = data.order || [];
    creatureMap = data.creatures || {};
    if (creatureOrder.length === 0) {
      throw new Error('No creatures found');
    }
    requestAnimationFrame(render);
  })
  .catch((err) => {
    if (statusEl) {
      statusEl.textContent = 'Failed to load creatures.';
    }
    console.error(err);
  });

function applyState(nextState) {
  currentState = nextState;
  if (!nextState) return;
  ensurePoopPositions(nextState.poopCount || 0);
  if (!nextState?.creatureId) return;
  if (nextState.creatureId !== activeCreatureId) {
    activeCreatureId = nextState.creatureId;
    const creature = getActiveCreature();
    if (creature) {
      spriteSets = buildSpriteSets(creature);
      state.frameStart = performance.now();
      state.frameIndex = 0;
      state.moveStart = performance.now();
      state.moveDirection = 'left';
    }
  }
}

async function pollState() {
  try {
    const response = await fetch('/api/state');
    if (!response.ok) return;
    const data = await response.json();
    applyState(data);
  } catch (err) {
    console.error(err);
  }
}

setInterval(pollState, STATE_POLL_MS);
pollState();
