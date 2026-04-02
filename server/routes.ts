import type { Express } from "express";
import type { Server } from "http";
import type Stripe from "stripe";
import { z } from "zod";
import { StorageError, storage } from "./storage";
import {
  insertParkingLotSchema,
  insertReservationSchema,
  updateOwnerLotSchema,
  userRoleSchema,
} from "@shared/schema";
import {
  createSecureToken,
  hashPassword,
  requireAuth,
  requireRole,
  toPublicUser,
  verifyPassword,
} from "./auth";
import {
  calculateBookingAmountCents,
  calculatePlatformFeeCents,
  getAppBaseUrl,
  getWebhookSecret,
  stripe,
} from "./payments";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: userRoleSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const checkoutSchema = z.object({
  lotId: z.number().int().positive(),
  spotId: z.number().int().positive(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

const createOwnerLotSchema = insertParkingLotSchema.omit({
  ownerId: true,
});

function parseNumericId(value: string, fieldName: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new StorageError(400, `Invalid ${fieldName}`);
  }
  return parsed;
}

function assertStripeConfigured() {
  if (!stripe) {
    throw new StorageError(503, "Stripe is not configured. Add STRIPE_SECRET_KEY to continue.");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Auth
  app.post("/api/auth/register", (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid registration payload", errors: parsed.error.flatten() });
    }

    const email = parsed.data.email.toLowerCase().trim();

    if (storage.getUserByEmail(email)) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = storage.createUser({
      fullName: parsed.data.fullName,
      email,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
    });

    req.session.userId = user.id;

    return res.status(201).json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload", errors: parsed.error.flatten() });
    }

    const user = storage.getUserByEmail(parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    req.session.userId = user.id;
    return res.json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ message: "Failed to end session" });
      }
      return res.json({ ok: true });
    });
  });

  app.get("/api/auth/session", (req, res) => {
    if (!req.authUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    return res.json({ user: toPublicUser(req.authUser) });
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    }

    const user = storage.getUserByEmail(parsed.data.email);
    if (!user) {
      return res.json({
        message: "If this email exists, a reset link has been generated.",
      });
    }

    const token = createSecureToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

    storage.createPasswordResetToken({
      userId: user.id,
      token,
      expiresAt,
      usedAt: null,
    });

    return res.json({
      message: "Password reset token generated (MVP test mode).",
      resetToken: token,
      expiresAt,
    });
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    }

    const tokenRecord = storage.consumePasswordResetToken(parsed.data.token);
    if (!tokenRecord) {
      return res.status(400).json({ message: "Reset token is invalid or expired" });
    }

    const updated = storage.updateUserPassword(tokenRecord.userId, hashPassword(parsed.data.password));
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ ok: true });
  });

  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    }

    const user = req.authUser!;
    if (!verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const updated = storage.updateUserPassword(user.id, hashPassword(parsed.data.newPassword));
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: toPublicUser(updated) });
  });

  // Public lots
  app.get("/api/lots", (_req, res) => {
    const lots = storage.getAllLots();
    res.json(lots);
  });

  app.get("/api/lots/:id", (req, res) => {
    try {
      const id = parseNumericId(req.params.id, "lot ID");
      const lot = storage.getLotById(id);
      if (!lot) {
        return res.status(404).json({ message: "Lot not found" });
      }
      return res.json(lot);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/spots/:lotId", (req, res) => {
    try {
      const lotId = parseNumericId(req.params.lotId, "lot ID");
      const spots = storage.getSpotsByLotId(lotId);
      return res.json(spots);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  // Owner routes
  app.get("/api/owner/lots", requireAuth, requireRole("owner"), (req, res) => {
    const lots = storage.getOwnerLots(req.authUser!.id);
    return res.json(lots);
  });

  app.post("/api/owner/lots", requireAuth, requireRole("owner"), (req, res) => {
    const parsed = createOwnerLotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid lot data", errors: parsed.error.flatten() });
    }

    try {
      const lot = storage.createOwnerLot(req.authUser!.id, parsed.data);
      return res.status(201).json(lot);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.patch("/api/owner/lots/:id", requireAuth, requireRole("owner"), (req, res) => {
    const parsed = updateOwnerLotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid update payload", errors: parsed.error.flatten() });
    }

    try {
      const lotId = parseNumericId(String(req.params.id), "lot ID");
      const updated = storage.updateOwnerLot(req.authUser!.id, lotId, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: "Lot not found" });
      }

      return res.json(updated);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/owner/reservations", requireAuth, requireRole("owner"), (req, res) => {
    const ownerReservations = storage.getOwnerReservations(req.authUser!.id);
    return res.json(ownerReservations);
  });

  app.get("/api/owner/analytics", requireAuth, requireRole("owner"), (req, res) => {
    const analytics = storage.getOwnerAnalytics(req.authUser!.id);
    return res.json(analytics);
  });

  // Driver reservations
  app.get("/api/driver/reservations", requireAuth, requireRole("driver"), (req, res) => {
    const reservations = storage.getDriverReservations(req.authUser!.id);
    return res.json(reservations);
  });

  // Payment + booking
  app.post("/api/payments/connect/onboarding-link", requireAuth, requireRole("owner"), async (req, res) => {
    try {
      assertStripeConfigured();
      const activeStripe = stripe!;
      const owner = req.authUser!;

      let payout = storage.getOwnerPayoutAccount(owner.id);

      if (!payout) {
        const account = await activeStripe.accounts.create({
          type: "express",
          email: owner.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            ownerUserId: String(owner.id),
          },
        });

        payout = storage.upsertOwnerPayoutAccount({
          ownerId: owner.id,
          stripeAccountId: account.id,
          detailsSubmitted: account.details_submitted ?? false,
          chargesEnabled: account.charges_enabled ?? false,
          payoutsEnabled: account.payouts_enabled ?? false,
        });
      }

      const baseUrl = getAppBaseUrl();
      const accountLink = await activeStripe.accountLinks.create({
        account: payout.stripeAccountId,
        refresh_url: `${baseUrl}/#/owner?connect=retry`,
        return_url: `${baseUrl}/#/owner?connect=done`,
        type: "account_onboarding",
      });

      return res.json({
        url: accountLink.url,
        stripeAccountId: payout.stripeAccountId,
      });
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/payments/connect/status", requireAuth, requireRole("owner"), async (req, res) => {
    try {
      assertStripeConfigured();
      const activeStripe = stripe!;
      const ownerId = req.authUser!.id;

      const payout = storage.getOwnerPayoutAccount(ownerId);
      if (!payout) {
        return res.status(404).json({ message: "Owner payout account not found" });
      }

      const account = await activeStripe.accounts.retrieve(payout.stripeAccountId);
      const updated = storage.upsertOwnerPayoutAccount({
        ownerId,
        stripeAccountId: payout.stripeAccountId,
        detailsSubmitted: account.details_submitted ?? false,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
      });

      return res.json({
        stripeAccountId: updated.stripeAccountId,
        detailsSubmitted: updated.detailsSubmitted,
        chargesEnabled: updated.chargesEnabled,
        payoutsEnabled: updated.payoutsEnabled,
      });
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/payments/checkout-session", requireAuth, requireRole("driver"), async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid checkout payload", errors: parsed.error.flatten() });
    }

    try {
      assertStripeConfigured();
      const activeStripe = stripe!;
      const driver = req.authUser!;

      const lot = storage.getLotById(parsed.data.lotId);
      if (!lot) {
        return res.status(404).json({ message: "Lot not found" });
      }

      if (!lot.ownerId) {
        return res.status(409).json({ message: "Lot does not have a payout owner configured" });
      }

      const payout = storage.getOwnerPayoutAccount(lot.ownerId);
      if (!payout || !payout.chargesEnabled) {
        return res.status(409).json({ message: "Owner payout onboarding is not complete" });
      }

      const amountCents = calculateBookingAmountCents(
        parsed.data.startTime,
        parsed.data.endTime,
        lot.pricePerHour,
      );
      const platformFeeCents = calculatePlatformFeeCents(amountCents);
      const ownerPayoutCents = amountCents - platformFeeCents;

      const cancellationDeadline = new Date(new Date(parsed.data.startTime).getTime() - 1000 * 60 * 60).toISOString();

      const reservationPayload = insertReservationSchema.parse({
        spotId: parsed.data.spotId,
        lotId: parsed.data.lotId,
        driverUserId: driver.id,
        guestName: driver.fullName,
        guestEmail: driver.email,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        cancellationDeadline,
        amountCents,
        platformFeeCents,
        ownerPayoutCents,
        checkoutSessionId: null,
      });

      const reservation = storage.createPendingReservation(reservationPayload);

      try {
        const baseUrl = getAppBaseUrl();

        const session = await activeStripe.checkout.sessions.create({
          mode: "payment",
          customer_email: driver.email,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: amountCents,
                product_data: {
                  name: `Parking at ${lot.name}`,
                  description: `${parsed.data.startTime} to ${parsed.data.endTime}`,
                },
              },
            },
          ],
          payment_intent_data: {
            application_fee_amount: platformFeeCents,
            transfer_data: {
              destination: payout.stripeAccountId,
            },
            metadata: {
              reservationId: String(reservation.id),
              lotId: String(lot.id),
              spotId: String(parsed.data.spotId),
              driverUserId: String(driver.id),
            },
          },
          metadata: {
            reservationId: String(reservation.id),
            lotId: String(lot.id),
            spotId: String(parsed.data.spotId),
            driverUserId: String(driver.id),
          },
          success_url: `${baseUrl}/#/bookings?checkout=success`,
          cancel_url: `${baseUrl}/#/lot/${lot.id}?checkout=cancelled`,
        });

        storage.attachCheckoutSession(reservation.id, session.id);

        storage.createNotificationEvent({
          userId: driver.id,
          eventType: "booking.checkout.created",
          payload: JSON.stringify({ reservationId: reservation.id, checkoutSessionId: session.id }),
          deliveryStatus: "queued",
        });

        return res.status(201).json({
          reservationId: reservation.id,
          checkoutSessionId: session.id,
          checkoutUrl: session.url,
        });
      } catch (stripeError) {
        storage.cancelReservation(reservation.id);
        throw stripeError;
      }
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/webhooks/stripe", async (req, res) => {
    try {
      assertStripeConfigured();
      const activeStripe = stripe!;

      const webhookSecret = getWebhookSecret();
      const signature = req.headers["stripe-signature"];
      const rawBody = req.rawBody;

      if (!webhookSecret) {
        return res.status(503).json({ message: "Stripe webhook secret is not configured" });
      }

      if (typeof signature !== "string") {
        return res.status(400).json({ message: "Missing Stripe signature" });
      }

      if (!(rawBody instanceof Buffer)) {
        return res.status(400).json({ message: "Missing raw webhook body" });
      }

      const event = activeStripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const paymentIntentId =
            typeof session.payment_intent === "string" ? session.payment_intent : undefined;

          const updated = storage.markReservationPaidByCheckoutSession(session.id, paymentIntentId);
          if (updated?.driverUserId) {
            storage.createNotificationEvent({
              userId: updated.driverUserId,
              eventType: "booking.payment.confirmed",
              payload: JSON.stringify({ reservationId: updated.id, checkoutSessionId: session.id }),
              deliveryStatus: "queued",
            });
          }
          break;
        }
        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          storage.markReservationPaymentFailedByCheckoutSession(session.id);
          break;
        }
        default:
          break;
      }

      return res.json({ received: true, type: event.type });
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  // Legacy endpoint for existing UI compatibility
  app.post("/api/lots", requireAuth, requireRole("owner"), (req, res) => {
    const parsed = createOwnerLotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid lot data", errors: parsed.error.flatten() });
    }

    try {
      const lot = storage.createOwnerLot(req.authUser!.id, parsed.data);
      return res.status(201).json(lot);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/reservations", (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ message: "Email query parameter is required" });
    }

    const userReservations = storage.getReservationsByEmail(email);
    const enriched = userReservations.map((r) => {
      const lot = storage.getLotById(r.lotId);
      const spot = storage.getSpotById(r.spotId);
      return {
        ...r,
        lotName: lot?.name ?? "Unknown",
        lotAddress: lot?.address ?? "Unknown",
        spotNumber: spot?.spotNumber ?? "Unknown",
      };
    });

    return res.json(enriched);
  });

  app.patch("/api/reservations/:id/cancel", requireAuth, async (req, res) => {
    try {
      const reservationId = parseNumericId(String(req.params.id), "reservation ID");
      const reservation = storage.getReservationById(reservationId);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      const actor = req.authUser!;
      if (reservation.driverUserId !== actor.id) {
        return res.status(403).json({ message: "You can only cancel your own reservation" });
      }

      let refundId: string | undefined;

      if (reservation.paymentStatus === "paid" && reservation.paymentIntentId) {
        assertStripeConfigured();
        const activeStripe = stripe!;

        const refund = await activeStripe.refunds.create({
          payment_intent: reservation.paymentIntentId,
          metadata: {
            reservationId: String(reservation.id),
            cancelledBy: String(actor.id),
          },
        });

        refundId = refund.id;
      }

      const result = storage.cancelDriverReservation(reservationId, actor.id, refundId);

      storage.createNotificationEvent({
        userId: actor.id,
        eventType: result.refundIssued ? "booking.cancelled.refunded" : "booking.cancelled",
        payload: JSON.stringify({ reservationId: result.reservation.id }),
        deliveryStatus: "queued",
      });

      return res.json(result);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  return httpServer;
}
