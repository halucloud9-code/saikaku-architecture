import { spawn } from 'node:child_process';
import net from 'node:net';
import waitOn from 'wait-on';

const ports = [3001, 5173, 8090, 9099];
const children = [];
let shuttingDown = false;

const sharedEnv = {
  ...process.env,
  VITE_USE_FIREBASE_EMULATOR: 'true',
  VITE_FIREBASE_PROJECT_ID: 'demo-saikaku',
  VITE_FIREBASE_API_KEY: 'fake-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-saikaku.firebaseapp.com',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-saikaku.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:test',
  VITE_FIREBASE_EMULATOR_AUTH_PORT: '9099',
  VITE_FIREBASE_EMULATOR_FIRESTORE_PORT: '8090',
  FIRESTORE_EMULATOR_HOST: 'localhost:8090',
  FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
  FIREBASE_PROJECT_ID: 'demo-saikaku',
  GCLOUD_PROJECT: 'demo-saikaku',
  MOCK_ANTHROPIC: '1',
  NODE_ENV: 'test',
};

function log(message) {
  console.log(`[orchestrator] ${message}`);
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => {
      reject(new Error(`port ${port} is already in use. Stop the process on ${port} before running E2E tests.`));
    });
    server.once('listening', () => {
      server.close(() => resolve());
    });
    server.listen(port, '127.0.0.1');
  });
}

function prefixStream(stream, prefix) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length) console.log(`${prefix} ${line}`);
    }
  });
  stream.on('end', () => {
    if (buffer.length) console.log(`${prefix} ${buffer}`);
  });
}

function run(name, command, args, env = sharedEnv) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  prefixStream(child.stdout, `[${name}]`);
  prefixStream(child.stderr, `[${name}]`);
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      log(`${name} exited unexpectedly (code=${code}, signal=${signal ?? 'none'})`);
    }
  });
  return child;
}

async function wait(resources, timeout) {
  await waitOn({
    resources,
    timeout,
    interval: 500,
    tcpTimeout: 1000,
    window: 1000,
  });
}

async function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('stopping spawned processes');
  for (const child of children.slice().reverse()) {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM');
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (const child of children.slice().reverse()) {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGKILL');
    }
  }
}

async function main() {
  for (const port of ports) {
    await assertPortFree(port);
  }

  log('starting Firebase emulators');
  run('emulator', 'firebase', ['emulators:start', '--only', 'auth,firestore', '--project', 'demo-saikaku'], sharedEnv);
  await wait(['tcp:9099', 'tcp:8090'], 60_000);

  log('starting API server');
  run('api', 'node', ['server.js'], sharedEnv);
  await wait(['http://localhost:3001/api/health'], 30_000);

  log('starting Vite dev server');
  run('vite', 'npm', ['run', 'dev', '--', '--port', '5173', '--strictPort'], sharedEnv);
  await wait(['http://localhost:5173'], 60_000);

  log('running Playwright');
  const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)];
  const playwright = spawn('npx', playwrightArgs, {
    cwd: process.cwd(),
    env: sharedEnv,
    stdio: 'inherit',
  });

  const code = await new Promise((resolve) => {
    playwright.on('exit', (exitCode, signal) => {
      if (signal) resolve(1);
      else resolve(exitCode ?? 1);
    });
  });

  await cleanup();
  process.exit(code);
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(143);
});

main().catch(async (e) => {
  console.error(`[orchestrator] ${e.message || e}`);
  await cleanup();
  process.exit(1);
});
