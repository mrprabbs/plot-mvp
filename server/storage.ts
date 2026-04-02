import {
  type User,
  type InsertUser,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type OwnerPayoutAccount,
  type InsertOwnerPayoutAccount,
  type NotificationEvent,
  type InsertNotificationEvent,
  type ParkingLot,
  type InsertParkingLot,
  type ParkingSpot,
  type InsertParkingSpot,
  type Reservation,
  type InsertReservation,
  type ParkingLotWithSpots,
  type ReservationWithDetails,
  users,
  passwordResetTokens,
  ownerPayoutAccounts,
  notificationEvents,
  parkingLots,
  parkingSpots,
  reservations,
} from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";

function nowIso() {
  return new Date().toISOString();
}

function first<T>(rows: T[]): T | undefined {
  return rows[0];
}

export class StorageError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export interface OwnerAnalytics {
  totalLots: number;
  activeLots: number;
  totalReservations: number;
  completedReservations: number;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  occupiedSpots: number;
  totalSpots: number;
}

export interface CancellationResult {
  reservation: Reservation;
  refundEligible: boolean;
  refundIssued: boolean;
}

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserPassword(userId: number, passwordHash: string): Promise<User | undefined>;
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  consumePasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  getOwnerPayoutAccount(ownerId: number): Promise<OwnerPayoutAccount | undefined>;
  upsertOwnerPayoutAccount(account: InsertOwnerPayoutAccount): Promise<OwnerPayoutAccount>;
  createNotificationEvent(event: InsertNotificationEvent): Promise<NotificationEvent>;
  getAllLots(): Promise<ParkingLotWithSpots[]>;
  getLotById(id: number): Promise<ParkingLotWithSpots | undefined>;
  createLot(lot: InsertParkingLot): Promise<ParkingLot>;
  getOwnerLots(ownerId: number): Promise<ParkingLotWithSpots[]>;
  createOwnerLot(ownerId: number, lot: Omit<InsertParkingLot, "ownerId">): Promise<ParkingLotWithSpots>;
  updateOwnerLot(ownerId: number, lotId: number, updates: Partial<Omit<InsertParkingLot, "ownerId">> & { isArchived?: boolean }): Promise<ParkingLotWithSpots | undefined>;
  getSpotsByLotId(lotId: number): Promise<ParkingSpot[]>;
  getSpotById(id: number): Promise<ParkingSpot | undefined>;
  createSpot(spot: InsertParkingSpot): Promise<ParkingSpot>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  createPendingReservation(reservation: InsertReservation): Promise<Reservation>;
  attachCheckoutSession(reservationId: number, checkoutSessionId: string): Promise<Reservation | undefined>;
  markReservationPaidByCheckoutSession(checkoutSessionId: string, paymentIntentId?: string): Promise<Reservation | undefined>;
  markReservationPaymentFailedByCheckoutSession(checkoutSessionId: string): Promise<Reservation | undefined>;
  getReservationsByEmail(email: string): Promise<Reservation[]>;
  getDriverReservations(driverUserId: number): Promise<ReservationWithDetails[]>;
  getOwnerReservations(ownerId: number): Promise<ReservationWithDetails[]>;
  getReservationById(id: number): Promise<Reservation | undefined>;
  cancelReservation(id: number): Promise<Reservation | undefined>;
  cancelDriverReservation(id: number, driverUserId: number, refundId?: string): Promise<CancellationResult>;
  getOwnerAnalytics(ownerId: number): Promise<OwnerAnalytics>;
}

async function lotsWithAvailability(lots: ParkingLot[]): Promise<ParkingLotWithSpots[]> {
  return Promise.all(
    lots.map(async (lot) => {
      const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.lotId, lot.id));
      const availableSpots = spots.filter((spot) => spot.isAvailable).length;
      return { ...lot, availableSpots };
    }),
  );
}

