# kuroshio_large_meander_fig1

此目錄是備案 2 的第一輪實作評估與開發。

主題：

- 用 ODB MHW API 做黑潮大蛇行 Fig.1 類型的解說圖

設計：

- 上排兩張圖顯示 2017-07 與 2017-08 的 SST anomaly
- 下排時間序列顯示南日本外海一個代表點的月平均 SST anomaly
- 這是「科學現象解說圖」，不是原論文全部海氣機制的重現

執行：

```bash
cd /Users/cywhale/proj/apigate/examples/kuroshio_large_meander_fig1
uv sync
uv run python plot_large_meander_fig1.py
```

輸出：

- `kuroshio_large_meander_fig1_like.png`
- `kuroshio_large_meander_fig1_summary.md`
