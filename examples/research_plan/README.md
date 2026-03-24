# 黑潮分支流與日本鰻苗輸送

本目錄示範如何只使用公開 ODB API，重建一個與黑潮分支流（Kuroshio Branch Current, KBC）有關的科學圖像問題：在呂宋海峽到臺灣海峽之間，哪些背景流場較支持黑潮水向西侵入南海北部，進而可能影響日本鰻苗的輸送路徑。

研究背景主要參考：

- [Han et al. 2021, *Potential Effect of the Intrusion of the Kuroshio Current into the South China Sea on Catches of Japanese Eel (Anguilla Japonica) in the South China Sea and Taiwan Strait*](https://doi.org/10.3390/jmse9121465)
- [Chang et al. 2018, *Potential impact of ocean circulation on the declining Japanese eel catches*](https://doi.org/10.1038/s41598-018-23820-6)

## 這個案例在做什麼

這個案例不是重做原論文的全部分析，而是用公開 0.25 度格點流場，回答一個可對外說明的問題：

- 在不同季節背景下，黑潮分支流向西侵入的指標是否改變？

為了讓這個問題不只是看圖說故事，這裡除了地圖之外，還另外定義了一個可重算的 proxy。

## 使用的資料

- ODB SADCP API
  - 20–300 m 深層平均流速背景
  - 25–35 m 近表層流向箭頭
  - 50–150 m 次表層 proxy 計算
- ODB GEBCO API
  - 海底地形與陸地背景

## 主要輸出

- 年平均流場圖: [kbc_analog_annual.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_annual.png)
- 東北季風與西南季風比較圖: [kbc_analog_monsoon.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_monsoon.png)
- KBC proxy 圖: [kbc_analog_proxy.png](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_proxy.png)
- Proxy 資料表: [kbc_analog_proxy.csv](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_proxy.csv)
- Proxy 摘要: [kbc_analog_summary.md](/Users/cywhale/proj/apigate/examples/research_plan/kbc_analog_summary.md)

## 方法

### 地圖

- 主圖區域：`119.5–123.5°E`, `20.5–26.5°N`
- 色階散點：20–300 m 平均流速
- 白色箭頭：25–35 m 平均流向
- 地形：GEBCO bathymetry relief

### Proxy

第一輪採用的格點比例法容易把局部渦旋或風場造成的西北向流誤判為 KBC 入侵，因此這裡改成較貼近物理意義的斷面輸送指標：

- 斷面：`121°E`
- 緯度帶：`21.0–22.5°N`
- 深度層：`50–150 m`
- 指標：斷面上所有 `u < 0` 格點的向西輸送強度總和，以 `Sv` 表示的 proxy index

這個 proxy 的目的不是給出絕對真實的體積流率，而是比較不同模式下相對強弱。

## 目前結果

目前算出的 proxy 為：

- Annual: `0.709 Sv`
- NE Monsoon: `0.880 Sv`
- SW Monsoon: `0.641 Sv`

在這個定義下，結果變成：

- `NE Monsoon > Annual > SW Monsoon`

這比第一輪單純格點比例法更符合既有物理認知，也更適合作為後續科學解釋的起點。

## 如何重跑

```bash
cd /Users/cywhale/proj/apigate/examples/research_plan
uv sync
uv run python plot_kbc_analog.py --output-prefix kbc_analog
```

## 限制

- 這是公開 0.25 度平均流場的科學類比，不是事件年重建。
- 無法直接重做 ENSO 年、漁獲統計或原論文中的完整輸送模擬。
- 圖像與 proxy 的角色是幫助理解 KBC 背景流場，而不是替代原研究的全部證據鏈。
