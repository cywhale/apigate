# ODB Open API Scientific Figure Reproduction Project Report

## 摘要

本專案以 ODB 公開海洋資料 API 為核心，建立一條可重現的科學繪圖工作流程：從研究問題與論文圖像出發，將科學需求翻譯為公開 API 查詢、可驗證的資料處理與圖像設計，最後整理成可供 AI agent 直接調用的技能（skill）。

本計畫完成三個層次的成果。第一，使用 ODB SADCP、CTD、GEBCO 與 MHW API，建立一組可重現的海洋科學繪圖範例。第二，選定「黑潮分支流與日本鰻苗輸送」作為主軸案例，完成流場圖、季風比較圖與可重算 proxy。第三，將這些經驗整理成 `odb-openapi-ocean-maps` skill，並以 Basemap、Cartopy 與短 prompt 盲測驗證其可用性。

本專案的價值不在於逐像素重現原論文所有圖件，而在於建立一套對外公開、可被重跑、且對科學限制保持誠實的工作流程，使公開 API 能夠支撐研究圖像的「類比重現」與科普化轉譯。

## 前言與動機

許多海洋學研究圖件背後依賴私有資料、模式產品、事件年資料或特定研究航次，因此外部讀者即使理解研究問題，也難以用公開資料重新做出具科學意義的圖像。ODB 提供 SADCP、CTD、GEBCO 與 MHW 等公開 API，讓這個困境部分被打開：雖然公開產品多為 0.25 度格點平均場，無法取代原始資料或資料同化模式，但已足以支撐結構型、氣候態與科學解說型圖像的重建。

本專案的目標不是宣稱「完全重現」原研究，而是建立一條可被一般使用者與 AI agent 重複執行的流程，將 API 查詢結果轉成可對外說明、具有科學意義的圖像與分析。

## 工作流程總覽

本專案的核心流程如流程圖所示：

- 從研究問題或論文圖件出發
- 選擇可對應的 ODB Open APIs
- 根據資料解析度、時間模式與觀測限制，重新翻譯為可實作的科學問題
- 建立可重現的圖像邏輯與分析指標
- 形成實際案例與驗證產物
- 最後抽象成 AI agent 可調用的 skill

主要流程圖：

- [odb_api_to_skill_workflow.png](/Users/cywhale/proj/apigate/examples/research_plan/odb_api_to_skill_workflow.png)

## 使用的公開資料與工具

### ODB Open APIs

- ODB SADCP API：提供 0.25 度格點平均流場
- ODB CTD API：提供 0.25 度格點平均溫度、鹽度與密度場
- ODB GEBCO API：提供海底地形與地表高程資料
- ODB MHW API：提供 SST、SST anomaly 與相關月平均資料

### 視覺化與開發工具

- Python 3.13
- `uv` 管理專案環境
- Matplotlib
- Basemap 與 Cartopy
- 自建 `odb-openapi-ocean-maps` skill

## 方法

### 1. 研究問題轉譯

每個案例都先從文獻圖件或研究問題出發，判斷其核心證據鏈是否能由公開 ODB API 支撐。若原研究依賴私有資料、逐日事件、資料同化模式或原始航次，則不宣稱完整重現，而改為「結構類比」或「科學現象解說圖」。

### 2. API 查詢與資料檢核

資料處理時採用幾個原則：

- 先用小區域確認 API 非空，再跑大圖
- 不隱含插值、不偽造資料
- 對向量圖採用簡單的 `count >= 30` 品質門檻
- 對 gridded scalar 場，以格網填色而非重疊圓點表示
- 對大型 GEBCO 範圍，使用 tiled fetch 與快取

### 3. 圖像設計原則

- gridded scalar 場：使用格網填色（`pcolormesh`）
- vector 場：僅表達流向與速度，不與同一流場量重複編碼
- colorbar：外置、細短、不得遮住主圖與標題
- 地形：GEBCO 可作背景，但不應掩蓋主資訊
- 圖說：明確標示哪些部分是重現、哪些部分是類比

## 主軸案例：黑潮分支流與日本鰻苗輸送

主軸案例以 Han et al. (2021) 的 Kuroshio Branch Current 問題為出發點，嘗試回答：在公開 0.25 度流場下，哪些背景流況較支持黑潮水向西侵入南海北部與臺灣海峽。

### 主要輸出

- 年平均流場圖：[kbc_analog_annual.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_annual.png)
- 東北季風 / 西南季風比較圖：[kbc_analog_monsoon.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_monsoon.png)
- KBC proxy 圖：[kbc_analog_proxy.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_proxy.png)

### 方法摘要

