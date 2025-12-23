# ssrr

A simple working directory (wd) utility for Node.js.

## Installation

```bash
npm install
```

## Usage

### As a CLI tool

```bash
node wd.js
```

This will print the current working directory.

### As a module

```javascript
const { getWorkingDirectory } = require('ssrr');

const cwd = getWorkingDirectory();
console.log(cwd);
```

## Testing

```bash
npm test
```