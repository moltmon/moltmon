#!/usr/bin/env node
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const shouldBuild = args.includes('--build');
const passthrough = args.filter((arg) => arg !== '--build');

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (shouldBuild) {
  run('npm', ['run', 'build']);
}

run('node', ['dist/web/index.js', ...passthrough]);
