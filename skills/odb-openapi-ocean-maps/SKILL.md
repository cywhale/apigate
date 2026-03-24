---
name: odb-openapi-ocean-maps
description: Use when an agent needs to draw oceanographic maps from ODB open APIs, especially SADCP currents, CTD temperature-salinity-density fields, GEBCO bathymetry, and MHW SST or SST anomaly data, with Basemap and correct subplot/colorbar layout.
---

# ODB OpenAPI Ocean Maps

Use this skill for map-making tasks based on ODB public APIs.

## Use This Skill When

- the task needs ODB `sadcp`, `ctd`, `gebco`, or `mhw`
- the output is a scientific figure or panel, not just raw JSON
- the agent must combine currents, hydrography, bathymetry, or SST anomaly on a map
- the task needs Basemap-based plotting with stable colorbar layout

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

## Bundled Template

- `assets/ocean_map_template.py`
  - copy this into the working project when the task is a fresh single-map build
  - edit the `CONFIG` block before changing plotting logic
  - it already includes:
    - external slim colorbar
    - optional GEBCO relief
    - SADCP vector count filtering
    - short-arrow defaults
    - switchable `sadcp` / `ctd` / `mhw` background source

## Default Plotting Rules

- Prefer `resolution="h"` and fall back to `resolution="i"` for Basemap.
- Use short, thin horizontal colorbars.
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
