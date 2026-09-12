# ODB SADCP 研究案例來源清單

此清單根據 [gemini_deep_reseach_SADCP.pdf](/Users/cywhale/proj/apigate/examples/research_plan/gemini_deep_reseach_SADCP.pdf) 抽取案例，再由主 agent 重新核實 DOI、期刊頁與全文取得狀態。

## 方法

- 先讀取 Gemini deep research PDF 中的案例與連結。
- 以 DOI 或出版社頁驗證文獻真實性。
- 優先確認是否可取得全文，若無法取得，明確標記為僅驗證 metadata。
- 同時判斷該案例是否能被 ODB SADCP 公開 API 以「重現」或「類比」方式支撐。

## 主要優先案例

| 類別 | 文獻 | DOI / 期刊頁 | 全文來源 | 取得狀態 | 可信度 | 與 ODB SADCP 關聯 |
| --- | --- | --- | --- | --- | --- | --- |
| 黑潮大蛇行與都市熱浪 | Sugimoto et al., 2021, *Journal of Climate* | DOI: [10.1175/JCLI-D-20-0387.1](https://doi.org/10.1175/JCLI-D-20-0387.1), 期刊頁: [AMS](https://journals.ametsoc.org/view/journals/clim/34/9/JCLI-D-20-0387.1.xml) | 本地 PDF: [clim-JCLI-D-20-0387.1.pdf](/Users/cywhale/proj/apigate/examples/research_plan/clim-JCLI-D-20-0387.1.pdf) | `full text obtained` | 高 | 科學問題很強，但地理焦點偏日本南方至本州沿岸，且事件型大蛇行不適合以 ODB 0.25 度 climatology 直接重現 |
| 次表層反氣旋渦 SAE | Wang et al., 2023, *Journal of Physical Oceanography* | DOI: [10.1175/JPO-D-22-0106.1](https://doi.org/10.1175/JPO-D-22-0106.1), 期刊頁: [AMS](https://journals.ametsoc.org/view/journals/phoc/53/3/JPO-D-22-0106.1.xml) | 本地 PDF: [phoc-JPO-D-22-0106.1.pdf](/Users/cywhale/proj/apigate/examples/research_plan/phoc-JPO-D-22-0106.1.pdf) | `full text obtained` | 高 | 區域很接近，且主題與流場結構高度相關，但原文依賴 SADCP 與水文資料辨識透鏡狀結構，ODB 單獨只能做類比，不足以確認水團性質 |
| 聖嬰年黑潮分支流與鰻苗輸送 | Han et al., 2021, *Journal of Marine Science and Engineering* | DOI: [10.3390/jmse9121465](https://doi.org/10.3390/jmse9121465), 期刊頁: [MDPI](https://www.mdpi.com/2077-1312/9/12/1465) | MDPI 文章頁可讀；PDF 在此環境受限 | `full text browsable` | 高 | 與臺灣、呂宋海峽、南海北部高度一致；可用 ODB 建立 KBC 入侵與季風/背景流場的類比圖與 proxy 問題 |

## 補充候選案例

| 類別 | 文獻 | DOI / 期刊頁 | 全文來源 | 取得狀態 | 可信度 | 與 ODB SADCP 關聯 |
| --- | --- | --- | --- | --- | --- | --- |
| 黑潮異常季節變化 | Wang et al., 2025, *Frontiers in Marine Science* | DOI: [10.3389/fmars.2025.1675413](https://doi.org/10.3389/fmars.2025.1675413), 文章頁: [Frontiers](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2025.1675413/full) | PDF 已下載: [papers/frontiers_2025.pdf](/Users/cywhale/proj/apigate/examples/research_plan/papers/frontiers_2025.pdf) | `full text obtained` | 高 | 主題是真實流速季節異常，但研究區在 18°N 斷面，與現有 ODB 臺灣案例可做方法類比，不適合直接作為第一個科普重現主題 |
| 冷核反氣旋表層渦 | Qi et al., 2022, *Frontiers in Marine Science* | DOI: [10.3389/fmars.2022.976273](https://doi.org/10.3389/fmars.2022.976273), 文章頁: [Frontiers](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2022.976273/full) | PDF 已下載: [papers/frontiers_2022.pdf](/Users/cywhale/proj/apigate/examples/research_plan/papers/frontiers_2022.pdf) | `full text obtained` | 高 | 位於南海北部，與 SAE 題材相近，可作開放全文替代背景；但主體仍需更多溫鹽與剖面資料，不適合直接拿 ODB 做完整重現 |
| 黑潮東臺灣結構 | Rudnick et al., 2015, *Oceanography* | DOI: [10.5670/oceanog.2015.83](https://doi.org/10.5670/oceanog.2015.83), 文章頁: [Oceanography](https://tos.org/oceanography/article/mean-structure-and-fluctuations-of-the-kuroshio-east-of-taiwan-from-in-situ) | 文章頁可讀 | `full text browsable` | 高 | 與 ODB 核心區域高度吻合，適合作為背景與方法對照；但科普敘事較偏結構描述，不如 KBC 與鰻苗題目直觀 |
| 黑潮由東北臺灣到西南日本 | Andres et al., 2015, *Oceanography* | DOI: [10.5670/oceanog.2015.84](https://doi.org/10.5670/oceanog.2015.84), 文章頁: [Oceanography](https://tos.org/oceanography/article/mean-structure-and-variability-of-the-kuroshio-from-northeastern-taiwan-to) | 文章頁可讀 | `full text browsable` | 高 | 可支撐黑潮結構與變異的背景說明，但較像綜述型結構文章，較不適合作為單一科普主題 |
| 日本鰻苗與環流變化 | Chang et al., 2018, *Scientific Reports* | DOI: [10.1038/s41598-018-23820-6](https://doi.org/10.1038/s41598-018-23820-6) | 本地 PDF: [s41598-018-23820-6.pdf](/Users/cywhale/proj/apigate/examples/research_plan/s41598-018-23820-6.pdf) | `full text obtained` | 高 | 與鰻苗輸送主題高度相關，可作 Han et al. 2021 的背景補強，也可協助界定 KBC 與鰻苗輸送的較長期環流脈絡 |

## 由 PDF 抽取到、但本輪不列入主攻池的來源

- 黑潮大蛇行動力機制文獻: [10.1175/JPO-D-18-0276.1](https://doi.org/10.1175/JPO-D-18-0276.1)
  - 真實性無疑，但偏動力學機制，不是本輪最適合的科普圖像重現對象。
- NOAA JASADCP 與其他一般性 ADCP 應用資料頁
  - 可作技術背景，不作研究案例本體。

## 來源狀態更新

使用者已補齊以下本地全文：

1. [clim-JCLI-D-20-0387.1.pdf](/Users/cywhale/proj/apigate/examples/research_plan/clim-JCLI-D-20-0387.1.pdf)
2. [phoc-JPO-D-22-0106.1.pdf](/Users/cywhale/proj/apigate/examples/research_plan/phoc-JPO-D-22-0106.1.pdf)
3. [s41598-018-23820-6.pdf](/Users/cywhale/proj/apigate/examples/research_plan/s41598-018-23820-6.pdf)

因此本輪主攻與高優先備案都已具備可讀全文基礎。
