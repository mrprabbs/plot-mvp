import test from 'node:test';
import assert from 'node:assert/strict';

const originalDatabaseUrl = process.env.DATABASE_URL;

test('getDatabaseUrl returns the configured database url', async () => {
  process.env.DATABASE_URL = 'postgres://example';
  const { getDatabaseUrl } = await import('./db.ts');
  assert.equal(getDatabaseUrl(), 'postgres://example');
});

test('getDatabaseUrl throws when DATABASE_URL is missing', async () => {
  delete process.env.DATABASE_URL;
  const { getDatabaseUrl } = await import('./db.ts');
  assert.throws(() => getDatabaseUrl(), /DATABASE_URL/);
});

test.after(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
});
