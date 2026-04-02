import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMobileLotSummary, sortMobileLotsByDistance } from './mobile-lots.ts';

const baseLot = {
  id: 1,
  ownerId: 2,
  name: 'Split Private Garage',
  address: '1 Sachem St Boston, MA 02119',
  description: 'Garage near downtown',
  pricePerHour: 3600,
  totalSpots: 20,
  operatingHoursOpen: '06:00',
  operatingHoursClose: '23:00',
  isArchived: false,
  createdAt: new Date().toISOString(),
  availableSpots: 8,
};

test('buildMobileLotSummary preserves stored coordinates when present', () => {
  const summary = buildMobileLotSummary({
    ...baseLot,
    latitude: 42.3401,
    longitude: -71.0892,
  }, { latitude: 42.338, longitude: -71.09 });

  assert.equal(summary.latitude, 42.3401);
  assert.equal(summary.longitude, -71.0892);
  assert.equal(summary.priceLabel, '$36/hr');
  assert.ok(typeof summary.distanceMiles === 'number');
});

test('buildMobileLotSummary derives deterministic fallback coordinates when missing', () => {
  const one = buildMobileLotSummary(baseLot);
  const two = buildMobileLotSummary(baseLot);

  assert.equal(one.latitude, two.latitude);
  assert.equal(one.longitude, two.longitude);
  assert.ok(one.latitude >= 42.2 && one.latitude <= 42.45);
  assert.ok(one.longitude >= -71.2 && one.longitude <= -70.95);
});

test('sortMobileLotsByDistance orders nearer lots first', () => {
  const nearby = buildMobileLotSummary({
    ...baseLot,
    id: 2,
    latitude: 42.3402,
    longitude: -71.0893,
  }, { latitude: 42.3401, longitude: -71.0892 });

  const farther = buildMobileLotSummary({
    ...baseLot,
    id: 3,
    latitude: 42.30,
    longitude: -71.20,
  }, { latitude: 42.3401, longitude: -71.0892 });

  const ordered = sortMobileLotsByDistance([farther, nearby]);
  assert.deepEqual(ordered.map((lot) => lot.id), [2, 3]);
});
