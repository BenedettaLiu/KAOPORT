import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  shipDataCaches,
  shipPushSubscriptions,
  shipSyncSchedules,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

const SHIP_CACHE_KEY = "kaohsiung-port-official-v1";

export async function getOfficialShipCache() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shipDataCaches).where(eq(shipDataCaches.cacheKey, SHIP_CACHE_KEY)).limit(1);
  return result[0];
}

export async function saveOfficialShipCache(input: {
  payload: string;
  source: string;
  notice?: string;
  syncedAt: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const values = { cacheKey: SHIP_CACHE_KEY, ...input, notice: input.notice ?? null };
  await db.insert(shipDataCaches).values(values).onDuplicateKeyUpdate({
    set: {
      payload: values.payload,
      source: values.source,
      notice: values.notice,
      syncedAt: values.syncedAt,
      updatedAt: new Date(),
    },
  });
}

export type ShipPushSubscriptionInput = {
  deviceId: string;
  expoPushToken: string;
  favoriteShipIds: string[];
  notificationsEnabled?: boolean;
};

export async function upsertShipPushSubscription(input: ShipPushSubscriptionInput): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(shipPushSubscriptions).where(eq(shipPushSubscriptions.deviceId, input.deviceId)).limit(1);
  const favoriteShipIds = JSON.stringify([...new Set(input.favoriteShipIds)].slice(0, 500));
  const values = {
    deviceId: input.deviceId,
    expoPushToken: input.expoPushToken,
    favoriteShipIds,
    statusSnapshot: existing[0]?.statusSnapshot ?? "{}",
    notificationsEnabled: input.notificationsEnabled ?? true,
  };
  await db.insert(shipPushSubscriptions).values(values).onDuplicateKeyUpdate({
    set: {
      expoPushToken: values.expoPushToken,
      favoriteShipIds: values.favoriteShipIds,
      notificationsEnabled: values.notificationsEnabled,
      updatedAt: new Date(),
    },
  });
}

export async function getEnabledShipPushSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shipPushSubscriptions).where(eq(shipPushSubscriptions.notificationsEnabled, true));
}

export async function saveShipPushStatusSnapshot(deviceId: string, statusSnapshot: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(shipPushSubscriptions).set({ statusSnapshot, updatedAt: new Date() }).where(eq(shipPushSubscriptions.deviceId, deviceId));
}

export async function disableShipPushSubscription(deviceId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(shipPushSubscriptions).set({ notificationsEnabled: false, updatedAt: new Date() }).where(eq(shipPushSubscriptions.deviceId, deviceId));
}

export async function getShipSyncScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shipSyncSchedules).where(eq(shipSyncSchedules.taskUid, taskUid)).limit(1);
  return result[0];
}

export async function upsertShipSyncSchedule(name: string, taskUid: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("資料庫不可用，無法保存船期同步排程。");
  await db.insert(shipSyncSchedules).values({ name, taskUid }).onDuplicateKeyUpdate({
    set: { taskUid, updatedAt: new Date() },
  });
}
