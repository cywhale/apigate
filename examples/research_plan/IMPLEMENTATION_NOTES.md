# KBC Analog Implementation Notes

- 主圖: `kbc_analog_annual.png`
- 季風雙子圖: `kbc_analog_monsoon.png`
- proxy 圖: `kbc_analog_proxy.png`
- proxy 資料: `kbc_analog_proxy.csv`, `kbc_analog_proxy.json`
- 摘要: `kbc_analog_summary.md`

目前 proxy 已改為較符合物理意義的斷面輸送法：

- 斷面: `121.0E`
- 緯度帶: `21.0N~22.5N`
- 深度帶: `50m~150m`
- 指標: 斷面上所有 `u < 0` 格點的向西輸送總和

這個版本比第一輪「盒區內西北向格點比例」更能代表 KBC 入侵強度。
