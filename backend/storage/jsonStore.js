'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const DATA_DIR = path.resolve(process.env.GVCN_DATA_DIR || path.resolve(__dirname, '../data'));
const { ALLOWED } = require('./schema');
const queues = new Map();

function dataFile(name) {
  if (!ALLOWED.has(name)) throw new Error('Unknown JSON collection');
  return path.join(DATA_DIR, `${name}.json`);
}
async function readJson(name) {
  return JSON.parse(await fs.readFile(dataFile(name), 'utf8'));
}
async function writeJson(name, value) {
  const filepath = dataFile(name);
  const temporary = `${filepath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, filepath);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
// Serialise read-modify-write operations targeting the same JSON file.
async function updateJson(name, mutate) {
  const previous = queues.get(name) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const original = await readJson(name);
    const { data, result } = await mutate(original);
    await writeJson(name, data);
    return result;
  });
  queues.set(name, next.catch(() => {}));
  return next;
}
module.exports = { readJson, updateJson };
