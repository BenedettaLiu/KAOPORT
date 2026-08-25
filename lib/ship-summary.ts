import { formatShipTime, SHIP_STATUS_META, type ShipRecord } from "./ships";

/** Creates the plain-text payload used by the visa summary copy action. */
export function buildVisaSummaryText(ship: ShipRecord): string {
  const lines = [
    "高雄港船舶資料摘要",
    `船名：${ship.name}`,
    ship.chineseName ? `中文船名：${ship.chineseName}` : null,
    `簽證編號：${ship.voyage}`,
    `官方進出港：${ship.entryExitStatus ?? SHIP_STATUS_META[ship.status].label}`,
    `船型：${ship.vesselType}`,
    `預定泊位：${ship.berth}`,
    `引水申請時間：${formatShipTime(ship.signalTime ?? null)}`,
    `引水出發時間：${formatShipTime(ship.departureTime ?? null)}`,
    ship.pilotApplicationName ? `港代理名稱：${ship.pilotApplicationName}` : null,
    ship.pilotApplicationNumber ? `代理編號：${ship.pilotApplicationNumber}` : null,
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

/** Creates the plain-text payload used by the vessel specifications copy action. */
export function buildShipSpecificationsText(ship: ShipRecord): string {
  const lines = [
    "高雄港船舶規格摘要",
    `英文船名：${ship.name}`,
    `中文船名：${ship.chineseName ?? "尚未提供"}`,
    `IMO：${ship.imo}`,
    `MMSI：${ship.mmsi ?? "尚未提供"}`,
    `呼號：${ship.callSign ?? "尚未提供"}`,
    `船型：${ship.vesselType}`,
    `船籍：${ship.flag}`,
    `船總長度：${ship.overallLength ?? "尚未提供"}`,
    `總噸位：${ship.grossTonnage}`,
  ];

  return lines.join("\n");
}
