import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { User, UserRole } from "@shared/schema";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: User;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const computed = scryptSync(password, salt, 64);
  const existing = Buffer.from(hash, "hex");

  if (computed.length !== existing.length) return false;
  return timingSafeEqual(computed, existing);
}

export function createSecureToken(): string {
  return randomBytes(24).toString("hex");
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = await storage.getUserById(userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Session is invalid" });
  }

  req.authUser = user;
  next();
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (req.authUser.role !== role) {
      return res.status(403).json({ message: `${role} role is required` });
    }

    next();
  };
}

export async function attachSessionUser(req: Request, _res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (userId) {
    const user = await storage.getUserById(userId);
    if (user) {
      req.authUser = user;
    }
  }

  next();
}
