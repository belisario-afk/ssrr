#!/usr/bin/env node

// Simple working directory utility
const path = require('path');

function getWorkingDirectory() {
  return process.cwd();
}

function main() {
  const cwd = getWorkingDirectory();
  console.log(cwd);
}

if (require.main === module) {
  main();
}

module.exports = { getWorkingDirectory };
