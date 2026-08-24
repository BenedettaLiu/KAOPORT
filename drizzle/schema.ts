import { boolean, index, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Last successful official KHH vessel snapshot, retained across server cold starts. */
export const shipDataCaches = mysqlTable("ship_data_caches", {
  cacheKey: varchar("cacheKey", { length: 64 }).primaryKey(),
  payload: mediumtext("payload").notNull(),
  source: varchar("source", { length: 24 }).notNull(),
  notice: text("notice"),
  syncedAt: timestamp("syncedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShipDataCache = typeof shipDataCaches.$inferSelect;

/** Anonymous per-device preferences for favorite-vessel push notifications. */
export const shipPushSubscriptions = mysqlTable("ship_push_subscriptions", {
  deviceId: varchar("deviceId", { length: 80 }).primaryKey(),
  expoPushToken: varchar("expoPushToken", { length: 255 }).notNull(),
  favoriteShipIds: mediumtext("favoriteShipIds").notNull(),
  statusSnapshot: mediumtext("statusSnapshot").notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("ship_push_subscriptions_enabled_idx").on(table.notificationsEnabled)]);

export type ShipPushSubscription = typeof shipPushSubscriptions.$inferSelect;

/** Persists the platform-issued identifier used to manage the project-level ten-minute sync job. */
export const shipSyncSchedules = mysqlTable("ship_sync_schedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  taskUid: varchar("taskUid", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShipSyncSchedule = typeof shipSyncSchedules.$inferSelect;