async function enrichReservations(resList: Reservation[]): Promise<ReservationWithDetails[]> {
  return Promise.all(
    resList.map(async (reservation) => {
      const lot = first(await db.select().from(parkingLots).where(eq(parkingLots.id, reservation.lotId)));
      const spot = first(await db.select().from(parkingSpots).where(eq(parkingSpots.id, reservation.spotId)));

      return {
        ...reservation,
        lotName: lot?.name ?? "Unknown",
        lotAddress: lot?.address ?? "Unknown",
        spotNumber: spot?.spotNumber ?? "Unknown",
      };
    }),
  );
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    return first(await db.insert(users).values(user).returning())!;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return first(await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())));
  }

  async getUserById(id: number): Promise<User | undefined> {
    return first(await db.select().from(users).where(eq(users.id, id)));
  }

  async updateUserPassword(userId: number, passwordHash: string): Promise<User | undefined> {
    return first(
      await db
        .update(users)
        .set({ passwordHash, updatedAt: nowIso() })
        .where(eq(users.id, userId))
        .returning(),
    );
  }

  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    return first(await db.insert(passwordResetTokens).values(token).returning())!;
  }

  async consumePasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return db.transaction(async (tx) => {
      const current = first(
        await tx.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)),
      );

      if (!current) return undefined;
      if (current.usedAt) return undefined;
      if (new Date(current.expiresAt).getTime() < Date.now()) return undefined;

      return first(
        await tx
          .update(passwordResetTokens)
          .set({ usedAt: nowIso() })
          .where(eq(passwordResetTokens.id, current.id))
          .returning(),
      );
    });
  }

  async getOwnerPayoutAccount(ownerId: number): Promise<OwnerPayoutAccount | undefined> {
    return first(await db.select().from(ownerPayoutAccounts).where(eq(ownerPayoutAccounts.ownerId, ownerId)));
  }

  async upsertOwnerPayoutAccount(account: InsertOwnerPayoutAccount): Promise<OwnerPayoutAccount> {
    const existing = await this.getOwnerPayoutAccount(account.ownerId);

    if (!existing) {
      return first(await db.insert(ownerPayoutAccounts).values(account).returning())!;
    }

    return first(
      await db
        .update(ownerPayoutAccounts)
        .set({
          stripeAccountId: account.stripeAccountId,
          detailsSubmitted: account.detailsSubmitted,
          chargesEnabled: account.chargesEnabled,
          payoutsEnabled: account.payoutsEnabled,
          updatedAt: nowIso(),
        })
        .where(eq(ownerPayoutAccounts.id, existing.id))
        .returning(),
    )!;
  }

  async createNotificationEvent(event: InsertNotificationEvent): Promise<NotificationEvent> {
    return first(await db.insert(notificationEvents).values(event).returning())!;
  }

  async getAllLots(): Promise<ParkingLotWithSpots[]> {
    const lots = await db.select().from(parkingLots).where(eq(parkingLots.isArchived, false));
    return lotsWithAvailability(lots);
  }

  async getLotById(id: number): Promise<ParkingLotWithSpots | undefined> {
    const lot = first(
      await db
        .select()
        .from(parkingLots)
        .where(and(eq(parkingLots.id, id), eq(parkingLots.isArchived, false))),
    );

    if (!lot) return undefined;

    const spots = await db.select().from(parkingSpots).where(eq(parkingSpots.lotId, id));
    const availableSpots = spots.filter((spot) => spot.isAvailable).length;

    return { ...lot, availableSpots, spots };
  }

  async createLot(lot: InsertParkingLot): Promise<ParkingLot> {
    return first(await db.insert(parkingLots).values(lot).returning())!;
  }

  async getOwnerLots(ownerId: number): Promise<ParkingLotWithSpots[]> {
    const lots = await db
      .select()
      .from(parkingLots)
      .where(and(eq(parkingLots.ownerId, ownerId), eq(parkingLots.isArchived, false)));

    return lotsWithAvailability(lots);
  }

  async createOwnerLot(ownerId: number, lot: Omit<InsertParkingLot, "ownerId">): Promise<ParkingLotWithSpots> {
    return db.transaction(async (tx) => {
      const insertedLot = first(
        await tx
          .insert(parkingLots)
          .values({ ...lot, ownerId })
          .returning(),
      )!;

      for (let i = 1; i <= lot.totalSpots; i++) {
        await tx.insert(parkingSpots).values({
          lotId: insertedLot.id,
          spotNumber: `${i}`,
          isAvailable: true,
        });
      }

      const spots = await tx.select().from(parkingSpots).where(eq(parkingSpots.lotId, insertedLot.id));
      return { ...insertedLot, availableSpots: spots.length, spots };
    });
  }

  async updateOwnerLot(
    ownerId: number,
    lotId: number,
    updates: Partial<Omit<InsertParkingLot, "ownerId">> & { isArchived?: boolean },
  ): Promise<ParkingLotWithSpots | undefined> {
    return db.transaction(async (tx) => {
      const lot = first(
        await tx
          .select()
          .from(parkingLots)
          .where(and(eq(parkingLots.id, lotId), eq(parkingLots.ownerId, ownerId))),
      );

      if (!lot) {
        throw new StorageError(404, "Owner lot not found");
      }

      const spots = await tx.select().from(parkingSpots).where(eq(parkingSpots.lotId, lotId));

      if (typeof updates.totalSpots === "number") {
        const occupiedSpots = spots.filter((spot) => !spot.isAvailable).length;
        if (updates.totalSpots < occupiedSpots) {
          throw new StorageError(409, "Cannot reduce total spots below currently occupied spots");
        }

        if (updates.totalSpots > spots.length) {
          for (let i = spots.length + 1; i <= updates.totalSpots; i++) {
            await tx.insert(parkingSpots).values({
              lotId,
              spotNumber: `${i}`,
              isAvailable: true,
            });
          }
        }

        if (updates.totalSpots < spots.length) {
          const deletable = spots
            .filter((spot) => spot.isAvailable)
            .sort((a, b) => Number(b.spotNumber) - Number(a.spotNumber));
          const toDelete = spots.length - updates.totalSpots;

          if (deletable.length < toDelete) {
            throw new StorageError(409, "Not enough free spots to reduce inventory to requested size");
          }

          for (let i = 0; i < toDelete; i++) {
            await tx.delete(parkingSpots).where(eq(parkingSpots.id, deletable[i].id));
          }
        }
      }

      await tx.update(parkingLots).set(updates).where(eq(parkingLots.id, lotId));

      const updatedLot = first(await tx.select().from(parkingLots).where(eq(parkingLots.id, lotId)));
      if (!updatedLot) {
        return undefined;
      }

      const updatedSpots = await tx.select().from(parkingSpots).where(eq(parkingSpots.lotId, lotId));
      const availableSpots = updatedSpots.filter((spot) => spot.isAvailable).length;
      return { ...updatedLot, availableSpots, spots: updatedSpots };
    });
  }

  async getSpotsByLotId(lotId: number): Promise<ParkingSpot[]> {
    return db.select().from(parkingSpots).where(eq(parkingSpots.lotId, lotId));
  }

  async getSpotById(id: number): Promise<ParkingSpot | undefined> {
    return first(await db.select().from(parkingSpots).where(eq(parkingSpots.id, id)));
  }

  async createSpot(spot: InsertParkingSpot): Promise<ParkingSpot> {
    return first(await db.insert(parkingSpots).values(spot).returning())!;
  }

  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    return this.createPendingReservation(reservation);
  }

  async createPendingReservation(reservation: InsertReservation): Promise<Reservation> {
    return db.transaction(async (tx) => {
      const spot = first(await tx.select().from(parkingSpots).where(eq(parkingSpots.id, reservation.spotId)));
      if (!spot) {
        throw new StorageError(404, "Spot not found");
      }

      if (spot.lotId !== reservation.lotId) {
        throw new StorageError(400, "Spot does not belong to the selected lot");
      }

      const lockedSpot = first(
        await tx
          .update(parkingSpots)
          .set({ isAvailable: false })
          .where(and(eq(parkingSpots.id, reservation.spotId), eq(parkingSpots.isAvailable, true)))
          .returning(),
      );

      if (!lockedSpot) {
        throw new StorageError(409, "Spot is not available");
      }

      return first(
        await tx
          .insert(reservations)
          .values({
            ...reservation,
            status: "pending_payment",
            paymentStatus: "pending",
            ownerPayoutStatus: "pending",
          })
          .returning(),
      )!;
    });
  }

  async attachCheckoutSession(reservationId: number, checkoutSessionId: string): Promise<Reservation | undefined> {
    return first(
      await db
        .update(reservations)
        .set({ checkoutSessionId })
        .where(eq(reservations.id, reservationId))
        .returning(),
    );
  }

  async markReservationPaidByCheckoutSession(
    checkoutSessionId: string,
    paymentIntentId?: string,
  ): Promise<Reservation | undefined> {
    return db.transaction(async (tx) => {
      const existing = first(
        await tx.select().from(reservations).where(eq(reservations.checkoutSessionId, checkoutSessionId)),
      );

      if (!existing) return undefined;
      if (existing.status === "confirmed") return existing;

      return first(
        await tx
          .update(reservations)
          .set({
            status: "confirmed",
            paymentStatus: "paid",
            paymentIntentId: paymentIntentId ?? existing.paymentIntentId,
            ownerPayoutStatus: "payout_pending",
            confirmedAt: nowIso(),
          })
          .where(eq(reservations.id, existing.id))
          .returning(),
      );
    });
  }

  async markReservationPaymentFailedByCheckoutSession(checkoutSessionId: string): Promise<Reservation | undefined> {
    return db.transaction(async (tx) => {
      const existing = first(
        await tx.select().from(reservations).where(eq(reservations.checkoutSessionId, checkoutSessionId)),
      );

      if (!existing) return undefined;
      if (existing.status === "payment_failed") return existing;

      const updated = first(
        await tx
          .update(reservations)
          .set({ status: "payment_failed", paymentStatus: "failed" })
          .where(eq(reservations.id, existing.id))
          .returning(),
      );

      await tx.update(parkingSpots).set({ isAvailable: true }).where(eq(parkingSpots.id, existing.spotId));
      return updated;
    });
  }

  async getReservationsByEmail(email: string): Promise<Reservation[]> {
    return db.select().from(reservations).where(eq(reservations.guestEmail, email));
  }

  async getDriverReservations(driverUserId: number): Promise<ReservationWithDetails[]> {
    const rows = await db.select().from(reservations).where(eq(reservations.driverUserId, driverUserId));
    return enrichReservations(rows);
  }

  async getOwnerReservations(ownerId: number): Promise<ReservationWithDetails[]> {
    const ownerLots = await db.select({ id: parkingLots.id }).from(parkingLots).where(eq(parkingLots.ownerId, ownerId));
    if (ownerLots.length === 0) {
      return [];
    }

    const lotIds = ownerLots.map((lot) => lot.id);
    const rows = await db.select().from(reservations).where(inArray(reservations.lotId, lotIds));
    return enrichReservations(rows);
  }

  async getReservationById(id: number): Promise<Reservation | undefined> {
    return first(await db.select().from(reservations).where(eq(reservations.id, id)));
  }

  async cancelReservation(id: number): Promise<Reservation | undefined> {
    return db.transaction(async (tx) => {
      const existing = first(await tx.select().from(reservations).where(eq(reservations.id, id)));
      if (!existing) {
        throw new StorageError(404, "Reservation not found");
      }

      if (existing.status === "cancelled" || existing.status === "refunded") {
        throw new StorageError(409, "Reservation is already cancelled");
      }

      const updated = first(
        await tx
          .update(reservations)
          .set({
            status: "cancelled",
            paymentStatus: existing.paymentStatus === "paid" ? "paid" : "cancelled",
            cancelledAt: nowIso(),
          })
          .where(eq(reservations.id, id))
          .returning(),
      );

      await tx.update(parkingSpots).set({ isAvailable: true }).where(eq(parkingSpots.id, existing.spotId));
      return updated;
    });
  }

  async cancelDriverReservation(id: number, driverUserId: number, refundId?: string): Promise<CancellationResult> {
    return db.transaction(async (tx) => {
      const existing = first(await tx.select().from(reservations).where(eq(reservations.id, id)));
      if (!existing) {
        throw new StorageError(404, "Reservation not found");
      }

      if (existing.driverUserId !== driverUserId) {
        throw new StorageError(403, "You can only cancel your own reservations");
      }

      if (["cancelled", "refunded", "payment_failed"].includes(existing.status)) {
        throw new StorageError(409, "Reservation cannot be cancelled in its current status");
      }

      const deadline = new Date(existing.cancellationDeadline).getTime();
      const refundEligible = Number.isFinite(deadline) && Date.now() <= deadline;
      if (!refundEligible) {
        throw new StorageError(409, "Free cancellation window has passed (1 hour before start)");
      }

      const refundIssued = Boolean(refundId);
      const updated = first(
        await tx
          .update(reservations)
          .set({
            status: refundIssued ? "refunded" : "cancelled",
            paymentStatus: refundIssued ? "refunded" : "cancelled",
            refundId: refundId ?? null,
            cancelledAt: nowIso(),
            ownerPayoutStatus: refundIssued ? "pending" : existing.ownerPayoutStatus,
          })
          .where(eq(reservations.id, id))
          .returning(),
      );

      await tx.update(parkingSpots).set({ isAvailable: true }).where(eq(parkingSpots.id, existing.spotId));

      return {
        reservation: updated!,
        refundEligible,
        refundIssued,
      };
    });
  }

  async getOwnerAnalytics(ownerId: number): Promise<OwnerAnalytics> {
    const ownerLots = await db.select().from(parkingLots).where(eq(parkingLots.ownerId, ownerId));
    const lotIds = ownerLots.map((lot) => lot.id);

    const ownerReservations = lotIds.length
      ? await db.select().from(reservations).where(inArray(reservations.lotId, lotIds))
      : [];

    const grossRevenueCents = ownerReservations
      .filter((reservation) => reservation.paymentStatus === "paid" || reservation.paymentStatus === "refunded")
      .reduce((sum, reservation) => sum + reservation.amountCents, 0);

    const refundedCents = ownerReservations
      .filter((reservation) => reservation.paymentStatus === "refunded")
      .reduce((sum, reservation) => sum + reservation.amountCents, 0);

    const totalSpots = ownerLots.reduce((sum, lot) => sum + lot.totalSpots, 0);
    const occupiedSpots = lotIds.length
      ? (await db
          .select()
          .from(parkingSpots)
          .where(and(inArray(parkingSpots.lotId, lotIds), eq(parkingSpots.isAvailable, false)))).length
      : 0;

    return {
      totalLots: ownerLots.length,
      activeLots: ownerLots.filter((lot) => !lot.isArchived).length,
      totalReservations: ownerReservations.length,
      completedReservations: ownerReservations.filter((reservation) => reservation.status === "confirmed").length,
      grossRevenueCents,
      refundedCents,
      netRevenueCents: grossRevenueCents - refundedCents,
      occupiedSpots,
      totalSpots,
    };
  }
}

export const storage = new DatabaseStorage();
