const { spawn } = require('child_process');
const path = require('path');

console.log('Starting production server...');

// Use npx to find npm scripts
const build = spawn('npx', ['next', 'build'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

build.on('close', (code) => {
  if (code !== 0) {
    console.error('Build failed');
    process.exit(1);
  }
  
  console.log('Build successful, starting server...');
  
  // Then start
  const start = spawn('npx', ['next', 'start', '--port', '3000'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });
  
  start.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code);
  });
});
