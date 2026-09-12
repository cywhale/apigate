# apigate 1.7.0 產前評估與效能風險

狀態：release candidate 的決策文件；本文件本身不授權直接修改 SQL Server 或 production。

日期：2026-09-12

## 目的

本文件整理 Fastify API 層、SQL Server stored procedure 層與部署環境的目前責任邊界，作為 `cywhale/apigate` 1.7.0 合併、上線與後續效能修補的共同依據。

本次 modernization 的主要目標是：

- 將 Swagger/OpenAPI 文件提升至 OpenAPI 3.1.0，同時維持 CTD/SADCP production wire behavior。
- 在 Node 24、Fastify 5 與更新後的資料庫 client 套件上完成可回歸驗證。
- 將已確認的 API、stream lifecycle 與 stored-procedure 修補留下可追蹤的測試與文件。
- 明確記錄目前尚未能在 SQL Server production table 端完成驗證的 index、statistics 與 query-plan 工作。

## 必讀文件與程式入口

接手本專案的 developer/reviewer 應依序閱讀：

1. `README.md`：公開 API 用途與 production endpoint。
2. `AGENTS.md`：本專案的 agent 協作、相容性、測試與 DB 變更規則。
3. `server/package.json`、`server/pnpm-lock.yaml`、`.nvmrc`：runtime 與依賴版本。
4. `server/src/app.mjs`、`server/src/config/swagger_config.js`：Fastify、OAS 3.1 與 Swagger UI 設定。
5. `server/src/routes/apirest.mjs`：query normalization、procedure routing、response serialization、cache 與 stream lifecycle。
6. `server/src/srvapp.mjs`、`server/src/config/streamCache.js`、`server/src/config/streamBufferCache.js`：SQL pool 與 response cache。
7. `server/tests/`：每個修補 slice 的可執行回歸測試。
8. `database/README.md`、`database/stored-procedures/README.md`、`database/review-2026-09-10.md`：SQL Server 資產、部署界線與已知風險。
9. `database/stored-procedures/current/`：2026-09-11 production-side procedure snapshot；這些檔案是 review/rollback 依據，不是 application startup 的 migration。
10. `server/ops/pm2-apigate-node24.service` 與 `server/scripts/`：Node 24 PM2、NGINX TLS-off/upstream migration 與 rollback 檢查。

## 目前狀態

- 工作分支：`chore/openapi31-modernization`；release target 為 `main`。
- package release version for this candidate is `1.7.0`。OAS `info.version` 目前是既有 API 文件版本 `1.0.0`，除非 APIverse consumer 另行確認，不要把它與 npm/package release version 混為一談。
- runtime 固定為 Node `24.20.0`（`.nvmrc` 與 PM2 systemd unit）；`server/package.json` engine 為 `>=24 <25`。
- 目前主要套件已升級至 Fastify `5.12.3`、`@fastify/swagger` `9.8.1`、`@fastify/swagger-ui` `6.1.1`、Knex `3.3.0`、Tedious `20.3.0`、`lru-cache` `11.5.2`。
- OAS 為 `3.1.0`。APIverse 相容性不變的硬性條件是：`servers[0].url` 使用裸 authority `https://ecodata.odb.ntu.edu.tw`、paths 保持 `/api/ctd` 與 `/api/sadcp`、registry name 保持 `odb_ctd_sadcp_v1`。
- public API 不要求 credentials；TLS 由 NGINX 終止，Fastify/PM2 使用 localhost HTTP upstream。production upstream 已有 Node 24 PM2 cluster migration script 與 rollback port 檢查，測試不可佔用 production port。
- 目前 API 公開的資料路徑為 CTD/SADCP；`/bio`、`/gql` 已退休，raw/rawx 與 cruise public path 必須維持不可由外界使用。
- SQL Server 為 `15.0.2000.5`，database 為 `odbphy`。目前版控下來的 procedure 是 2026-09-11 由 production-side 匯出的 review snapshot；table owner/maintainer 另屬 DB 維護團隊。SQL Server table/index/statistics 變更不包含在 Node release 的自動部署中。

`server/tests/` 最近一次完整測試的基準為 59 passed、0 failed；release 前必須在目標 commit 上重新執行，不可只引用這個歷史結果。

## Production API 不可變契約

除非先和 APIverse/Hidy consumer 個案討論，CTD/SADCP 的 wire output 不應改變：

- `GET /api/ctd`、`GET /api/sadcp` 維持原 path、參數名稱與主要預設行為。
- CTD `format` 可產生 JSON array 或 GeoJSON FeatureCollection；SADCP 另外支援 `uvgrid` 的 `{header, data}` 形狀。
- `start`/`end` 接受 `YYYY-MM-DD` 或 `YYYYMMDD`；日期之外的格式應在 Fastify validation 階段拒絕。
- CTD numeric `dep_mode` 是既有 depth-bin 行為；SADCP numeric `dep_mode` 應拒絕，SADCP 使用 `mean`、`exact`、`range`。
- `mode` 的既有值域與 period mapping 不可任意重命名。
- 文件/schema 修正不可改變實際 JSON/GeoJSON/uvgrid bytes 的資料形狀或排列契約。
- `raw`、`raw0`、`raw1`、`rawx` 與 cruise 不得重新暴露；相關 legacy code 即使保留，也必須維持不可達。

