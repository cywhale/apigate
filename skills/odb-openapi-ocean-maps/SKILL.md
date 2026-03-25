---
name: odb-openapi-ocean-maps
description: Use when an agent needs to draw oceanographic maps from ODB open APIs, especially SADCP currents, CTD temperature-salinity-density fields, GEBCO bathymetry, and MHW SST or SST anomaly data, with Basemap or Cartopy and correct subplot/colorbar layout.
---

# ODB OpenAPI Ocean Maps

Use this skill for map-making tasks based on ODB public APIs.

## Use This Skill When

- the task needs ODB `sadcp`, `ctd`, `gebco`, or `mhw`
- the output is a scientific figure or panel, not just raw JSON
- the agent must combine currents, hydrography, bathymetry, or SST anomaly on a map
- the task needs Basemap or Cartopy plotting with stable colorbar layout

## Core Workflow

1. Identify the scientific question first.
   Do not start from a pretty map.

2. Choose the minimum data mix:
   - `sadcp` for currents
   - `ctd` for temperature, salinity, density
   - `gebco` for bathymetry or terrain
   - `mhw` for SST, SST anomaly, or MHW level

3. For current vectors, start conservative:
   - keep arrow lengths short
   - keep `count` filtering simple and explicit
   - a practical default is to hide vectors where `count < 30`
   - expose the threshold as a parameter instead of hard-coding it as a scientific rule

4. Reuse `scripts/odb_ocean_api_helpers.py`.
   It contains:
   - API fetch helpers
   - GEBCO tiled download
   - Basemap construction
   - Cartopy construction
   - compact external colorbar helpers

5. For single maps or small panel groups, prefer an external `fig.colorbar(..., ax=..., pad/fraction/shrink)`.
   Use a dedicated manual `cax` only when the shared layout is still unstable.

6. Treat public ODB outputs honestly.
   - 0.25 degree fields are suited to climatology, structure, and analogy
   - they are not raw-cruise or event-level reproduction unless the data truly support that claim
   - if a reference figure is based on model or reanalysis fields, expect the public ODB analogue to look rougher and less spatially complete

## Read These References As Needed

- `references/api-patterns.md`
  - parameter patterns and payload limits
- `references/layout-rules.md`
  - colorbar and subplot rules
- `references/science-caveats.md`
  - what not to overclaim
- `references/template-usage.md`
  - when to copy the bundled template and which config keys to edit first
- `references/cartopy-vs-basemap.md`
  - how to choose the backend for a new figure
- `references/parameter-cheatsheet.md`
  - common ODB parameters and append fields; use official OAS on demand for rare cases

## Bundled Template

- `assets/ocean_map_template.py`
  - copy this into the working project when the task is a fresh single-map build
  - edit the `CONFIG` block before changing plotting logic
  - it already includes:
    - switchable `backend` (`basemap` or `cartopy`)
    - external slim colorbar
    - optional GEBCO relief
    - optional GEBCO hillshade toggle
    - configurable GEBCO ocean and land colormaps
    - optional GEBCO colorbar
    - optional scalar background layer
    - SADCP vector count filtering
    - optional vector stride decimation
    - short-arrow defaults
    - switchable `sadcp` / `ctd` / `mhw` background source

## Default Plotting Rules

- Prefer `resolution="h"` and fall back to `resolution="i"` for Basemap.
- Cartopy is allowed, but it is not the default backend.
- Cartopy may download coastline resources on first use; mention that risk if the environment is fresh.
- Cartopy has been blind-tested successfully for a large-domain Japanese-eel analogue map in this workspace, but only after `cartopy` was explicitly added to the local `uv` environment.
- If a Cartopy figure includes a scalar background, apply the same external slim-colorbar rule used for Basemap figures.
- For gridded scalar fields, prefer grid-cell filling rather than overlapping colored circles.
- Use short, thin horizontal colorbars.
- GEBCO hillshade can stay enabled for higher visual relief, but the template should allow turning it off when a large domain becomes too slow.
- If vectors are white and GEBCO uses a pale shallow-water colormap such as `GnBu`, check coastal readability before delivery.
- Do not decimate vectors by default. If the domain is too crowded, expose stride as a parameter and say so explicitly.
- The colorbar must sit outside the map panel, not over the data area and not jammed into the title line.
- For upper-row maps in stacked layouts, avoid bottom longitude labels if they fight with the colorbar.
- For large GEBCO domains, increase `sample` or reduce domain size instead of forcing `sample=1`.
- For large map domains, use coarser meridian and parallel spacing such as 4° to 5°.
- If currents are sparse or absent, leave them blank and say so. Do not invent vectors.

## Validation Before Delivery

- confirm the API payload is non-empty
- confirm the colorbar does not overlap map panels
- confirm the map answers a scientific question
- confirm the figure text states whether it is a reproduction or an analogy
