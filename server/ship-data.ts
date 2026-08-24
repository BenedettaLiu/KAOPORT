import type { ShipRecord, ShipStatus } from "../lib/ships";
import { getOfficialShipCache, saveOfficialShipCache } from "./db";

const OFFICIAL_ENDPOINTS = {
  forecast: "https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=5",
  arrivals: "https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=6",
  departures: "https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=7",
} as const;

export type OfficialShipSnapshot = {
  ships: ShipRecord[];
  updatedAt: string;
  source: "official" | "cached" | "unavailable";
  notice?: string;
};

export const OFFICIAL_SNAPSHOT_CACHE_TTL_MS = 8 * 60 * 1000;

let inMemorySnapshot: OfficialShipSnapshot | null = null;
let inFlightRefresh: Promise<OfficialShipSnapshot> | null = null;

type OfficialShip = Record<string, string>;

const SHIP_FIELDS = ["VISA_NO", "STATUS", "VESSEL_NO", "VESSEL_CNAME", "VESSEL_ENAME", "WHARF_CODE", "WHARF_NAME", "SIGNAL_DT", "ETA_DT", "ETD_DT", "LEAVE_DT", "ACT_PORT_DT", "SHIP_TYPE", "SHIP_TYPE_NAME", "GOAL_ARRIVAL", "PBG_NO", "PBG_NAME", "BEFORE_PORT", "NEXT_PORT", "IMO"];

