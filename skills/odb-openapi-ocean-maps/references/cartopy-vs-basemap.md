# Cartopy vs Basemap

Use this note when choosing the plotting backend for an ODB ocean map.

## Basemap

Prefer Basemap when:

- the environment already supports `basemap` and you need the most stable path
- the task is based on existing Basemap examples in this repo
- coastline appearance should stay close to earlier outputs
- you want the lowest workflow risk

Strengths:

- already validated repeatedly in this workspace
- high-resolution coastlines work well for Taiwan and nearby islands
- existing examples and layout fixes were built around it

Weaknesses:

- deprecated upstream
- future Python or system-library compatibility may worsen

## Cartopy

Prefer Cartopy when:

- the environment already has `cartopy`
- long-term maintainability matters more than matching old Basemap code
- the task is a new map rather than an extension of an older Basemap script
- you want a backend that is still actively maintained

Strengths:

- actively maintained
- works well for large-domain maps
- now validated in this workspace for:
  - a vector-only Japanese-eel analogue
  - a template-based map with scalar background and external colorbar

Weaknesses:

- first run may download coastline resources
- coastline appearance is not identical to Basemap and must be visually checked
- if `cartopy` is missing from the local `uv` environment, the script will fail immediately

## Practical Rule

- Default to `basemap` for continuity and low risk.
- Choose `cartopy` when the environment supports it and the task benefits from a maintained backend.
- After switching backend, always re-check:
  - coastline readability
  - vector density
  - colorbar placement
  - caption honesty about observation coverage
