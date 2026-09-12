# kurshio_current (SADCP API + Python/Basemap)

此目錄用公開 ODB SADCP Web API（不連資料庫、不改 server code）重現 Kuroshio 舊案例的第一階段：

- 2D 地圖
- 0.25 度網格平均流場
- Python + Basemap 繪製

## 1) 建立 uv 環境（Python 3.13）

```bash
cd /Users/cywhale/proj/apigate/examples/kurshio_current
uv venv --python 3.13
uv sync
```

## 2) 產圖（20-300m 色階 + 25-35m 箭頭向量）

```bash
uv run python plot_kuroshio_current.py \
  --lon0 120.5 --lon1 123.2 \
  --lat0 21.5 --lat1 26.0 \
  --bg-dep0 20 --bg-dep1 300 --bg-dep-mode mean --bg-mode 0 \
  --vec-dep0 25 --vec-dep1 35 --vec-dep-mode mean --vec-mode mean \
  --title "Kuroshio Current" \
  --output kuroshio_current_2d_0p25_mode0_surfacevec.png
```

說明：

- 色階底圖：20-300m 全年平均（0.25 度網格中心）
- 箭頭向量：25-35m 平均（近表層）
- `--title ""` 可完全不顯示標題

## 3) 若要改成季風案例（同一張圖）

```bash
uv run python plot_kuroshio_current.py \
  --lon0 121 --lon1 122 --lat0 24 --lat1 26 \
  --bg-dep0 20 --bg-dep1 100 --bg-dep-mode mean --bg-mode monsoon \
  --vec-dep0 25 --vec-dep1 35 --vec-dep-mode mean --vec-mode monsoon \
  --title "Kuroshio Current" \
  --output kuroshio_current_2d_0p25_monsoon.png
```

## API 來源

- SADCP endpoint: <https://ecodata.odb.ntu.edu.tw/api/sadcp>
- OAS JSON: <https://api.odb.ntu.edu.tw/search/schema?node=odb_ctd_sadcp_v1%3E/api/sadcp&num=1>
