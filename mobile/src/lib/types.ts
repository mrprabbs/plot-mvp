export type PublicUser = {
  id: number;
  fullName: string;
  email: string;
  role: 'owner' | 'driver';
  createdAt: string;
  updatedAt: string;
};

export type MobileLot = {
  id: number;
  name: string;
  address: string;
  description: string | null;
  latitude: number;
  longitude: number;
  availableSpots: number;
  pricePerHour: number;
  priceLabel: string;
  operatorName: string | null;
  distanceMiles?: number;
};

export type DriverReservation = {
  id: number;
  lotId: number;
  spotId: number;
  lotName: string;
  lotAddress: string;
  spotNumber: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  amountCents: number;
  cancelledAt: string | null;
};
