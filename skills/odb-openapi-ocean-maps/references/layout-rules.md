# Layout Rules

## Colorbars

- For a single map axis, or a small shared group of axes, prefer:
  - `fig.colorbar(mappable, ax=ax, orientation="horizontal", pad=..., fraction=..., shrink=...)`
  - this lets Matplotlib reserve space outside the plot instead of drawing over the map area
- Use a dedicated `cax` only when the default external placement is still unstable across many panels.
- Prefer horizontal colorbars with:
  - `fraction` about `0.03` to `0.05`
  - `shrink` about `0.40` to `0.60`
  - `pad` about `0.03` to `0.06`
- If maps occupy the upper row and a colorbar sits below them, remove lower longitude labels from that row if needed.
- Keep labels short.

Example:

```python
cbar = fig.colorbar(
    mappable,
    ax=ax,
    orientation="horizontal",
    pad=0.04,
    fraction=0.04,
    shrink=0.48,
)
```

## Multi-panel maps

- Keep one shared color scale when panels are meant to be compared.
- For left-right comparison:
  - left panel may show latitude labels
  - right panel usually should not
- Reduce `wspace` carefully, but keep map aspect correct.
- For large-domain maps, do not keep 1 degree longitude labels. Use coarser spacing such as 4 or 5 degrees.

## GEBCO backgrounds

- On large domains, use lower-resolution sampling to avoid unusable payload sizes.
- Bathymetry is context, not the main message, unless the figure is about topography itself.
