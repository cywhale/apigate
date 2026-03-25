# Template Usage

Use `assets/ocean_map_template.py` when an agent needs a fresh ODB-based map quickly and the task is mostly a parameter-and-style adaptation.

## What To Edit First

1. `CONFIG["backend"]`
2. `CONFIG["domain"]`
3. `CONFIG["background"]`
4. `CONFIG["vectors"]`
5. `CONFIG["title"]`, `CONFIG["caption"]`, and `CONFIG["output"]`

## Recommended Defaults

- Keep vector arrows short.
- Start with `count_threshold=30` for SADCP vectors.
- Keep the colorbar external, horizontal, short, and thin.
- If the domain is large, coarsen graticule spacing and GEBCO sampling.
- Keep GEBCO hillshade enabled by default for better terrain readability, but allow `gebco.hillshade = False` when speed matters more than relief.
- If using Cartopy in a fresh environment, expect a first-run coastline download.
- A Cartopy validation has already succeeded in this workspace; still verify that the environment includes `cartopy` before assuming the backend is available.
- When using Cartopy with a scalar background layer, do not skip the colorbar check. The colorbar should still sit outside the plot, be short, and not collide with the title or caption.

## Background Choices

- `sadcp + speed`: quick current-map overview
- `ctd + salinity`: subsurface water-mass structure
- `ctd + temperature`: section or thermal context
- `mhw + sst_anomaly`: climate or heatwave explanation maps
- `background.enabled = False`: bathymetry + vectors only

## When Not To Use The Template Directly

- complex multi-panel figure with several shared colorbars
- figure that needs precise publication-style annotations from a specific paper
- event reconstruction that requires logic beyond public ODB averages
