const Module = require('module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'typescript' && parent?.filename?.includes('ts-jest')) {
    return originalLoad.call(this, 'ts-compiler', parent, isMain);
  }
  return originalLoad.call(this, request, parent, isMain);
};

module.exports = require('ts-jest');
