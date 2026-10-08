'use strict';
if (process.env.DATABASE_URL) {
  module.exports = require('./postgresStore');
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('Cloud production requires DATABASE_URL for persistent PostgreSQL; JSON files are local-only');
} else {
  const json = require('./jsonStore');
  module.exports = { ...json, initializeStorage: async () => {}, health: async () => { await json.readJson('classes'); }, shutdown: async () => {}, mode: 'json-local' };
}
