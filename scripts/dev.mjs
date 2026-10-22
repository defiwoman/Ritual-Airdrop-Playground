import { spawn } from 'node:child_process';
// Accept the conventional --host/--port arguments used by preview supervisors.
// Netlify Dev serves the static app and Functions together; it has no --host flag.
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = portIndex >= 0 ? args[portIndex + 1] : '4173';
if (!/^\d+$/.test(port ?? '') || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid development port');
const child = spawn(process.execPath, ['node_modules/netlify-cli/bin/run.js', 'dev', '--offline', '--no-open', '--port', port], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
