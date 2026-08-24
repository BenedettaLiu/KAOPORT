import type { Request, Response } from "express";
import { getShipSyncScheduleByTaskUid } from "./db";
import { sdk } from "./_core/sdk";
import { synchronizeOfficialShipsAndNotify } from "./ship-sync";

/** Heartbeat callback: accepts only a verified platform cron identity. */
export async function shipSyncScheduledHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron-only" });
      return;
    }
    const schedule = await getShipSyncScheduleByTaskUid(user.taskUid);
    if (!schedule) {
      res.json({ ok: true, skipped: "orphaned-schedule" });
      return;
    }
    const result = await synchronizeOfficialShipsAndNotify();
    if (result.snapshot.source === "unavailable") {
      res.status(503).json({ ok: false, error: result.snapshot.notice, taskUid: user.taskUid });
      return;
    }
    res.json({
      ok: true,
      source: result.snapshot.source,
      updatedAt: result.snapshot.updatedAt,
      subscriptionsProcessed: result.subscriptionsProcessed,
      notificationsSent: result.notificationsSent,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[Ship sync] Scheduled callback failed:", error);
    res.status(500).json({
      error: detail,
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl },
    });
  }
}
