import { pgTable, text, integer, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const ownerPayoutAccounts = pgTable("owner_payout_accounts", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id).unique(),
  stripeAccountId: text("stripe_account_id").notNull().unique(),
  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const notificationEvents = pgTable("notification_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  deliveryStatus: text("delivery_status").notNull().default("queued"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const parkingLots = pgTable("parking_lots", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").references(() => users.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  description: text("description"),
  pricePerHour: integer("price_per_hour").notNull(),
  totalSpots: integer("total_spots").notNull(),
  operatingHoursOpen: text("operating_hours_open").notNull(),
  operatingHoursClose: text("operating_hours_close").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const parkingSpots = pgTable("parking_spots", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => parkingLots.id),
  spotNumber: text("spot_number").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
});

export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  spotId: integer("spot_id").notNull().references(() => parkingSpots.id),
  lotId: integer("lot_id").notNull().references(() => parkingLots.id),
  driverUserId: integer("driver_user_id").references(() => users.id),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  cancellationDeadline: text("cancellation_deadline").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  ownerPayoutCents: integer("owner_payout_cents").notNull().default(0),
  status: text("status").notNull().default("pending_payment"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  checkoutSessionId: text("checkout_session_id"),
  paymentIntentId: text("payment_intent_id"),
  refundId: text("refund_id"),
  ownerPayoutStatus: text("owner_payout_status").notNull().default("pending"),
  cancelledAt: text("cancelled_at"),
  confirmedAt: text("confirmed_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const userRoleSchema = z.enum(["owner", "driver"]);
export const reservationStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "cancelled",
  "refunded",
  "payment_failed",
]);

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertOwnerPayoutAccountSchema = createInsertSchema(ownerPayoutAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertParkingLotSchema = createInsertSchema(parkingLots).omit({
  id: true,
  isArchived: true,
  createdAt: true,
});

export const insertNotificationEventSchema = createInsertSchema(notificationEvents).omit({
  id: true,
  createdAt: true,
});

export const updateOwnerLotSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(5).optional(),
  description: z.string().optional(),
  pricePerHour: z.number().min(50).max(10000).optional(),
  totalSpots: z.number().int().min(1).max(500).optional(),
  operatingHoursOpen: z.string().optional(),
  operatingHoursClose: z.string().optional(),
  isArchived: z.boolean().optional(),
});

export const insertParkingSpotSchema = createInsertSchema(parkingSpots).omit({
  id: true,
});

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  status: true,
  paymentStatus: true,
  paymentIntentId: true,
  refundId: true,
  ownerPayoutStatus: true,
  cancelledAt: true,
  confirmedAt: true,
  createdAt: true,
}).superRefine((data, ctx) => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  const deadline = new Date(data.cancellationDeadline);

  if (Number.isNaN(start.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startTime"],
      message: "Start time must be a valid date-time",
    });
  }

  if (Number.isNaN(end.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "End time must be a valid date-time",
    });
  }

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "End time must be after start time",
    });
  }

  if (Number.isNaN(deadline.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cancellationDeadline"],
      message: "Cancellation deadline must be a valid date-time",
    });
  }

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(deadline.getTime()) && deadline > start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["cancellationDeadline"],
      message: "Cancellation deadline must be before start time",
    });
  }
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type OwnerPayoutAccount = typeof ownerPayoutAccounts.$inferSelect;
export type InsertOwnerPayoutAccount = z.infer<typeof insertOwnerPayoutAccountSchema>;
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type InsertNotificationEvent = z.infer<typeof insertNotificationEventSchema>;
export type ParkingLot = typeof parkingLots.$inferSelect;
export type InsertParkingLot = z.infer<typeof insertParkingLotSchema>;
export type ParkingSpot = typeof parkingSpots.$inferSelect;
export type InsertParkingSpot = z.infer<typeof insertParkingSpotSchema>;
export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

export type ParkingLotWithSpots = ParkingLot & {
  availableSpots: number;
  spots?: ParkingSpot[];
};

export type PublicUser = Omit<User, "passwordHash">;

export type ReservationWithDetails = Reservation & {
  lotName: string;
  lotAddress: string;
  spotNumber: string;
};
