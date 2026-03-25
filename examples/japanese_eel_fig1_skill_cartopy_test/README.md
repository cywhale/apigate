# Japanese Eel Fig. 1 Skill Cartopy Test

這個目錄用來做整合後 skill 的盲測：不借用舊案例腳本，只用 `odb-openapi-ocean-maps` 最新 helper，以 Cartopy 後端重新繪製日本鰻 Figure 1 類比圖。

重點檢查：

- Cartopy coastline 與 GEBCO 背景是否能形成清楚的海洋地圖
- 30–100 m 的 SADCP 向量是否仍維持可讀性
- 首次執行時，Cartopy 是否需要額外下載 coastline 資源
