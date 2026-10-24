#!/usr/bin/env node
const { parseArgs, readJson, failure } = require('./lib/run');
const { recordReview } = require('./lib/gates');
try {
  const a = parseArgs(process.argv.slice(2), ['run', 'input']);
  console.log(JSON.stringify(recordReview({ ...readJson(a.input), directory: a.run })));
} catch (error) { failure(error); }
