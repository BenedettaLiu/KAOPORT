import { describe, expect, it } from "vitest";
import { parseOfficialShipXml, parseOfficialTimestamp } from "../server/ship-data";

const sampleXml = `<?xml version="1.0"?><OPEN_DATA><SHIPS><SHIP><VISA_NO>AKHH115012929</VISA_NO><VESSEL_NO>V25425</VESSEL_NO><VESSEL_ENAME>MAERSK NOTODDEN</VESSEL_ENAME><WHARF_NAME>#77 碼頭</WHARF_NAME><ETA_DT>8/24/2026 2:30:00 PM</ETA_DT><ETD_DT>8/24/2026 11:30:00 PM</ETD_DT><ACT_PORT_DT></ACT_PORT_DT><SHIP_TYPE_NAME>貨櫃輪</SHIP_TYPE_NAME><BEFORE_PORT>CNNSA Nansha</BEFORE_PORT><NEXT_PORT>KRPUS Busan</NEXT_PORT><IMO>1047108</IMO></SHIP></SHIPS></OPEN_DATA>`;

describe("高雄港官方 XML 船期轉換", () => {
  it("可將官方時間轉換為帶有台灣時區的 ISO 時間", () => {
    expect(parseOfficialTimestamp("8/24/2026 2:30:00 PM")).toBe("2026-08-24T14:30:00+08:00");
  });
  it("可將進港預報 XML 轉換為標準船舶紀錄", () => {
    expect(parseOfficialShipXml(sampleXml, "arriving")[0]).toMatchObject({ id: "imo-1047108", name: "MAERSK NOTODDEN", berth: "#77 碼頭", vesselType: "貨櫃輪", eta: "2026-08-24T14:30:00+08:00", originPort: "CNNSA Nansha", destination: "KRPUS Busan" });
  });
});
