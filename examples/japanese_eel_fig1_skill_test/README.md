# Western North Pacific Current Map Analogue for Japanese Eel Migration

本目錄提供一張公開資料版本的西北太平洋海流與地形解說圖，靈感來自 Chang et al. (2018) 的 Figure 1，用來幫助說明日本鰻在西北太平洋的產卵區、洋流路徑與地形背景之間的關係。

參考文獻：

- Chang, YL.K., Miyazawa, Y., Miller, M.J. et al. Potential impact of ocean circulation on the declining Japanese eel catches. *Sci Rep* 8, 5496 (2018). https://doi.org/10.1038/s41598-018-23820-6

參考圖：

- [41598_2018_23820_Fig1_HTML.webp](/Users/cywhale/proj/apigate/examples/research_plan/papers/41598_2018_23820_Fig1_HTML.webp)

這裡需要先說明一個重要差異。原論文中的 Figure 1 並不是單純把觀測資料平均後直接作圖。論文方法指出，其海流背景主要來自 **JCOPE2 資料同化海洋再分析模式**，涵蓋 `1993–2013` 年，具有約 `1/12°` 的水平解析度與 `46` 個垂直層。因此，原圖中的灰色向量場會比公開 ODB API 提供的 `0.25°` 觀測平均流場更平滑、完整，也更接近模式產品常見的空間連續性。

本目錄中的圖則採用不同的資料基礎：

- 海流向量：ODB SADCP API 的公開 `0.25°` 格點平均流場
- 地形背景：ODB GEBCO API 的公開海底地形資料

因此，這張圖的目的不是逐像素重現原論文，而是提供一張 **公開資料可重現的科普類比圖**。和原圖相比，這裡的海流向量可能較稀疏，也可能在部分區域留白；這代表公開觀測平均場在那些位置的覆蓋有限，而不是繪圖錯誤。

在目前這個範圍與資料條件下，`30–100 m` 的流場平均比 `0–200 m` 更適合作為示意。原因是東海陸棚與台灣海峽較淺，若直接做 `0–200 m` 平均，淺水區靠近下限深度的可用資料會變少，沿岸與棚坡附近也較容易受局部異常值影響。相較之下，`30–100 m` 較能維持大尺度流向的可讀性。

同時，向量圖使用簡單且可調整的 `count` 門檻來篩選資料點，預設只保留 `count >= 30` 的格點。這不是嚴格的海洋動力學判準，而是一個對外容易說明、又能減少稀疏樣本干擾的實務作法。

執行方式：

```bash
cd /Users/cywhale/proj/apigate/examples/japanese_eel_fig1_skill_test
uv sync
uv run python plot_japanese_eel_fig1_skill_test.py
```

主要輸出：

- `japanese_eel_fig1_skill_test.png`：`30–100 m` 公開觀測類比圖
- `japanese_eel_fig1_skill_test_200m.png`：`0–200 m` 比較版本
- `skill_validation_review.md`