function decodeValue(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function readField(node: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(node);
  return match ? decodeValue(match[1]) : "";
}

export function parseOfficialTimestamp(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  const [, month, day, year, rawHour, minute, second, rawMeridiem] = match;
  let hour = Number(rawHour);
  const meridiem = rawMeridiem.toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${String(hour).padStart(2, "0")}:${minute}:${second}+08:00`;
}

function toStableId(ship: OfficialShip, index: number): string {
  if (ship.IMO) return `imo-${ship.IMO}`;
  return `visa-${ship.VISA_NO || ship.VESSEL_NO || index}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function toShipRecord(ship: OfficialShip, status: ShipStatus, index: number): ShipRecord {
  const eta = parseOfficialTimestamp(ship.ETA_DT);
  const etd = parseOfficialTimestamp(ship.ETD_DT);
  const actualArrival = parseOfficialTimestamp(ship.ACT_PORT_DT);
  const signalTime = parseOfficialTimestamp(ship.SIGNAL_DT);
  const departureTime = parseOfficialTimestamp(ship.LEAVE_DT);
  return {
    id: toStableId(ship, index), name: ship.VESSEL_ENAME || ship.VESSEL_CNAME || `未命名船舶 ${index + 1}`,
    chineseName: ship.VESSEL_CNAME || undefined,
    voyage: ship.VISA_NO || ship.VESSEL_NO || "尚未提供", imo: ship.IMO || "尚未提供",
    vesselType: ship.SHIP_TYPE_NAME || ship.SHIP_TYPE || "尚未提供", flag: "尚未提供", status,
    berth: ship.WHARF_NAME || ship.WHARF_CODE || "尚未提供", eta, etd, actualArrival, departureTime, signalTime,
    originPort: ship.BEFORE_PORT || "尚未提供", lastUpdated: departureTime || actualArrival || eta || new Date().toISOString(),
    destination: ship.NEXT_PORT || "尚未提供", grossTonnage: "尚未提供",
    entryExitStatus: ship.STATUS || undefined,
    operationPurpose: ship.GOAL_ARRIVAL || undefined,
    pilotApplicationName: ship.PBG_NAME || undefined,
    pilotApplicationNumber: ship.PBG_NO || undefined,
    note: status === "arriving" ? "依高雄港官方進港預報資料顯示。" : status === "berthed" ? "依高雄港官方最近 24 小時實際進港資料顯示。" : "依高雄港官方最近 24 小時實際出港資料顯示。",
  };
}

export function parseOfficialShipXml(xml: string, status: ShipStatus): ShipRecord[] {
  const nodes = xml.match(/<SHIP>[\s\S]*?<\/SHIP>/gi) ?? [];
  return nodes.map((node, index) => {
    const record: OfficialShip = {};
    SHIP_FIELDS.forEach((field) => { record[field] = readField(node, field); });
    return toShipRecord(record, status, index);
  });
}

async function fetchOfficialXml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8", "User-Agent": "KaohsiungPortShipQuery/1.0" } });
  if (!response.ok) throw new Error(`官方資料服務回應 ${response.status}`);
  return new TextDecoder("big5").decode(await response.arrayBuffer());
}

function mergeShipRecords(groups: ShipRecord[][]): ShipRecord[] {
  const priority: Record<ShipStatus, number> = { arriving: 1, berthed: 2, departing: 3 };
  const merged = new Map<string, ShipRecord>();
  groups.flat().forEach((ship) => {
    const existing = merged.get(ship.id);
    if (!existing || priority[ship.status] >= priority[existing.status]) merged.set(ship.id, ship);
  });
  return [...merged.values()].sort((left, right) => (left.eta ?? left.lastUpdated).localeCompare(right.eta ?? right.lastUpdated));
}

export function isOfficialSnapshotFresh(updatedAt: string, now = Date.now()): boolean {
  const updatedAtMs = new Date(updatedAt).getTime();
  return Number.isFinite(updatedAtMs) && now - updatedAtMs >= 0 && now - updatedAtMs < OFFICIAL_SNAPSHOT_CACHE_TTL_MS;
}

function asCachedSnapshot(snapshot: OfficialShipSnapshot, notice?: string): OfficialShipSnapshot {
  return {
    ships: snapshot.ships,
    updatedAt: snapshot.updatedAt,
    source: "cached",
    notice: notice ?? "顯示最近一次成功同步的快取資料。",
  };
}

async function getPersistedSnapshot(): Promise<OfficialShipSnapshot | null> {
  try {
    const cached = await getOfficialShipCache();
    if (!cached) return null;
    const ships = JSON.parse(cached.payload) as ShipRecord[];
    if (!Array.isArray(ships) || ships.length === 0) return null;
    return {
      ships,
      updatedAt: cached.syncedAt.toISOString(),
      source: "cached",
      notice: cached.notice ?? undefined,
    };
  } catch (error) {
    console.warn("[Ship data] Failed to read persisted cache:", error);
    return null;
  }
}

async function cacheSnapshot(snapshot: OfficialShipSnapshot): Promise<void> {
  inMemorySnapshot = snapshot;
  try {
    await saveOfficialShipCache({
      payload: JSON.stringify(snapshot.ships),
      source: "official",
      notice: snapshot.notice,
      syncedAt: new Date(snapshot.updatedAt),
    });
  } catch (error) {
    console.warn("[Ship data] Failed to save persisted cache:", error);
  }
}

async function fetchAndCacheOfficialSnapshot(): Promise<OfficialShipSnapshot> {
  try {
    const [forecastXml, arrivalsXml, departuresXml] = await Promise.all([fetchOfficialXml(OFFICIAL_ENDPOINTS.forecast), fetchOfficialXml(OFFICIAL_ENDPOINTS.arrivals), fetchOfficialXml(OFFICIAL_ENDPOINTS.departures)]);
    const ships = mergeShipRecords([parseOfficialShipXml(forecastXml, "arriving"), parseOfficialShipXml(arrivalsXml, "berthed"), parseOfficialShipXml(departuresXml, "departing")]);
    if (ships.length === 0) throw new Error("官方資料未回傳船舶紀錄");
    const snapshot: OfficialShipSnapshot = { ships, updatedAt: new Date().toISOString(), source: "official" };
    await cacheSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知錯誤";
    const fallback = inMemorySnapshot ?? await getPersistedSnapshot();
    if (fallback) {
      return asCachedSnapshot(fallback, `官方資料更新暫時失敗（${detail}），目前顯示最近一次成功同步的快取資料。`);
    }
    return { ships: [], updatedAt: new Date().toISOString(), source: "unavailable", notice: `官方高雄港船期資料暫時無法取得（${detail}）。請稍後下拉更新。` };
  }
}

export async function refreshOfficialShipSnapshot(): Promise<OfficialShipSnapshot> {
  if (!inFlightRefresh) {
    inFlightRefresh = fetchAndCacheOfficialSnapshot().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export async function getOfficialShipSnapshot(options: { forceRefresh?: boolean } = {}): Promise<OfficialShipSnapshot> {
  if (!options.forceRefresh && inMemorySnapshot && isOfficialSnapshotFresh(inMemorySnapshot.updatedAt)) {
    return asCachedSnapshot(inMemorySnapshot);
  }

  if (!options.forceRefresh) {
    const persisted = await getPersistedSnapshot();
    if (persisted && isOfficialSnapshotFresh(persisted.updatedAt)) {
      inMemorySnapshot = persisted;
      return asCachedSnapshot(persisted);
    }
  }

  return refreshOfficialShipSnapshot();
}
