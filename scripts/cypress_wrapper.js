const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const cypressBin = path.resolve(
    __dirname,
    '..',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'cypress.cmd' : 'cypress',
);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(cypressBin, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

child.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
});

child.on('exit', (code) => {
    process.exit(code === null ? 1 : code);
});
