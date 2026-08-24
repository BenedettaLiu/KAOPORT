import { describe, expect, it } from "vitest";

import { parseShipXml } from "../server/ship-data";

const sampleXml = `<?xml version="1.0" encoding="BIG5"?>
<OPEN_DATA><SHIPS>
  <SHIP>
    <VISA_NO>AKHH001</VISA_NO><VESSEL_NO>V10001</VESSEL_NO>
    <VESSEL_CNAME>測試輪</VESSEL_CNAME><VESSEL_ENAME>TEST VESSEL</VESSEL_ENAME>
    <WHARF_CODE>KHHX001X</WHARF_CODE><WHARF_NAME>#1碼頭</WHARF_NAME>
    <ETA_DT>8/24/2026 3:30:00 PM</ETA_DT><ETD_DT>8/25/2026 2:00:00 AM</ETD_DT>
    <ACT_PORT_DT>8/24/2026 3:45:00 PM</ACT_PORT_DT><SHIP_TYPE_NAME>全貨櫃船</SHIP_TYPE_NAME>
    <BEFORE_PORT>SGSIN Singapore</BEFORE_PORT><NEXT_PORT>HKHKG Hong Kong</NEXT_PORT><IMO>9123456</IMO>
  </SHIP>
</SHIPS></OPEN_DATA>`;

describe("官方高雄港船舶資料轉換", () => {
  it("可將進港 XML 轉為可供清單顯示的在港船舶紀錄", () => {
    const [ship] = parseShipXml(sampleXml, "arrival");

    expect(ship).toMatchObject({
      name: "TEST VESSEL",
      voyage: "AKHH001",
      imo: "9123456",
      berth: "#1碼頭",
      status: "berthed",
      eta: "08/24 15:30",
      etd: "08/25 02:00",
      destination: "SGSIN Singapore",
    });
  });

  it("可將出港 XML 標示為離港狀態並使用下一港資訊", () => {
    const [ship] = parseShipXml(sampleXml, "departure");

    expect(ship.status).toBe("departing");
    expect(ship.destination).toBe("HKHKG Hong Kong");
  });
});
