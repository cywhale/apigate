# sae_ctd_sadcp_analog

此目錄是備案 1 的第一輪實作評估與開發。

主題：

- 以 ODB CTD + SADCP 公開 API 做南海北部 SAE 類型結構的科學類比

重點：

- 左上主圖用 CTD 鹽度平均場搭配 SADCP 次表層向量
- 下方兩個剖面圖用 CTD 溫度、鹽度與密度等值線顯示次表層結構
- 這是結構類比，不是原論文 2021 事件重現

執行：

```bash
cd /Users/cywhale/proj/apigate/examples/sae_ctd_sadcp_analog
uv sync
uv run python plot_sae_analog.py
```

輸出：

- `sae_analog_ctd_sadcp.png`
- `sae_analog_summary.md`
