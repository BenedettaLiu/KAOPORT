export type ShipStatus = "berthed" | "arriving" | "departing";

export type ShipRecord = {
  id: string;
  name: string;
  voyage: string;
  imo: string;
  vesselType: string;
  flag: string;
  status: ShipStatus;
  berth: string;
  eta: string | null;
  etd: string | null;
  actualArrival: string | null;
  originPort: string;
  lastUpdated: string;
  destination: string;
  grossTonnage: string;
  note: string;
};

export const SHIP_STATUS_META: Record<
  ShipStatus,
  { label: string; color: string; softColor: string; borderColor: string; icon: "anchor" | "south" | "north" }
> = {
  berthed: {
    label: "在港",
    color: "#167A54",
    softColor: "#E8F5EF",
    borderColor: "#BFE3CF",
    icon: "anchor",
  },
  arriving: {
    label: "靠港",
    color: "#B8610E",
    softColor: "#FFF2E2",
    borderColor: "#F4D0A6",
    icon: "south",
  },
  departing: {
    label: "離港",
    color: "#B94545",
    softColor: "#FCEBEC",
    borderColor: "#EFC2C5",
    icon: "north",
  },
};

export const shipRecords: ShipRecord[] = [
  {
    id: "harbor-aurora",
    name: "HARBOR AURORA",
    voyage: "HA-2408E",
    imo: "9384621",
    vesselType: "貨櫃輪",
    flag: "新加坡",
    status: "berthed",
    berth: "第六貨櫃中心 108 號",
    eta: "08/24 05:40",
    etd: "08/24 22:30",
    actualArrival: "08/24 06:05",
    originPort: "基隆港",
    lastUpdated: "08/24 09:15",
    destination: "新加坡",
    grossTonnage: "68,210 GT",
    note: "裝卸作業中；離港時間以港方最新公告為準。",
  },
  {
    id: "pacific-cedar",
    name: "PACIFIC CEDAR",
    voyage: "PC-381W",
    imo: "9491058",
    vesselType: "散裝貨輪",
    flag: "巴拿馬",
    status: "arriving",
    berth: "中島商港區 37 號",
    eta: "08/24 11:20",
    etd: "08/25 08:00",
    actualArrival: null,
    originPort: "台中港",
    lastUpdated: "08/24 09:10",
    destination: "高雄港",
    grossTonnage: "41,780 GT",
    note: "預定靠泊；實際靠港時間可能因調度而異。",
  },
  {
    id: "formosa-pioneer",
    name: "FORMOSA PIONEER",
    voyage: "FP-724S",
    imo: "9712534",
    vesselType: "貨櫃輪",
    flag: "台灣",
    status: "departing",
    berth: "第五貨櫃中心 79 號",
    eta: "08/23 20:30",
    etd: "08/24 13:10",
    actualArrival: "08/23 20:48",
    originPort: "新加坡港",
    lastUpdated: "08/24 09:06",
    destination: "香港",
    grossTonnage: "92,150 GT",
    note: "已完成大部分作業，等候離泊指示。",
  },
  {
    id: "ocean-radiance",
    name: "OCEAN RADIANCE",
    voyage: "OR-166N",
    imo: "9658825",
    vesselType: "油輪",
    flag: "馬紹爾群島",
    status: "berthed",
    berth: "大林商港區 23 號",
    eta: "08/24 00:50",
    etd: "08/25 03:30",
    actualArrival: "08/24 01:12",
    originPort: "釜山港",
    lastUpdated: "08/24 08:58",
    destination: "釜山",
    grossTonnage: "57,990 GT",
    note: "泊位作業中。",
  },
  {
    id: "eastern-swan",
    name: "EASTERN SWAN",
    voyage: "ES-902E",
    imo: "9874401",
    vesselType: "汽車運輸船",
    flag: "日本",
    status: "arriving",
    berth: "第一港口 9 號",
    eta: "08/24 15:45",
    etd: "08/25 01:20",
    actualArrival: null,
    originPort: "橫濱港",
    lastUpdated: "08/24 08:45",
    destination: "高雄港",
    grossTonnage: "59,870 GT",
    note: "引水安排確認中。",
  },
  {
    id: "meridian-trader",
    name: "MERIDIAN TRADER",
    voyage: "MT-551W",
    imo: "9237715",
    vesselType: "雜貨輪",
    flag: "賴比瑞亞",
    status: "departing",
    berth: "蓬萊商港區 18 號",
    eta: "08/22 18:20",
    etd: "08/24 17:40",
    actualArrival: "08/22 18:42",
    originPort: "馬尼拉港",
    lastUpdated: "08/24 08:36",
    destination: "馬尼拉",
    grossTonnage: "22,480 GT",
    note: "預計於下午時段離港。",
  },
];

export type ShipFilter = "all" | ShipStatus;

export function filterShips(records: ShipRecord[], query: string, filter: ShipFilter): ShipRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return records.filter((ship) => {
    const matchesFilter = filter === "all" || ship.status === filter;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [ship.name, ship.voyage, ship.imo, ship.berth, ship.originPort].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      );

    return matchesFilter && matchesQuery;
  });
}

export function getShipById(id: string | undefined): ShipRecord | undefined {
  return shipRecords.find((ship) => ship.id === id);
}
