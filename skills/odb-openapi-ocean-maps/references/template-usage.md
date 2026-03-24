# Template Usage

Use `assets/ocean_map_template.py` when an agent needs a fresh ODB-based map quickly and the task is mostly a parameter-and-style adaptation.

## What To Edit First

1. `CONFIG["domain"]`
2. `CONFIG["background"]`
3. `CONFIG["vectors"]`
4. `CONFIG["title"]`, `CONFIG["caption"]`, and `CONFIG["output"]`

## Recommended Defaults

- Keep vector arrows short.
- Start with `count_threshold=30` for SADCP vectors.
- Keep the colorbar external, horizontal, short, and thin.
- If the domain is large, coarsen graticule spacing and GEBCO sampling.

## Background Choices

- `sadcp + speed`: quick current-map overview
- `ctd + salinity`: subsurface water-mass structure
- `ctd + temperature`: section or thermal context
- `mhw + sst_anomaly`: climate or heatwave explanation maps

## When Not To Use The Template Directly

- complex multi-panel figure with several shared colorbars
- figure that needs precise publication-style annotations from a specific paper
- event reconstruction that requires logic beyond public ODB averages
