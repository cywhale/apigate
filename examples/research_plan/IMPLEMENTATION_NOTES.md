# KBC Analog Implementation Notes

- 主圖: `kbc_analog_annual.png`
- 季風雙子圖: `kbc_analog_monsoon.png`
- proxy 圖: `kbc_analog_proxy.png`
- proxy 資料: `kbc_analog_proxy.csv`, `kbc_analog_proxy.json`
- 摘要: `kbc_analog_summary.md`

目前 proxy 採 `spec.md` 建議的目標區域法：

- 盒區: `120.5E~121.75E`, `21.0N~23.5N`
- 條件: `u < 0` 且 `v > 0`

這個定義的優點是對 0.25 度格點比較穩健，且可直接用 SADCP 公開 API 回傳欄位重算。
