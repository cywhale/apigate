#!/usr/bin/env python3
"""Blind test from a short user prompt using odb-openapi-ocean-maps skill helpers only."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

SKILL_SCRIPTS = Path(
    os.environ.get(
        "ODB_OCEAN_SKILL_SCRIPTS",
        "/Users/cywhale/proj/apigate/skills/odb-openapi-ocean-maps/scripts",
    )
)
sys.path.insert(0, str(SKILL_SCRIPTS))

from odb_ocean_api_helpers import (  # noqa: E402
    add_slim_colorbar,
    build_basemap,
    centers_to_edges,
    draw_gebco_relief,
    fetch_gebco_tiled,
    fetch_sadcp,
    select_one_period,
    to_float_array,
)


def grid_field(rows: list[dict], key: str):
    lon = to_float_array(rows, "longitude")
    lat = to_float_array(rows, "latitude")
    val = to_float_array(rows, key)
    mask = np.isfinite(lon) & np.isfinite(lat) & np.isfinite(val)
    lon = lon[mask]
    lat = lat[mask]
    val = val[mask]
    ux = np.unique(lon)
    uy = np.unique(lat)
    ux.sort()
    uy.sort()
    grid = np.full((uy.size, ux.size), np.nan)
    xi = {v: i for i, v in enumerate(ux)}
    yi = {v: i for i, v in enumerate(uy)}
    for x0, y0, z0 in zip(lon, lat, val, strict=False):
        grid[yi[y0], xi[x0]] = z0
    xe = centers_to_edges(ux)
    ye = centers_to_edges(uy)
    return ux, uy, xe, ye, grid


def main() -> None:
    out = Path("kuroshio_skill_prompt_blind_test.png")
    lon0, lon1, lat0, lat1 = 120.0, 123.5, 21.0, 26.5

    gebco_lon, gebco_lat, gebco_z = fetch_gebco_tiled(
        lon0=lon0,
        lon1=lon1,
        lat0=lat0,
        lat1=lat1,
        sample=1,
        tile_deg=2,
        timeout=180,
        cache_path="gebco_kuroshio_blind_test.npz",
    )

    scalar_rows = select_one_period(
        fetch_sadcp(
            lon0=lon0,
            lon1=lon1,
            lat0=lat0,
            lat1=lat1,
            dep0=20,
            dep1=300,
            dep_mode="mean",
            mode="0",
            append="speed,count",
            timeout=120,
        )
    )
    vector_rows = select_one_period(
        fetch_sadcp(
            lon0=lon0,
            lon1=lon1,
            lat0=lat0,
            lat1=lat1,
            dep0=30,
            dep1=100,
            dep_mode="mean",
            mode="0",
            append="u,v,count",
            timeout=120,
        )
    )

    _, _, xe, ye, speed_grid = grid_field(scalar_rows, "speed")
    xx, yy = np.meshgrid(xe, ye)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(9.2, 12.2))
    fig.subplots_adjust(top=0.93, bottom=0.09, hspace=0.22)

    m1 = build_basemap(ax1, lon0=lon0, lon1=lon1, lat0=lat0, lat1=lat1, parallel_step=1.0, meridian_step=1.0, show_lat_labels=True, show_bottom_lon_labels=False)
    draw_gebco_relief(m1, gebco_lon, gebco_lat, gebco_z, backend="basemap")
    pcm = m1.pcolormesh(xx, yy, speed_grid, latlon=True, cmap="jet", vmin=0.0, vmax=1.2, alpha=0.90, shading="flat", zorder=3.8)
    ax1.set_title("Kuroshio East of Taiwan: Gridded Current Speed (20-300 m)", fontsize=14, pad=8)
    add_slim_colorbar(fig, pcm, ax=ax1, orientation="horizontal", pad=0.03, fraction=0.035, shrink=0.55, label="Current speed (m/s)", fontsize=10, tick_fontsize=9)

    m2 = build_basemap(ax2, lon0=lon0, lon1=lon1, lat0=lat0, lat1=lat1, parallel_step=1.0, meridian_step=1.0, show_lat_labels=True, show_bottom_lon_labels=True)
    draw_gebco_relief(m2, gebco_lon, gebco_lat, gebco_z, backend="basemap")
    vlon = to_float_array(vector_rows, "longitude")
    vlat = to_float_array(vector_rows, "latitude")
    u = to_float_array(vector_rows, "u")
    v = to_float_array(vector_rows, "v")
    count = to_float_array(vector_rows, "count")
    mask = np.isfinite(vlon) & np.isfinite(vlat) & np.isfinite(u) & np.isfinite(v) & np.isfinite(count) & (count >= 30)
    q = m2.quiver(vlon[mask], vlat[mask], u[mask], v[mask], latlon=True, color="0.35", scale=16.0, width=0.0023, headwidth=3.2, headlength=4.2, zorder=5)
    ax2.quiverkey(q, 0.12, 0.09, 0.5, "0.5 m/s", labelpos="E", coordinates="axes", color="0.35")
    ax2.set_title("Kuroshio East of Taiwan: Current Vectors (30-100 m)", fontsize=14, pad=8)

    fig.suptitle("Kuroshio East of Taiwan from ODB SADCP API", fontsize=16, y=0.975)
    fig.text(0.5, 0.025, "Blind test of the skill: upper panel shows gridded 0.25° speed, lower panel shows vectors only.", ha="center", fontsize=9)
    fig.savefig(out, dpi=220)
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
