'use strict';
// Private admin-only backup utility. Run on trusted local/server environment.
const fs = require('node:fs/promises');
const path = require('node:path');
const { readJson, initializeStorage, shutdown } = require('../backend/storage');
const { ALLOWED } = require('../backend/storage/schema');
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required to export the network database');
  await initializeStorage();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(process.cwd(), 'backups', stamp);
  await fs.mkdir(dest, { recursive: true, mode: 0o700 });
  for (const name of ALLOWED) {
    await fs.writeFile(path.join(dest, `${name}.json`), JSON.stringify(await readJson(name), null, 2) + '\n', { mode: 0o600 });
  }
  console.log('JSON export saved to:', dest, '- download and store off-server securely');
}
main().catch(e => { console.error('Export failed:', e.message);process.exitCode = 1; }).finally(()=>shutdown());
