# ODB SADCP 科普研究重現規劃說明

本目錄不是程式實作，而是下一階段科學重現與類比開發的規劃包。目標是從真實海洋學研究中，選出一個最適合用 ODB SADCP 公開 API 做圖與說明的案例。

## 為什麼需要先做規劃

SADCP 題材很容易落入兩種錯誤：

1. 只畫出一張好看的海流圖，但沒有回答科學問題。
2. 明明只能做公開資料的類比，卻誤稱重現了原論文。

因此本輪先處理三件事：

- 研究文獻是否真實、可追溯
- ODB SADCP API 能支撐到哪個層級
- 哪個題材最適合做第一個對外科普案例

## ODB SADCP 的角色

根據目前已完成的實作基線：

- [第一版 ODB SADCP 海流圖](/Users/cywhale/proj/apigate/examples/kurshio_current/README.md)
- [第二版 ODB SADCP + GEBCO 疊圖](/Users/cywhale/proj/apigate/examples/kurshio_current_v2/README.md)

我們已確認 ODB SADCP 很適合做：

- 0.25 度網格平均流場圖
- 黑潮主軸位置與方向判讀
- 深層背景流速與近表層箭頭比較
- 東北季風與西南季風對照
- 配合地形背景做科普式流場圖像

但它不適合直接做：

- 私有資料庫 0.1 度補格產品
- 原始航次或高頻事件重現
- 只靠流速就判定渦旋的溫鹽水團性質
- 精確重做論文中的所有統計與生物輸送結果

## 新增可支撐備案的 ODB API

除了 SADCP 之外，現在已知還有兩個公開 API 可納入同一個規劃框架：

- ODB CTD API
  - 0.25 度格點平均溫度、鹽度、密度
  - 可補上 SAE 類題目對水文背景的基本需求
- ODB MHW API
  - 0.25 度格點月資料，含 `sst`, `sst_anomaly`, `level`
  - 可支撐黑潮大蛇行 Fig. 1 類型的 SST / anomaly 解說圖
  - 下載時需遵守區域與時間長度限制

## 本輪主攻案例

本輪建議主攻案例為：

