# Japanese Eel Fig. 1 Skill-Only Check

本目錄用來確認：若另一個 AI agent 只依賴 `odb-openapi-ocean-maps` 技能中提供的 API helper 與版面規則，是否仍能產生一張版面正確、色條不重疊、向量長度適中的西北太平洋海流資訊圖。

這裡採用的設定為：

- ODB SADCP `30–100 m` 平均流場
- `count >= 30` 才畫向量
- GEBCO 作為地形背景
- 外置、細短的 horizontal colorbar

執行方式：

```bash
cd /Users/cywhale/proj/apigate/examples/japanese_eel_fig1_skill_only_check
uv sync
uv run python plot_japanese_eel_fig1_skill_only.py
```

輸出：

- `japanese_eel_fig1_skill_only.png`
