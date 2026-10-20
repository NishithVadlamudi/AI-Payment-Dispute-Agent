#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/setup-codex-skills.mjs [--check | --dry-run]');
  console.log('Installs the seven requested bundles for local Codex. Requires Node 24, Git, Codex CLI 0.122+, Bun 1.4.2+, npm and Bash.');
  process.exit(0);
}
if (args.some((arg) => !['--check', '--dry-run'].includes(arg)) || args.length > 1) {
  console.error('Use --help, --check or --dry-run, or run with no arguments to install.');
  process.exit(1);
}

const dryRun = args.includes('--dry-run');
const root = join(homedir(), '.local', 'share', 'payment-dispute-codex-skills');
const skills = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills');
const repos = [
  ['addyosmani/agent-skills', 'agent-skills@agent-skills'],
  ['dietrichgebert/ponytail', 'ponytail@ponytail'],
  ['Leonxlnx/taste-skill', 'taste-skill@taste-skill'],
  ['emilkowalski/skills'],
  ['garrytan/gstack'],
  ['morluto/rea'],
  ['VoltAgent/awesome-design-md'],
];

function run(command, values, cwd = root) {
  console.log(JSON.stringify({ command, args: values, cwd }));
  if (!dryRun) execFileSync(command, values, { cwd, stdio: 'inherit' });
}

function version(command) {
  try {
    return execFileSync(command, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Missing prerequisite: ${command}. Install it and reopen your terminal; see docs/local-development.md.`);
    throw error;
  }
}

function atLeast(actual, expected) {
  const match = actual.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  for (let index = 0; index < expected.length; index++) {
    if (parts[index] !== expected[index]) return parts[index] > expected[index];
  }
  return true;
}

function preflight() {
  if (process.platform === 'win32') throw new Error('Run this installer inside WSL2. See docs/local-development.md.');
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node.js 24 for this project.');
  for (const command of ['git', 'npm', 'bash']) console.log(`${command}: ${version(command).split('\n')[0]}`);
  const codex = version('codex');
  const bun = version('bun');
  if (!atLeast(codex, [0, 122, 0])) throw new Error('Codex CLI 0.122+ is required.');
  if (!atLeast(bun, [1, 4, 2])) throw new Error('Bun 1.4.2+ is required by the inspected Gstack release.');
  console.log(`Codex: ${codex}; Bun: ${bun}`);
}

function link(source, destination) {
  if (dryRun) return console.log(JSON.stringify({ link: source, destination }));
  // Never replace a skill or link the user already owns.
  if (existsSync(destination) || readdirSync(skills).includes(destination.split('/').at(-1))) {
    console.log(`Preserved existing skill: ${destination}`);
    return;
  }
  symlinkSync(source, destination, 'dir');
}

try {
  if (!dryRun) preflight();
  if (args.includes('--check')) process.exit(0);
  if (!dryRun) { mkdirSync(root, { recursive: true }); mkdirSync(skills, { recursive: true }); }
  const sources = new Map();
  for (const [repo, plugin] of repos) {
    const destination = join(root, repo.replace('/', '--'));
    sources.set(repo, destination);
    if (dryRun || !existsSync(destination)) run('git', ['clone', '--depth', '1', `https://github.com/${repo}.git`, destination]);
    else {
      const origin = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: destination, encoding: 'utf8' }).trim();
      if (origin !== `https://github.com/${repo}.git`) throw new Error(`Preserving unexpected existing checkout: ${destination}`);
      console.log(`Reusing existing checkout without resetting or pulling: ${destination}`);
    }
    if (plugin) {
      run('codex', ['plugin', 'marketplace', 'add', destination]);
      run('codex', ['plugin', 'add', plugin]);
    }
  }
  const emil = join(sources.get('emilkowalski/skills'), 'skills');
  if (dryRun) console.log(`Link each Emil skill from ${emil} into ${skills}`);
  else for (const name of readdirSync(emil)) {
    if (existsSync(join(emil, name, 'SKILL.md'))) link(join(emil, name), join(skills, name));
  }
  const reference = join(root, 'voltagent-design-references');
  if (!dryRun) {
    mkdirSync(reference, { recursive: true });
    const content = '---\nname: voltagent-design-references\ndescription: Consult the local VoltAgent DESIGN.md collection when asked for design references or brand comparisons.\n---\n\nRead library/README.md, then the relevant design-md/<brand>/DESIGN.md on demand. These are references, not automatic project styling rules. Preserve the user\'s brand and requirements.\n';
    const file = join(reference, 'SKILL.md');
    if (existsSync(file) && readFileSync(file, 'utf8') !== content) throw new Error(`Preserving modified reference wrapper: ${file}`);
    writeFileSync(file, content);
    const library = join(reference, 'library');
    if (!existsSync(library)) symlinkSync(sources.get('VoltAgent/awesome-design-md'), library, 'dir');
  }
  link(reference, join(skills, 'voltagent-design-references'));
  run('bash', ['./setup', '--host', 'codex'], sources.get('garrytan/gstack'));
  // Upstream setup previews its exact Codex changes and installs a matching
  // released server/workflow together; don't mix it with main's tool catalog.
  run('npx', ['--yes', 'rea-agents@latest', 'setup', '--client', 'codex']);
  if (!dryRun) {
    const revisions = Object.fromEntries([...sources].map(([repo, path]) => [repo, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path, encoding: 'utf8' }).trim()]));
    writeFileSync(join(root, 'sources.json'), JSON.stringify(revisions, null, 2) + '\n');
  }
  console.log(dryRun ? 'Dry run only: no files, network requests or registrations changed.' : 'Install commands completed. Review any upstream partial-readiness notices, then start a new Codex session.');
} catch (error) {
  console.error(error.message);
  console.error('Setup stopped. Existing checkouts and skills were preserved; fix the reported prerequisite and rerun.');
  process.exitCode = 1;
}
