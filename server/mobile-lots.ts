import type { MobileLotSummary, ParkingLotWithSpots } from "@shared/schema";

type UserLocation = {
  latitude: number;
  longitude: number;
};

function hashAddressSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function fallbackCoordinates(input: string) {
  const seed = hashAddressSeed(input);
  const latOffset = ((seed % 2400) / 10000) - 0.12;
  const lngOffset = (((Math.floor(seed / 2400)) % 2400) / 10000) - 0.12;

  return {
    latitude: 42.3601 + latOffset,
    longitude: -71.0589 + lngOffset,
  };
}

function haversineMiles(a: UserLocation, b: UserLocation) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

export function buildMobileLotSummary(
  lot: ParkingLotWithSpots,
  userLocation?: UserLocation,
): MobileLotSummary {
  const resolved = lot.latitude != null && lot.longitude != null
    ? { latitude: lot.latitude, longitude: lot.longitude }
    : fallbackCoordinates(`${lot.address}:${lot.id}`);

  return {
    id: lot.id,
    name: lot.name,
    address: lot.address,
    description: lot.description ?? null,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    availableSpots: lot.availableSpots,
    pricePerHour: lot.pricePerHour,
    priceLabel: `$${(lot.pricePerHour / 100).toFixed(0)}/hr`,
    operatorName: null,
    distanceMiles: userLocation ? haversineMiles(userLocation, resolved) : undefined,
  };
}

export function sortMobileLotsByDistance(lots: MobileLotSummary[]) {
  return [...lots].sort((a, b) => {
    const left = a.distanceMiles ?? Number.POSITIVE_INFINITY;
    const right = b.distanceMiles ?? Number.POSITIVE_INFINITY;
    return left - right;
  });
}