- [Han et al. 2021, *Potential Effect of the Intrusion of the Kuroshio Current into the South China Sea on Catches of Japanese Eel (Anguilla Japonica) in the South China Sea and Taiwan Strait*](https://doi.org/10.3390/jmse9121465)

選這篇的理由：

- 研究區與 ODB 已驗證範圍高度重疊。
- 題目具明確科學問題，也具科普價值。
- 即使不重做 ENSO 年與漁獲統計，我們仍可用 ODB 流場資料回答一個有意義的問題：
  - 什麼樣的背景流場較支持 KBC 向西北侵入南海與海峽？

## 三個優先案例的定位

## 1. 黑潮分支流與鰻苗輸送

- 主文獻: [Han et al. 2021](https://doi.org/10.3390/jmse9121465)
- 規劃定位: 主攻
- 原因: ODB 能做出具有科學意義的流場類比，不只是畫圖

## 2. 深海飛碟 SAE

- 主文獻: [Wang et al. 2023](https://doi.org/10.1175/JPO-D-22-0106.1)
- 規劃定位: 高價值備案
- 原因: 現在已有 ODB CTD API，可把它提升為「可做結構類比」的備案；但即使如此，仍不能只靠公開平均場宣稱已完整重現原論文中的 SAE 事件

## 3. 黑潮大蛇行與都市熱浪

- 主文獻: [Sugimoto et al. 2021](https://doi.org/10.1175/JCLI-D-20-0387.1)
- 規劃定位: 高吸引力備案
- 原因: 現在已有 ODB MHW API，可望做出 Fig. 1 類型的解說圖；但若要碰原論文的熱浪機制主題，仍超出目前最佳使用情境

## 其他有價值的補充文獻

- [Wang et al. 2025, *Atypical seasonal variability of the Kuroshio Current in 2018*](https://doi.org/10.3389/fmars.2025.1675413)
- [Qi et al. 2022, *A lens-shaped, cold-core anticyclonic surface eddy in the northern South China Sea*](https://doi.org/10.3389/fmars.2022.976273)
- [Rudnick et al. 2015, *Mean Structure and Fluctuations of the Kuroshio East of Taiwan from In Situ and Remote Observations*](https://doi.org/10.5670/oceanog.2015.83)
- [Andres et al. 2015, *Mean Structure and Variability of the Kuroshio from Northeastern Taiwan to Southwestern Japan*](https://doi.org/10.5670/oceanog.2015.84)
- [Chang et al. 2018, *Potential impact of ocean circulation on the declining Japanese eel catches*](https://doi.org/10.1038/s41598-018-23820-6)

## 海洋科學脈絡

這個主題之所以適合科普，不只是因為黑潮有名，而是因為它把三個層次串了起來：

1. 大尺度海洋環流
   - 黑潮是西邊界流，會沿臺灣東側北上，並在特定條件下向西北侵入南海。
2. 區域海洋動力
   - 呂宋海峽與臺灣海峽周邊地形，會影響入侵路徑與局部流場分支。
3. 生態與人類感受
   - 若支流入侵比例改變，幼體輸送路徑可能改變，進一步影響漁獲與生物分布。

這種題目同時有海流物理基礎與具體生物意涵，最適合做成一個對外可說明的科學圖像。

## 主攻案例與備案的取捨

主攻選 Han et al. 2021，不是因為它最簡單，而是因為它在公開資料條件下仍能保留科學意義。

備案沒有被選主攻的主因如下：

- SAE 題材需要超出 ODB SADCP 的額外水文證據。
- 黑潮大蛇行題材太依賴事件期海氣資料。
- 東臺灣黑潮平均結構雖然最穩，但科普故事性較弱。

## 本輪交付物

- [source_manifest.md](/Users/cywhale/proj/apigate/examples/research_plan/source_manifest.md)
- [case_screening.md](/Users/cywhale/proj/apigate/examples/research_plan/case_screening.md)
- [plan.md](/Users/cywhale/proj/apigate/examples/research_plan/plan.md)
- [spec.md](/Users/cywhale/proj/apigate/examples/research_plan/spec.md)
- [review.md](/Users/cywhale/proj/apigate/examples/research_plan/review.md)

## 主攻案例實作輸出

已依 [spec.md](/Users/cywhale/proj/apigate/examples/research_plan/spec.md) 完成第一輪實作：

- 主圖: [kbc_analog_annual.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_annual.png)
- 季風雙子圖: [kbc_analog_monsoon.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_monsoon.png)
- Proxy 圖: [kbc_analog_proxy.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_proxy.png)
- Proxy 表: [kbc_analog_proxy.csv](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_proxy.csv)
- Proxy JSON: [kbc_analog_proxy.json](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_proxy.json)
- 摘要: [kbc_analog_summary.md](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_summary.md)
- 實作腳本: [plot_kbc_analog.py](/Users/cywhale/proj/apigate/examples/research_plan/plot_kbc_analog.py)
- `uv` 設定: [pyproject.toml](/Users/cywhale/proj/apigate/examples/research_plan/pyproject.toml)

## 執行方式

```bash
cd /Users/cywhale/proj/apigate/examples/research_plan
uv sync
uv run python plot_kbc_analog.py --output-prefix kbc_analog
```

## 第一輪 proxy 結果

以目前 `spec.md` 採用的目標盒區法：

- Annual: `13.46%`
- NE Monsoon: `17.31%`
- SW Monsoon: `19.23%`

這代表在目前盒區與條件 `u < 0, v > 0` 下，`SW Monsoon > NE Monsoon > Annual`。這是第一輪數值結果，不應先驗地套用既有敘事，下一步需要做的是檢查 proxy 定義是否最能代表 KBC 入侵。

## 本地全文補充

以下三篇原先有取得障礙的文獻，現已補齊到本目錄，可供後續更深入規劃：

- [clim-JCLI-D-20-0387.1.pdf](/Users/cywhale/proj/apigate/examples/research_plan/clim-JCLI-D-20-0387.1.pdf)
- [phoc-JPO-D-22-0106.1.pdf](/Users/cywhale/proj/apigate/examples/research_plan/phoc-JPO-D-22-0106.1.pdf)
- [s41598-018-23820-6.pdf](/Users/cywhale/proj/apigate/examples/research_plan/s41598-018-23820-6.pdf)

## 參考來源

- Gemini deep research input: [gemini_deep_reseach_SADCP.pdf](/Users/cywhale/proj/apigate/examples/research_plan/gemini_deep_reseach_SADCP.pdf)
- ODB SADCP API 背景:
  - [第一版 README](/Users/cywhale/proj/apigate/examples/kurshio_current/README.md)
  - [第二版 README](/Users/cywhale/proj/apigate/examples/kurshio_current_v2/README.md)
