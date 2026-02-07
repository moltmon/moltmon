import { createServer } from 'http';
import { readFileSync, readdirSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { PetState } from '../shared/types.js';
import { restoreOrCreateState } from '../shared/state.js';
import { PetStateMachine } from '../animation/stateMachine.js';
import { startMcpServer } from '../mcp/index.js';

const DEFAULT_PORT = 8000;
const MAX_PORT_ATTEMPTS = 20;
const TICK_INTERVAL_MS = 200;
const HATCH_DURATION_MS = 2000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const DIST_ROOT = resolve(__dirname, '..');
const WEB_ROOT = join(DIST_ROOT, 'web');
const CREATURES_ROOT = join(DIST_ROOT, 'creatures');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

function listCreatureDirs(): string[] {
  try {
    return readdirSync(CREATURES_ROOT)
      .filter((name) => statSync(join(CREATURES_ROOT, name)).isDirectory())
      .sort();
  } catch {
    return [];
  }
}

function listPngs(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.png'));
  } catch {
    return [];
  }
}

function matchFrames(files: string[], prefix: string): string[] {
  return files.filter((file) => file.startsWith(`${prefix}_`));
}

function buildManifest() {
  const creatures: Record<string, { left: string[]; right: string[]; sick: string[]; dead: string[] }> = {};
  const order = listCreatureDirs();

  order.forEach((creatureId) => {
    const dir = join(CREATURES_ROOT, creatureId);
    const files = listPngs(dir);

    const left = matchFrames(files, 'left').map((file) => `/creatures/${creatureId}/${file}`);
    const right = matchFrames(files, 'right').map((file) => `/creatures/${creatureId}/${file}`);
    const sick = matchFrames(files, 'sick').map((file) => `/creatures/${creatureId}/${file}`);
    const dead = files
      .filter((file) => file === 'dead.png')
      .map((file) => `/creatures/${creatureId}/${file}`);

    creatures[creatureId] = { left, right, sick, dead };
  });

  return { order, creatures };
}

function send(res: import('http').ServerResponse, status: number, body: string | Buffer, type: string) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function serveFile(res: import('http').ServerResponse, filePath: string) {
  const ext = extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  try {
    const data = readFileSync(filePath);
    send(res, 200, data, type);
  } catch {
    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

function openBrowser(url: string) {
  const platform = process.platform;
  let cmd: string;
  let args: string[] = [];

  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.unref();
}

function createRequestHandler(machine: PetStateMachine) {
  return (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    if (!req.url) {
      send(res, 400, 'Bad request', 'text/plain; charset=utf-8');
      return;
    }

    if (req.url === '/api/creatures') {
      const payload = JSON.stringify(buildManifest());
      send(res, 200, payload, 'application/json; charset=utf-8');
      return;
    }

    if (req.url === '/api/state') {
      const payload = JSON.stringify(machine.getStateData());
      send(res, 200, payload, 'application/json; charset=utf-8');
      return;
    }

    if (req.url.startsWith('/creatures/')) {
      const filePath = join(DIST_ROOT, req.url);
      serveFile(res, filePath);
      return;
    }

    if (req.url.startsWith('/sprites/')) {
      const filePath = join(DIST_ROOT, req.url);
      serveFile(res, filePath);
      return;
    }

    let requestPath = req.url.split('?')[0];
    if (requestPath === '/' || requestPath === '') {
      requestPath = '/index.html';
    }

    const filePath = join(WEB_ROOT, requestPath);
    serveFile(res, filePath);
  };
}

function parsePortArg(): number {
  const argIndex = process.argv.findIndex((arg) => arg === '--port');
  if (argIndex === -1) return DEFAULT_PORT;
  const value = Number(process.argv[argIndex + 1]);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PORT;
  return Math.floor(value);
}

function shouldStartMcp(): boolean {
  return !process.argv.includes('--no-mcp');
}

function startServer(preferredPort: number, machine: PetStateMachine) {
  const handler = createRequestHandler(machine);
  let port = preferredPort;
  let attempts = 0;

  return new Promise<{ server: import('http').Server; port: number }>((resolve, reject) => {
    const tryListen = () => {
      const server = createServer(handler);
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attempts < MAX_PORT_ATTEMPTS) {
          attempts += 1;
          port += 1;
          tryListen();
          return;
        }
        reject(err);
      });

      server.listen(port, () => {
        resolve({ server, port });
      });
    };

    tryListen();
  });
}

async function main() {
  const { state } = await restoreOrCreateState();
  const machine = new PetStateMachine(state);
  let hatchStart: number | null = null;

  if (shouldStartMcp()) {
    await startMcpServer();
  }

  setInterval(async () => {
    await machine.tick();

    const currentState = machine.getState();
    if (currentState === PetState.HATCHING) {
      if (hatchStart === null) {
        hatchStart = Date.now();
      } else if (Date.now() - hatchStart >= HATCH_DURATION_MS) {
        machine.completeHatching();
        hatchStart = null;
      }
    } else {
      hatchStart = null;
    }
  }, TICK_INTERVAL_MS);

  const preferredPort = parsePortArg();
  const { port } = await startServer(preferredPort, machine);
  const url = `http://localhost:${port}/`;
  console.error(`Moltmon web running at ${url}`);
  if (!process.argv.includes('--no-open')) {
    openBrowser(url);
  }
}

main().catch((err) => {
  console.error('Failed to start Moltmon web server:', err);
  process.exit(1);
});
