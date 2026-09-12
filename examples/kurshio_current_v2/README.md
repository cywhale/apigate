# kurshio_current_v2

第二版：SADCP 海流 + GEBCO 地形（半透明）疊圖。

- SADCP 色階點：20-300m, `mode=0`
- SADCP 箭頭：25-35m, `mode=mean`
- GEBCO：polygon 分塊抓取，`sample=1`

## 執行

```bash
cd /Users/cywhale/proj/apigate/examples/kurshio_current_v2
uv venv --python 3.13
uv sync
uv run python plot_kuroshio_current_v2.py \
  --lon0 120.5 --lon1 123.2 --lat0 21.5 --lat1 26.0 \
  --gebco-sample 1 --gebco-tile-deg 2 \
  --output kuroshio_current_v2_gebco_overlay.png
```

## 參數重點

- `--gebco-sample`: 預設 `1`（此版設計目標）
- `--gebco-tile-deg`: 整數分塊大小（度），預設 `2`
- `--gebco-cache`: GEBCO 快取檔（預設 `gebco_sample1_tile2deg.npz`）

## 輸出

- `kuroshio_current_v2_gebco_overlay.png`

## 單圖（地形感加強版）

```bash
uv run python plot_kuroshio_current_v2.py \
  --gebco-sample 1 --gebco-tile-deg 2 \
  --output kuroshio_current_v2_gebco_overlay_relief_v2.png
```

## 季風比較（雙子圖）

```bash
uv run python plot_kuroshio_current_v2_monsoon.py \
  --mode-left 17 --mode-right 18 \
  --output kurshio_current_v2_monsoon.png
```
