# 高雄港官方船期資料整合依據

本應用程式的即時船期資料將由臺灣港務公司高雄港的官方 XML 開放資料代理取得，再由應用程式後端轉換為統一的 `ShipRecord` 結構。不得由行動端直接連至外部 XML；應由後端集中處理 Big5 編碼、欄位正規化、錯誤回退與資料來源標記。

| 用途 | 官方資料集 | XML 資源 | 應用方式 |
|---|---|---|---|
| 進港預報／24H 入港預報 | 高雄港進港預報次序 | `https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=5` | 以 `ETA_DT` 選出未來 24 小時準備入港的資料，提供泊位與船型篩選。 |
| 最近實際進港 | 高雄港最近 24 小時船舶實際進出港時間 | `https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=6` | 顯示已入港／靠泊船舶與 `ACT_PORT_DT`。 |
| 最近實際出港 | 高雄港最近 24 小時船舶實際進出港時間 | `https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=7` | 顯示最近出港船舶與離港資訊。 |

官方資料集列出的主要欄位包括：`VISA_NO`、`VESSEL_NO`、`VESSEL_CNAME`、`VESSEL_ENAME`、`WHARF_NAME`、`ETA_DT`、`ETD_DT`、`ACT_PORT_DT`、`SHIP_TYPE_NAME`、`BEFORE_PORT`、`NEXT_PORT` 與 `IMO`。進港預報與最近 24 小時進出港資料均標示為每 10 分鐘更新；行動應用程式應將「最近同步時間」標示為後端成功取得資料的時間，而非自行推定官方事件時間。

資料來源：政府資料開放平臺的高雄港進港預報次序（資料集 8157）與高雄港最近 24 小時船舶實際進出港時間（資料集 16826）。
