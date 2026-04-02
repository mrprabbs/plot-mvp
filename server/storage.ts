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
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { and, eq, inArray } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

function hasColumn(tableName: string, columnName: string): boolean {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((col) => col.name === columnName);
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  if (!hasColumn(tableName, columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS owner_payout_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      stripe_account_id TEXT NOT NULL UNIQUE,
      details_submitted INTEGER NOT NULL DEFAULT 0,
      charges_enabled INTEGER NOT NULL DEFAULT 0,
      payouts_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parking_lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      description TEXT,
      price_per_hour INTEGER NOT NULL,
      total_spots INTEGER NOT NULL,
      operating_hours_open TEXT NOT NULL,
      operating_hours_close TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parking_spots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id),
      spot_number TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      UNIQUE(lot_id, spot_number)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spot_id INTEGER NOT NULL REFERENCES parking_spots(id),
      lot_id INTEGER NOT NULL REFERENCES parking_lots(id),
      driver_user_id INTEGER REFERENCES users(id),
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      cancellation_deadline TEXT NOT NULL,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      platform_fee_cents INTEGER NOT NULL DEFAULT 0,
      owner_payout_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      checkout_session_id TEXT,
      payment_intent_id TEXT,
      refund_id TEXT,
      owner_payout_status TEXT NOT NULL DEFAULT 'pending',
      cancelled_at TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  ensureColumn("parking_lots", "owner_id", "INTEGER REFERENCES users(id)");
  ensureColumn("parking_lots", "is_archived", "INTEGER NOT NULL DEFAULT 0");

  ensureColumn("reservations", "driver_user_id", "INTEGER REFERENCES users(id)");
  ensureColumn("reservations", "cancellation_deadline", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("reservations", "amount_cents", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("reservations", "platform_fee_cents", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("reservations", "owner_payout_cents", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("reservations", "payment_status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn("reservations", "checkout_session_id", "TEXT");
  ensureColumn("reservations", "payment_intent_id", "TEXT");
  ensureColumn("reservations", "refund_id", "TEXT");
  ensureColumn("reservations", "owner_payout_status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn("reservations", "cancelled_at", "TEXT");
  ensureColumn("reservations", "confirmed_at", "TEXT");
}

initializeDatabase();

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
  // Auth and users
  createUser(user: InsertUser): User;
  getUserByEmail(email: string): User | undefined;
  getUserById(id: number): User | undefined;
  updateUserPassword(userId: number, passwordHash: string): User | undefined;

  // Password reset
  createPasswordResetToken(token: InsertPasswordResetToken): PasswordResetToken;
  consumePasswordResetToken(token: string): PasswordResetToken | undefined;

  // Owner payout
  getOwnerPayoutAccount(ownerId: number): OwnerPayoutAccount | undefined;
  upsertOwnerPayoutAccount(account: InsertOwnerPayoutAccount): OwnerPayoutAccount;

  // Notifications
  createNotificationEvent(event: InsertNotificationEvent): NotificationEvent;

  // Lots
  getAllLots(): ParkingLotWithSpots[];
  getLotById(id: number): ParkingLotWithSpots | undefined;
  createLot(lot: InsertParkingLot): ParkingLot;
  getOwnerLots(ownerId: number): ParkingLotWithSpots[];
  createOwnerLot(ownerId: number, lot: Omit<InsertParkingLot, "ownerId">): ParkingLotWithSpots;
  updateOwnerLot(ownerId: number, lotId: number, updates: Partial<Omit<InsertParkingLot, "ownerId">> & { isArchived?: boolean }): ParkingLotWithSpots | undefined;

  // Spots
  getSpotsByLotId(lotId: number): ParkingSpot[];
  getSpotById(id: number): ParkingSpot | undefined;
  createSpot(spot: InsertParkingSpot): ParkingSpot;

  // Reservations
  createReservation(reservation: InsertReservation): Reservation;
  createPendingReservation(reservation: InsertReservation): Reservation;
  attachCheckoutSession(reservationId: number, checkoutSessionId: string): Reservation | undefined;
  markReservationPaidByCheckoutSession(checkoutSessionId: string, paymentIntentId?: string): Reservation | undefined;
  markReservationPaymentFailedByCheckoutSession(checkoutSessionId: string): Reservation | undefined;
  getReservationsByEmail(email: string): Reservation[];
  getDriverReservations(driverUserId: number): ReservationWithDetails[];
  getOwnerReservations(ownerId: number): ReservationWithDetails[];
  getReservationById(id: number): Reservation | undefined;
  cancelReservation(id: number): Reservation | undefined;
  cancelDriverReservation(id: number, driverUserId: number, refundId?: string): CancellationResult;

  // Analytics
  getOwnerAnalytics(ownerId: number): OwnerAnalytics;
}

function lotsWithAvailability(lots: ParkingLot[]): ParkingLotWithSpots[] {
  return lots.map((lot) => {
    const spots = db
      .select()
      .from(parkingSpots)
      .where(eq(parkingSpots.lotId, lot.id))
      .all();
    const availableSpots = spots.filter((s) => s.isAvailable).length;
    return { ...lot, availableSpots };
  });
}

function enrichReservations(resList: Reservation[]): ReservationWithDetails[] {
  return resList.map((reservation) => {
    const lot = db.select().from(parkingLots).where(eq(parkingLots.id, reservation.lotId)).get();
    const spot = db.select().from(parkingSpots).where(eq(parkingSpots.id, reservation.spotId)).get();

    return {
      ...reservation,
      lotName: lot?.name ?? "Unknown",
      lotAddress: lot?.address ?? "Unknown",
      spotNumber: spot?.spotNumber ?? "Unknown",
    };
  });
}

export class DatabaseStorage implements IStorage {
  createUser(user: InsertUser): User {
    return db.insert(users).values(user).returning().get();
  }

  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get();
  }

  getUserById(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  updateUserPassword(userId: number, passwordHash: string): User | undefined {
    return db
      .update(users)
      .set({ passwordHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId))
      .returning()
      .get();
  }

  createPasswordResetToken(token: InsertPasswordResetToken): PasswordResetToken {
    return db.insert(passwordResetTokens).values(token).returning().get();
  }

  consumePasswordResetToken(token: string): PasswordResetToken | undefined {
    const now = new Date().toISOString();

    const tx = sqlite.transaction((inputToken: string) => {
      const current = db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, inputToken))
        .get();

      if (!current) return undefined;
      if (current.usedAt) return undefined;
      if (new Date(current.expiresAt).getTime() < Date.now()) return undefined;

      return db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, current.id))
        .returning()
        .get();
    });

    return tx(token);
  }

  getOwnerPayoutAccount(ownerId: number): OwnerPayoutAccount | undefined {
    return db.select().from(ownerPayoutAccounts).where(eq(ownerPayoutAccounts.ownerId, ownerId)).get();
  }

  upsertOwnerPayoutAccount(account: InsertOwnerPayoutAccount): OwnerPayoutAccount {
    const existing = this.getOwnerPayoutAccount(account.ownerId);

    if (!existing) {
      return db.insert(ownerPayoutAccounts).values(account).returning().get();
    }

    return db
      .update(ownerPayoutAccounts)
      .set({
        stripeAccountId: account.stripeAccountId,
        detailsSubmitted: account.detailsSubmitted,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ownerPayoutAccounts.id, existing.id))
      .returning()
      .get();
  }

  createNotificationEvent(event: InsertNotificationEvent): NotificationEvent {
    return db.insert(notificationEvents).values(event).returning().get();
  }

  getAllLots(): ParkingLotWithSpots[] {
    const lots = db.select().from(parkingLots).where(eq(parkingLots.isArchived, false)).all();
    return lotsWithAvailability(lots);
  }

  getLotById(id: number): ParkingLotWithSpots | undefined {
    const lot = db
      .select()
      .from(parkingLots)
      .where(and(eq(parkingLots.id, id), eq(parkingLots.isArchived, false)))
      .get();
    if (!lot) return undefined;
    const spots = db
      .select()
      .from(parkingSpots)
      .where(eq(parkingSpots.lotId, id))
      .all();
    const availableSpots = spots.filter((s) => s.isAvailable).length;
    return { ...lot, availableSpots, spots };
  }

  createLot(lot: InsertParkingLot): ParkingLot {
    return db.insert(parkingLots).values(lot).returning().get();
  }

  getOwnerLots(ownerId: number): ParkingLotWithSpots[] {
    const lots = db
      .select()
      .from(parkingLots)
      .where(and(eq(parkingLots.ownerId, ownerId), eq(parkingLots.isArchived, false)))
      .all();

    return lotsWithAvailability(lots);
  }

  createOwnerLot(ownerId: number, lot: Omit<InsertParkingLot, "ownerId">): ParkingLotWithSpots {
    const tx = sqlite.transaction((input: Omit<InsertParkingLot, "ownerId">) => {
      const insertedLot = db
        .insert(parkingLots)
        .values({ ...input, ownerId })
        .returning()
        .get();

      for (let i = 1; i <= input.totalSpots; i++) {
        db.insert(parkingSpots)
          .values({
            lotId: insertedLot.id,
            spotNumber: `${i}`,
            isAvailable: true,
          })
          .run();
      }

      const lotWithSpots = this.getLotById(insertedLot.id);
      if (!lotWithSpots) {
        throw new StorageError(500, "Failed to create owner lot");
      }

      return lotWithSpots;
    });

    return tx(lot);
  }

  updateOwnerLot(
    ownerId: number,
    lotId: number,
    updates: Partial<Omit<InsertParkingLot, "ownerId">> & { isArchived?: boolean },
  ): ParkingLotWithSpots | undefined {
    const tx = sqlite.transaction((inputUpdates: Partial<Omit<InsertParkingLot, "ownerId">> & { isArchived?: boolean }) => {
      const lot = db
        .select()
        .from(parkingLots)
        .where(and(eq(parkingLots.id, lotId), eq(parkingLots.ownerId, ownerId)))
        .get();

      if (!lot) {
        throw new StorageError(404, "Owner lot not found");
      }

      if (typeof inputUpdates.totalSpots === "number") {
        const spots = this.getSpotsByLotId(lotId);
        const occupiedSpots = spots.filter((spot) => !spot.isAvailable).length;

        if (inputUpdates.totalSpots < occupiedSpots) {
          throw new StorageError(409, "Cannot reduce total spots below currently occupied spots");
        }

        if (inputUpdates.totalSpots > spots.length) {
          for (let i = spots.length + 1; i <= inputUpdates.totalSpots; i++) {
            db.insert(parkingSpots)
              .values({
                lotId,
                spotNumber: `${i}`,
                isAvailable: true,
              })
              .run();
          }
        }

        if (inputUpdates.totalSpots < spots.length) {
          const deletable = spots
            .filter((spot) => spot.isAvailable)
            .sort((a, b) => Number(b.spotNumber) - Number(a.spotNumber));

          const toDelete = spots.length - inputUpdates.totalSpots;

          if (deletable.length < toDelete) {
            throw new StorageError(409, "Not enough free spots to reduce inventory to requested size");
          }

          for (let i = 0; i < toDelete; i++) {
            db.delete(parkingSpots).where(eq(parkingSpots.id, deletable[i].id)).run();
          }
        }
      }

      db.update(parkingLots)
        .set({
          ...inputUpdates,
        })
        .where(eq(parkingLots.id, lotId))
        .run();

      return this.getLotById(lotId);
    });

    return tx(updates);
  }

  getSpotsByLotId(lotId: number): ParkingSpot[] {
    return db
      .select()
      .from(parkingSpots)
      .where(eq(parkingSpots.lotId, lotId))
      .all();
  }

  getSpotById(id: number): ParkingSpot | undefined {
    return db
      .select()
      .from(parkingSpots)
      .where(eq(parkingSpots.id, id))
      .get();
  }

  createSpot(spot: InsertParkingSpot): ParkingSpot {
    return db.insert(parkingSpots).values(spot).returning().get();
  }

  createReservation(reservation: InsertReservation): Reservation {
    return this.createPendingReservation(reservation);
  }

  createPendingReservation(reservation: InsertReservation): Reservation {
    const tx = sqlite.transaction((input: InsertReservation) => {
      const spot = db
        .select()
        .from(parkingSpots)
        .where(eq(parkingSpots.id, input.spotId))
        .get();

      if (!spot) {
        throw new StorageError(404, "Spot not found");
      }

      if (spot.lotId !== input.lotId) {
        throw new StorageError(400, "Spot does not belong to the selected lot");
      }

      if (!spot.isAvailable) {
        throw new StorageError(409, "Spot is not available");
      }

      const inserted = db
        .insert(reservations)
        .values({
          ...input,
          status: "pending_payment",
          paymentStatus: "pending",
          ownerPayoutStatus: "pending",
        })
        .returning()
        .get();

      db.update(parkingSpots)
        .set({ isAvailable: false })
        .where(eq(parkingSpots.id, input.spotId))
        .run();

      return inserted;
    });

    return tx(reservation);
  }

  attachCheckoutSession(reservationId: number, checkoutSessionId: string): Reservation | undefined {
    return db
      .update(reservations)
      .set({ checkoutSessionId })
      .where(eq(reservations.id, reservationId))
      .returning()
      .get();
  }

  markReservationPaidByCheckoutSession(checkoutSessionId: string, paymentIntentId?: string): Reservation | undefined {
    const tx = sqlite.transaction((sessionId: string, intentId?: string) => {
      const existing = db
        .select()
        .from(reservations)
        .where(eq(reservations.checkoutSessionId, sessionId))
        .get();

      if (!existing) return undefined;
      if (existing.status === "confirmed") return existing;

      return db
        .update(reservations)
        .set({
          status: "confirmed",
          paymentStatus: "paid",
          paymentIntentId: intentId ?? existing.paymentIntentId,
          ownerPayoutStatus: "payout_pending",
          confirmedAt: new Date().toISOString(),
        })
        .where(eq(reservations.id, existing.id))
        .returning()
        .get();
    });

    return tx(checkoutSessionId, paymentIntentId);
  }

  markReservationPaymentFailedByCheckoutSession(checkoutSessionId: string): Reservation | undefined {
    const tx = sqlite.transaction((sessionId: string) => {
      const existing = db
        .select()
        .from(reservations)
        .where(eq(reservations.checkoutSessionId, sessionId))
        .get();

      if (!existing) return undefined;
      if (existing.status === "payment_failed") return existing;

      const updated = db
        .update(reservations)
        .set({
          status: "payment_failed",
          paymentStatus: "failed",
        })
        .where(eq(reservations.id, existing.id))
        .returning()
        .get();

      db.update(parkingSpots)
        .set({ isAvailable: true })
        .where(eq(parkingSpots.id, existing.spotId))
        .run();

      return updated;
    });

    return tx(checkoutSessionId);
  }

  getReservationsByEmail(email: string): Reservation[] {
    return db
      .select()
      .from(reservations)
      .where(eq(reservations.guestEmail, email))
      .all();
  }

  getDriverReservations(driverUserId: number): ReservationWithDetails[] {
    const rows = db
      .select()
      .from(reservations)
      .where(eq(reservations.driverUserId, driverUserId))
      .all();

    return enrichReservations(rows);
  }

  getOwnerReservations(ownerId: number): ReservationWithDetails[] {
    const ownerLots = db
      .select({ id: parkingLots.id })
      .from(parkingLots)
      .where(eq(parkingLots.ownerId, ownerId))
      .all();

    if (ownerLots.length === 0) {
      return [];
    }

    const lotIds = ownerLots.map((lot) => lot.id);

    const rows = db
      .select()
      .from(reservations)
      .where(inArray(reservations.lotId, lotIds))
      .all();

    return enrichReservations(rows);
  }

  getReservationById(id: number): Reservation | undefined {
    return db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id))
      .get();
  }

  cancelReservation(id: number): Reservation | undefined {
    const tx = sqlite.transaction((reservationId: number) => {
      const existing = this.getReservationById(reservationId);
      if (!existing) {
        throw new StorageError(404, "Reservation not found");
      }

      if (existing.status === "cancelled" || existing.status === "refunded") {
        throw new StorageError(409, "Reservation is already cancelled");
      }

      const updated = db
        .update(reservations)
        .set({
          status: "cancelled",
          paymentStatus: existing.paymentStatus === "paid" ? "paid" : "cancelled",
          cancelledAt: new Date().toISOString(),
        })
        .where(eq(reservations.id, reservationId))
        .returning()
        .get();

      db.update(parkingSpots)
        .set({ isAvailable: true })
        .where(eq(parkingSpots.id, existing.spotId))
        .run();

      return updated;
    });

    return tx(id);
  }

  cancelDriverReservation(id: number, driverUserId: number, refundId?: string): CancellationResult {
    const tx = sqlite.transaction((reservationId: number, actorId: number, issuedRefundId?: string) => {
      const existing = this.getReservationById(reservationId);
      if (!existing) {
        throw new StorageError(404, "Reservation not found");
      }

      if (existing.driverUserId !== actorId) {
        throw new StorageError(403, "You can only cancel your own reservations");
      }

      if (["cancelled", "refunded", "payment_failed"].includes(existing.status)) {
        throw new StorageError(409, "Reservation cannot be cancelled in its current status");
      }

      const now = Date.now();
      const deadline = new Date(existing.cancellationDeadline).getTime();
      const refundEligible = Number.isFinite(deadline) && now <= deadline;

      if (!refundEligible) {
        throw new StorageError(409, "Free cancellation window has passed (1 hour before start)");
      }

      const refundIssued = Boolean(issuedRefundId);

      const updated = db
        .update(reservations)
        .set({
          status: refundIssued ? "refunded" : "cancelled",
          paymentStatus: refundIssued ? "refunded" : "cancelled",
          refundId: issuedRefundId ?? null,
          cancelledAt: new Date().toISOString(),
          ownerPayoutStatus: refundIssued ? "pending" : existing.ownerPayoutStatus,
        })
        .where(eq(reservations.id, reservationId))
        .returning()
        .get();

      db.update(parkingSpots)
        .set({ isAvailable: true })
        .where(eq(parkingSpots.id, existing.spotId))
        .run();

      return {
        reservation: updated,
        refundEligible,
        refundIssued,
      };
    });

    return tx(id, driverUserId, refundId);
  }

  getOwnerAnalytics(ownerId: number): OwnerAnalytics {
    const ownerLots = db.select().from(parkingLots).where(eq(parkingLots.ownerId, ownerId)).all();
    const lotIds = ownerLots.map((lot) => lot.id);

    const ownerReservations = lotIds.length
      ? db
          .select()
          .from(reservations)
          .where(inArray(reservations.lotId, lotIds))
          .all()
      : [];

    const grossRevenueCents = ownerReservations
      .filter((reservation) => reservation.paymentStatus === "paid" || reservation.paymentStatus === "refunded")
      .reduce((sum, reservation) => sum + reservation.amountCents, 0);

    const refundedCents = ownerReservations
      .filter((reservation) => reservation.paymentStatus === "refunded")
      .reduce((sum, reservation) => sum + reservation.amountCents, 0);

    const totalSpots = ownerLots.reduce((sum, lot) => sum + lot.totalSpots, 0);
    const occupiedSpots = lotIds.length
      ? db
          .select()
          .from(parkingSpots)
          .where(and(inArray(parkingSpots.lotId, lotIds), eq(parkingSpots.isAvailable, false)))
          .all().length
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
