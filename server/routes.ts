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
  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid registration payload", errors: parsed.error.flatten() });
    }

    const email = parsed.data.email.toLowerCase().trim();
    if (await storage.getUserByEmail(email)) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await storage.createUser({
      fullName: parsed.data.fullName,
      email,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
    });

    req.session.userId = user.id;
    return res.status(201).json({ user: toPublicUser(user) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid login payload", errors: parsed.error.flatten() });
    }

    const user = await storage.getUserByEmail(parsed.data.email);
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

  app.post("/api/auth/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    }

    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user) {
      return res.json({
        message: "If this email exists, a reset link has been generated.",
      });
    }

    const token = createSecureToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

    await storage.createPasswordResetToken({
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

  app.post("/api/auth/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    }

    const tokenRecord = await storage.consumePasswordResetToken(parsed.data.token);
    if (!tokenRecord) {
      return res.status(400).json({ message: "Reset token is invalid or expired" });
    }

    const updated = await storage.updateUserPassword(tokenRecord.userId, hashPassword(parsed.data.password));
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ ok: true });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    }

    const user = req.authUser!;
    if (!verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const updated = await storage.updateUserPassword(user.id, hashPassword(parsed.data.newPassword));
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: toPublicUser(updated) });
  });

  app.get("/api/lots", async (_req, res) => {
    const lots = await storage.getAllLots();
    return res.json(lots);
  });

  app.get("/api/lots/:id", async (req, res) => {
    try {
      const id = parseNumericId(req.params.id, "lot ID");
      const lot = await storage.getLotById(id);
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

  app.get("/api/spots/:lotId", async (req, res) => {
    try {
      const lotId = parseNumericId(req.params.lotId, "lot ID");
      const spots = await storage.getSpotsByLotId(lotId);
      return res.json(spots);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/owner/lots", requireAuth, requireRole("owner"), async (req, res) => {
    const lots = await storage.getOwnerLots(req.authUser!.id);
    return res.json(lots);
  });

  app.post("/api/owner/lots", requireAuth, requireRole("owner"), async (req, res) => {
    const parsed = createOwnerLotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid lot data", errors: parsed.error.flatten() });
    }

    try {
      const lot = await storage.createOwnerLot(req.authUser!.id, parsed.data);
      return res.status(201).json(lot);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.patch("/api/owner/lots/:id", requireAuth, requireRole("owner"), async (req, res) => {
    const parsed = updateOwnerLotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid update payload", errors: parsed.error.flatten() });
    }

    try {
      const lotId = parseNumericId(String(req.params.id), "lot ID");
      const updated = await storage.updateOwnerLot(req.authUser!.id, lotId, parsed.data);
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

  app.get("/api/owner/reservations", requireAuth, requireRole("owner"), async (req, res) => {
    const ownerReservations = await storage.getOwnerReservations(req.authUser!.id);
    return res.json(ownerReservations);
  });

  app.get("/api/owner/analytics", requireAuth, requireRole("owner"), async (req, res) => {
    const analytics = await storage.getOwnerAnalytics(req.authUser!.id);
    return res.json(analytics);
  });

  app.get("/api/driver/reservations", requireAuth, requireRole("driver"), async (req, res) => {
    const reservations = await storage.getDriverReservations(req.authUser!.id);
    return res.json(reservations);
  });

  app.post("/api/payments/connect/onboarding-link", requireAuth, requireRole("owner"), async (req, res) => {
    try {
      assertStripeConfigured();
      const activeStripe = stripe!;
      const owner = req.authUser!;

      let payout = await storage.getOwnerPayoutAccount(owner.id);

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

        payout = await storage.upsertOwnerPayoutAccount({
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

      const payout = await storage.getOwnerPayoutAccount(ownerId);
      if (!payout) {
        return res.status(404).json({ message: "Owner payout account not found" });
      }

      const account = await activeStripe.accounts.retrieve(payout.stripeAccountId);
      const updated = await storage.upsertOwnerPayoutAccount({
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

      const lot = await storage.getLotById(parsed.data.lotId);
      if (!lot) {
        return res.status(404).json({ message: "Lot not found" });
      }

      if (!lot.ownerId) {
        return res.status(409).json({ message: "Lot does not have a payout owner configured" });
      }

      const payout = await storage.getOwnerPayoutAccount(lot.ownerId);
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

      const reservation = await storage.createPendingReservation(reservationPayload);

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

        await storage.attachCheckoutSession(reservation.id, session.id);
        await storage.createNotificationEvent({
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
        await storage.cancelReservation(reservation.id);
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
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
          const updated = await storage.markReservationPaidByCheckoutSession(session.id, paymentIntentId);
          if (updated?.driverUserId) {
            await storage.createNotificationEvent({
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
          await storage.markReservationPaymentFailedByCheckoutSession(session.id);
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

  app.post("/api/lots", requireAuth, requireRole("owner"), async (req, res) => {
    const parsed = createOwnerLotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid lot data", errors: parsed.error.flatten() });
    }

    try {
      const lot = await storage.createOwnerLot(req.authUser!.id, parsed.data);
      return res.status(201).json(lot);
    } catch (error) {
      if (error instanceof StorageError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  });

  app.get("/api/reservations", async (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ message: "Email query parameter is required" });
    }

    const userReservations = await storage.getReservationsByEmail(email);
    const enriched = await Promise.all(
      userReservations.map(async (reservation) => {
        const lot = await storage.getLotById(reservation.lotId);
        const spot = await storage.getSpotById(reservation.spotId);
        return {
          ...reservation,
          lotName: lot?.name ?? "Unknown",
          lotAddress: lot?.address ?? "Unknown",
          spotNumber: spot?.spotNumber ?? "Unknown",
        };
      }),
    );

    return res.json(enriched);
  });

  app.patch("/api/reservations/:id/cancel", requireAuth, async (req, res) => {
    try {
      const reservationId = parseNumericId(String(req.params.id), "reservation ID");
      const reservation = await storage.getReservationById(reservationId);
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

      const result = await storage.cancelDriverReservation(reservationId, actor.id, refundId);
      await storage.createNotificationEvent({
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
