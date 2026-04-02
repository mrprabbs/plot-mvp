import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMobileAuthTokenExpiry,
  hashMobileAuthToken,
  parseMobileBearerToken,
} from './mobile-auth.ts';

test('hashMobileAuthToken is stable for the same token', () => {
  const token = 'plot-mobile-token';
  assert.equal(hashMobileAuthToken(token), hashMobileAuthToken(token));
  assert.notEqual(hashMobileAuthToken(token), hashMobileAuthToken(`${token}-2`));
});

test('parseMobileBearerToken extracts a bearer token', () => {
  assert.equal(parseMobileBearerToken('Bearer abc123'), 'abc123');
  assert.equal(parseMobileBearerToken('bearer xyz'), 'xyz');
  assert.equal(parseMobileBearerToken(undefined), undefined);
  assert.equal(parseMobileBearerToken('Basic abc123'), undefined);
});

test('buildMobileAuthTokenExpiry defaults to about 30 days ahead', () => {
  const now = Date.UTC(2026, 3, 2, 12, 0, 0);
  const expiresAt = buildMobileAuthTokenExpiry(now);
  const diffDays = (new Date(expiresAt).getTime() - now) / (1000 * 60 * 60 * 24);

  assert.equal(diffDays, 30);
});
