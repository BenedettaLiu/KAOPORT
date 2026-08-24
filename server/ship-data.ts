import { shipRecords, type ShipRecord, type ShipStatus } from "../lib/ships";

const ARRIVALS_URL = "https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=6";
const DEPARTURES_URL = "https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=7";

export type ShipSnapshot = {
  ships: ShipRecord[];
  updatedAt: string;
  source: "official" | "fallback";
  notice?: string;
};

type OpenDataShip = Record<string, string>;

function decodeXmlValue(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function readField(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? decodeXmlValue(match[1]) : "";
}

function formatOfficialTimestamp(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/\d{4}\s+(\d{1,2}):(\d{2}):\d{2}\s+(AM|PM)$/i.exec(
    value.trim(),
  );
  if (!match) return value || null;

  const [, rawMonth, rawDay, rawHour, minute, meridiem] = match;
  let hour = Number(rawHour);
  if (meridiem.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (meridiem.toUpperCase() === "AM" && hour === 12) hour = 0;

  return `${rawMonth.padStart(2, "0")}/${rawDay.padStart(2, "0")} ${String(hour).padStart(2, "0")}:${minute}`;
}

function toStableId(ship: OpenDataShip, direction: ShipStatus, index: number): string {
  const raw = [direction, ship.VISA_NO, ship.VESSEL_NO, ship.WHARF_CODE, ship.IMO, index]
    .filter(Boolean)
    .join("-");
  return raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function toShipRecord(ship: OpenDataShip, direction: "arrival" | "departure", index: number): ShipRecord {
  const hasActuallyArrived = Boolean(ship.ACT_PORT_DT);
  const status: ShipStatus = direction === "departure" ? "departing" : hasActuallyArrived ? "berthed" : "arriving";
  const vesselName = ship.VESSEL_ENAME || ship.VESSEL_CNAME || `未命名船舶 ${index + 1}`;
  const statusNote =
    status === "departing"
      ? "官方最近 24 小時實際出港資料。"
      : status === "berthed"
        ? "官方最近 24 小時實際進港資料。"
        : "官方最近 24 小時進港資料，靠泊狀態依資料更新為準。";

  return {
    id: toStableId(ship, status, index),
    name: vesselName,
    voyage: ship.VISA_NO || ship.VESSEL_NO || "尚未提供",
    imo: ship.IMO || "尚未提供",
    vesselType: ship.SHIP_TYPE_NAME || ship.SHIP_TYPE || "尚未提供",
    flag: "尚未提供",
    status,
    berth: ship.WHARF_NAME || ship.WHARF_CODE || "尚未提供",
    eta: formatOfficialTimestamp(ship.ETA_DT),
    etd: formatOfficialTimestamp(ship.ETD_DT),
    lastUpdated: formatOfficialTimestamp(ship.ACT_PORT_DT) ?? "以官方資料為準",
    destination: direction === "departure" ? ship.NEXT_PORT || "尚未提供" : ship.BEFORE_PORT || "尚未提供",
    grossTonnage: "尚未提供",
    note: statusNote,
  };
}

export function parseShipXml(xml: string, direction: "arrival" | "departure"): ShipRecord[] {
  const shipNodes = xml.match(/<SHIP>[\s\S]*?<\/SHIP>/gi) ?? [];

  return shipNodes
    .map((node, index) => {
      const fields: OpenDataShip = {};
      const tags = [
        "VISA_NO",
        "VESSEL_NO",
        "VESSEL_CNAME",
        "VESSEL_ENAME",
        "WHARF_CODE",
        "WHARF_NAME",
        "SIGNAL_DT",
        "ETA_DT",
        "ETD_DT",
        "LEAVE_DT",
        "ACT_PORT_DT",
        "SHIP_TYPE",
        "SHIP_TYPE_NAME",
        "BEFORE_PORT",
        "NEXT_PORT",
        "IMO",
      ];
      tags.forEach((tag) => {
        fields[tag] = readField(node, tag);
      });
      return toShipRecord(fields, direction, index);
    })
    .filter((ship) => ship.name.length > 0);
}

async function downloadOfficialXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "KaohsiungPortShipQuery/1.0",
    },
  });
  if (!response.ok) throw new Error(`官方資料服務回應 ${response.status}`);

  const bytes = await response.arrayBuffer();
  return new TextDecoder("big5").decode(bytes);
}

export async function getLatestShipSnapshot(): Promise<ShipSnapshot> {
  try {
    const [arrivalsXml, departuresXml] = await Promise.all([
      downloadOfficialXml(ARRIVALS_URL),
      downloadOfficialXml(DEPARTURES_URL),
    ]);
    const ships = [
      ...parseShipXml(arrivalsXml, "arrival"),
      ...parseShipXml(departuresXml, "departure"),
    ];

    if (ships.length === 0) throw new Error("官方資料未提供船舶紀錄");

    return {
      ships,
      updatedAt: new Date().toISOString(),
      source: "official",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "未知錯誤";
    return {
      ships: shipRecords,
      updatedAt: new Date().toISOString(),
      source: "fallback",
      notice: `目前無法更新官方資料（${detail}），暫時顯示示範資料。`,
    };
  }
}
