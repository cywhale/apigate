# Cartopy vs Basemap

Use this note when choosing the plotting backend for an ODB ocean map.

## Decision Rule

1. If the task extends an existing Basemap example in this repo, use `basemap`.
2. If the environment does not already have `cartopy`, use `basemap`.
3. If the domain is large and you are starting a new figure, prefer `cartopy` if the environment supports it.
4. If speed and lowest workflow risk matter most, use `basemap`.
5. If long-term maintainability matters more than matching older scripts, prefer `cartopy`.

## Basemap

Choose Basemap when:

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

Choose Cartopy when:

- the environment already has `cartopy`
- the task is a new figure rather than an extension of an old Basemap script
- the map domain is large enough that Cartopy's maintained projection stack is worth using
- long-term maintainability matters more than matching older outputs

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

## After Switching Backend

Always re-check:

- coastline readability
- vector density
- colorbar placement
- caption honesty about observation coverage