## 責任邊界評估

目前的主要切分是合理的：SQL Server 負責資料量大的 filtering、grouping、AVG/SUM、period/depth 條件；Fastify 負責公開契約、參數驗證、procedure routing、格式轉換、cache 與 HTTP stream。不要把 aggregation 搬到 Node，也不要把所有 GeoJSON/uvgrid presentation 搬到 SQL。

仍有幾個跨層耦合應在後續 slice 逐步整理：

1. Fastify 與 procedure 都解讀 `mode`、`dep_mode`、日期、limit 與排序。應建立單一 canonical parameter model，減少兩端對 `NULL`、預設值與非法值的不同解釋。
2. uvgrid 的 gap filling 與輸出排列留在 Fastify 是合理的，但它依賴 procedure 的 deterministic ordering；排序欄位與 tie-breaker 應成為明確的測試契約。
3. 月表日期條件、`year/month` 的索引與 statistics 是 DB 層責任；應以可 SARGable 的條件與實際 execution plan 逐案驗證。
4. Fastify 目前組合 stored-procedure `EXEC` 字串。公開輸入已經過 schema/whitelist，但長期應考慮 parameter binding 與 procedure 內部 identifier validation，以改善 plan reuse、維護性與 direct DB caller 的防護。
5. response cache 與 HTTP backpressure 是 Fastify/edge 層責任，不應由 stored procedure 處理。

## 效能與高併發風險

### 高優先風險

1. **cache 的記憶體沒有 byte budget。** `streamBufferCache` 逐 byte 儲存 JavaScript array；cache miss 在回傳 client 的同時又暫存完整 response，完成後再長時間留在 LRU。`max: 40000` 是 key 數，不是 bytes；兩個 PM2 worker 也各自持有 cache。
2. **沒有 single-flight。** 同一 query 在第一個 request 完成前尚未進 cache，並發請求可能各自啟動 SQL stream，直接放大 DB、pool 與 Node 記憶體成本。
3. **HTTP backpressure 不完整。** 直接呼叫 `res.raw.write(data)` 而不等待 `drain`，slow client 可能讓待輸出資料累積；大型 SADCP uvgrid/GeoJSON 最容易觸發。
4. **公開 API 缺少昂貴查詢的資源上限。** `limit=0`/uvgrid 可產生大型結果，目前沒有 response byte budget、昂貴查詢 concurrency gate 或 client rate limit。API 無 credentials，這是需要優先處理的 availability 風險。
5. **yyyymm query cache miss 時會掃描大量 heap。** 已取得的 execution plan 顯示 CTD monthly 約 748 萬列、SADCP monthly 約 113 萬列，日期 expression 非 SARGable。index、statistics、compatibility level 必須由 DB owner 依實際 plan 驗證。

### 中優先風險

- 每個 PM2 worker 都有自己的 SQL pool；pool max 15 在兩 worker 下可能同時產生約 30 個 SQL sessions。這個值需與 SQL scan cost 和 slow-client 行為一起壓測，不能只看設定值。
- dynamic projection/order 會增加 plan text 變體與 plan reuse 複雜度。
- 72 小時 cache 會延長資料更新後的 stale window；cache invalidation/TTL 應與資料更新頻率共同決定。
- compatibility level、statistics freshness、table heap/index 狀態會影響 SQL Server 2019 的實際效能，不能只因 server version 正確就宣稱完成。

低併發下，預聚合表與 cache 使目前服務可用；但對完全公開 API 而言，以上前四項是高併發或惡意大型查詢下可能造成 process heap、DB pool 或 SQL Server 資源耗盡的主要缺點。

## 建議後續 slices 與完成條件

1. **P0 release verification：** package version、文件、完整 `server/tests`、OAS identity、兩條 production endpoint smoke test；不改 wire bytes。
2. **P1 observability/resource guard：** 記錄 query duration、DB stream duration、row/byte count、cache hit/miss、heap/pool 指標；設計最大回應、昂貴查詢 concurrency 與 timeout，並加入 `server/tests/`。
3. **P2 stream/cache：** 正確等待 backpressure、single-flight、以 bytes/entry size 控制 cache，避免同一份 response 同時保存多份；以大回應與 slow client 測試 memory ceiling。
4. **P3 SQL monthly performance：** DB owner 先保留 plan/diagnostics，再比較 SARGable date predicate、index/statistics 與 compatibility level；每項修改分開、可 rollback，並保存 representative result set 與 actual plan。
5. **P4 contract cleanup：** canonical parameters、parameterized procedure calls、deterministic ordering/tie-breakers；每項都必須有 consumer compatibility test。

所有 application slice 都要在 `server/tests/` 新增或更新測試；SQL procedure 變更則要在 SQL Server staging/copy 驗證，不能把單純的檔案存在測試當成 DB execution proof。
