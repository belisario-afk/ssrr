// Simple test for wd functionality
const { getWorkingDirectory } = require('./index');

console.log('Testing wd functionality...');

const cwd = getWorkingDirectory();

if (typeof cwd === 'string' && cwd.length > 0) {
  console.log('✓ getWorkingDirectory returns a string');
  console.log(`  Current directory: ${cwd}`);
} else {
  console.error('✗ getWorkingDirectory failed');
  process.exit(1);
}

console.log('\nAll tests passed!');
