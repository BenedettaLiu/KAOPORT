import { describe, expect, it } from "vitest";
import { parseOfficialShipXml, parseOfficialTimestamp } from "../server/ship-data";

const sampleXml = `<?xml version="1.0"?><OPEN_DATA><SHIPS><SHIP><VISA_NO>AKHH115012929</VISA_NO><STATUS>進港</STATUS><VESSEL_NO>V25425</VESSEL_NO><VESSEL_CNAME>麥司克諾托登</VESSEL_CNAME><VESSEL_ENAME>MAERSK NOTODDEN</VESSEL_ENAME><CALL_SIGN>9V1234</CALL_SIGN><WHARF_NAME>#77 碼頭</WHARF_NAME><SIGNAL_DT>8/24/2026 1:20:00 PM</SIGNAL_DT><ETA_DT>8/24/2026 2:30:00 PM</ETA_DT><ETD_DT>8/24/2026 11:30:00 PM</ETD_DT><LEAVE_DT>8/24/2026 1:05:00 PM</LEAVE_DT><ACT_PORT_DT></ACT_PORT_DT><SHIP_TYPE_NAME>貨櫃輪</SHIP_TYPE_NAME><GOAL_ARRIVAL>A1 裝卸貨</GOAL_ARRIVAL><PBG_NO>Z05530</PBG_NO><PBG_NAME>台灣快桅股份有限公司高雄分公司</PBG_NAME><BEFORE_PORT>CNNSA Nansha</BEFORE_PORT><NEXT_PORT>KRPUS Busan</NEXT_PORT><IMO>1047108</IMO></SHIP></SHIPS></OPEN_DATA>`;

describe("高雄港官方 XML 船期轉換", () => {
  it("可將官方時間轉換為帶有台灣時區的 ISO 時間", () => {
    expect(parseOfficialTimestamp("8/24/2026 2:30:00 PM")).toBe("2026-08-24T14:30:00+08:00");
  });
  it("可將進港預報 XML 轉換為標準船舶紀錄", () => {
    expect(parseOfficialShipXml(sampleXml, "arriving")[0]).toMatchObject({ id: "imo-1047108", name: "MAERSK NOTODDEN", chineseName: "麥司克諾托登", callSign: "9V1234", entryExitStatus: "進港", berth: "#77 碼頭", vesselType: "貨櫃輪", eta: "2026-08-24T14:30:00+08:00", signalTime: "2026-08-24T13:20:00+08:00", departureTime: "2026-08-24T13:05:00+08:00", operationPurpose: "A1 裝卸貨", pilotApplicationNumber: "Z05530", pilotApplicationName: "台灣快桅股份有限公司高雄分公司", originPort: "CNNSA Nansha", destination: "KRPUS Busan" });
  });
});
