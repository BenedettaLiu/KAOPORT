# 高雄港船舶動態資料來源

船舶清單的手動下拉更新採用臺灣港務股份有限公司公布的官方開放資料。資料集「高雄港最近 24 小時船舶實際進／出港時間」說明其更新頻率為 **每 10 分鐘**，並提供船名、中英文船名、碼頭、ETA、ETD、實際進出港時間、下一港與 IMO 等欄位。[1]

| 資料類型 | 官方 XML 資源 |
|---|---|
| 最近 24 小時實際進港 | `https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=6` |
| 最近 24 小時實際出港 | `https://tpnet.twport.com.tw/IFAWeb/Reports/OpenData/GetOpenData?port=KHH&type=7` |

行動端不直接解析遠端 XML；應由應用程式服務端取得、驗證與轉換資料，再輸出與 `ShipRecord` 對應的 JSON。這能避免瀏覽器跨網域限制，並讓下拉更新以單一資料介面安全地讀取最新快照。

## References

[1]: https://data.gov.tw/dataset/16826 "高雄港最近24小時船舶實際進/出港時間｜政府資料開放平臺"
