# Subagent Briefing

此文件是提供給 `research-reproduction-planner` 的固定任務背景，避免後續規劃偏離 ODB SADCP 的真實能力範圍。

## 任務目標

以真實文獻為基礎，選出適合使用 ODB SADCP 公開 API 做科學研究重現或類比的案例。重點不是重做整篇論文，而是從單篇研究中選出一個具科學意義的圖、段落、或問題，形成可直接交付開發的 plan 與 spec。

## 必讀輸入

1. [gemini_deep_reseach_SADCP.pdf](/Users/cywhale/proj/apigate/examples/research_plan/gemini_deep_reseach_SADCP.pdf)
2. [第一版 ODB SADCP README](/Users/cywhale/proj/apigate/examples/kurshio_current/README.md)
3. [第二版 ODB SADCP + GEBCO README](/Users/cywhale/proj/apigate/examples/kurshio_current_v2/README.md)

## 三個優先起始案例

1. 黑潮大蛇行與都市熱浪
   - [10.1175/JCLI-D-20-0387.1](https://doi.org/10.1175/JCLI-D-20-0387.1)
2. SAE 次表層反氣旋渦
   - [10.1175/JPO-D-22-0106.1](https://doi.org/10.1175/JPO-D-22-0106.1)
3. 黑潮分支流與鰻苗輸送
   - [10.3390/jmse9121465](https://doi.org/10.3390/jmse9121465)

## 已知 ODB SADCP 技術背景

- 公開 API，可直接調用，不可依賴私有資料庫。
- 主工作產品為 0.25 度平均流場。
- 已驗證圖型：
  - 20-300 m 平均流速散點
  - 25-35 m 表層箭頭
  - 年平均與季風比較
  - GEBCO 疊圖
- 已知限制：
  - 無法重現 0.1 度私有補格
  - 無法憑 ODB 單獨重做原始航次、逐日事件、細尺度渦邊界
  - 無法僅靠流速判定溫鹽水團性質

## 新增可納入評估的 ODB 開放 API

- ODB CTD API
  - endpoint 為 `/api/ctd`
  - 與 SADCP 參數相近
  - 可提供 0.25 度格點的溫度、鹽度、密度等平均場
  - 對 SAE 這類需要水團與次表層結構支撐的案例，應重新評估可行性
- ODB MHW API
  - 可提供 0.25 度格點、長時間序列的每月 `sst`, `sst_anomaly`, `level`
  - 區域與時間下載需遵守 payload 限制
  - 對黑潮大蛇行 Fig. 1 類型的解說圖，應重新評估可行性

## 可接受成果

- 重現或類比單篇研究中的一張圖
- 重現或類比單篇研究中的一組雙子圖或圖表組
- 回答單篇研究中的一個具體科學問題

## 不可接受成果

- 只做漂亮底圖，沒有科學問題
- 把視覺模仿誤說成研究重現
- 依賴無法取得的私有資料但未明說
- 未區分哪些是重現、哪些只是類比

## 本輪主 agent 審核標準

- 文獻必須真實可追溯
- 主攻案例必須能被 ODB SADCP 公開 API 支撐
- 輸出圖或分析必須有科學意義
- spec 必須具體到另一個開發 agent 不需要再猜