- 背景流場：SADCP `20–300 m`
- 表層向量：SADCP `25–35 m`
- proxy：`121°E`, `21.0–22.5°N`, `50–150 m` 斷面的向西輸送強度指標

### 主要結果

proxy 結果為：

- Annual: `0.709 Sv`
- NE Monsoon: `0.880 Sv`
- SW Monsoon: `0.641 Sv`

在目前定義下，得到 `NE > Annual > SW`，與既有物理認知較一致，適合作為公開資料條件下的 KBC 類比指標。

## 備案案例成果

### 備案 1：SAE 次表層反氣旋渦旋類比

此案例結合 ODB CTD 與 SADCP，展示次表層溫鹽與流場結構的類比圖。

- 圖件：[sae_analog_ctd_sadcp.png](/Users/cywhale/proj/apigate/examples/sae_ctd_sadcp_analog/sae_analog_ctd_sadcp.png)

此圖證明：當公開 CTD API 可提供溫度、鹽度與密度時，原本僅靠流速無法支撐的水團結構問題，就能提升為較具科學意義的結構類比。

### 備案 2：黑潮大蛇行 Fig.1 類型解說圖

此案例利用 ODB MHW API 的 `sst_anomaly` 月資料，重建黑潮大蛇行期間冷水池的 Fig.1 類型解說圖。

- 圖件：[kuroshio_large_meander_fig1_like.png](/Users/cywhale/proj/apigate/examples/kuroshio_large_meander_fig1/kuroshio_large_meander_fig1_like.png)

這個案例顯示：即使缺少完整海氣耦合資料，公開 MHW API 仍可支撐一張具有科學敘事能力的現象解說圖。

## Skill 建置與 AI Agent 驗證

在案例完成後，本專案將資料流程、繪圖規則與限制整理成 `odb-openapi-ocean-maps` skill。這個 skill 的目的，是讓 AI agent 在沒有既有腳本的情況下，仍可從簡短 prompt 出發，調用 ODB APIs 並生成合理的海洋資訊圖。

### Skill 內容摘要

- ODB API helper scripts
- Basemap / Cartopy 後端選擇
- GEBCO tiled fetch 與快取
- scalar / vector map template
- parameter cheatsheet
- backend decision rule
- science caveats

### 驗證結果

1. Japanese eel Fig.1 類比圖已以 Basemap 與 Cartopy 驗證
2. template 已驗證可生成：
   - scalar gridded current map
   - vector map
   - GEBCO-only colorbar map
3. 短 prompt 盲測成功：
   - [kuroshio_skill_prompt_blind_test.png](/Users/cywhale/proj/apigate/examples/kuroshio_skill_prompt_blind_test/kuroshio_skill_prompt_blind_test.png)

這代表 skill 不只是一份說明文件，而是已經能支持 AI agent 在有限 prompt 下完成具科學可讀性的圖像生成。

## 限制與原則

本專案持續遵守以下原則：

- 不以公開 0.25 度平均場冒充原始事件資料
- 不以觀測平均圖宣稱重現資料同化模式結果
- 不以單張圖取代原論文的全部證據鏈
- 若原論文使用模式或私有資料，則明示本圖為類比或解說圖

尤其以日本鰻 Fig.1 類比圖為例，原論文使用 JCOPE2 資料同化再分析模式，因此其流場平滑度與空間完整性本來就高於 ODB 公開觀測平均場。這種差異屬於資料來源差異，而不是繪圖失敗。

## 結論

本專案證明，ODB Open APIs 不只是資料查詢接口，而可以被組織成一條公開、可重跑、對科學限制誠實的研究圖像工作流程。透過案例開發、圖像驗證與 skill 抽象化，原本分散於 API 查詢、繪圖腳本與研究說明之間的經驗，已被整理成一套可供人與 AI agent 共同使用的 reproducible workflow。

這使得公開海洋資料不再只是「可被下載」，而是能進一步成為研究重現、科普轉譯與 AI-assisted scientific visualization 的基礎。

## 參考文獻

- Chang, YL.K., Miyazawa, Y., Miller, M.J. et al. Potential impact of ocean circulation on the declining Japanese eel catches. *Scientific Reports* 8, 5496 (2018). https://doi.org/10.1038/s41598-018-23820-6
- Han, Y.-S. et al. Potential Effect of the Intrusion of the Kuroshio Current into the South China Sea on Catches of Japanese Eel (*Anguilla japonica*) in the South China Sea and Taiwan Strait. *Journal of Marine Science and Engineering* 9(12), 1465 (2021). https://doi.org/10.3390/jmse9121465
