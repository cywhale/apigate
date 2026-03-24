#!/usr/bin/env python3
"""Minimal skill-only validation figure for Chang et al. 2018 Fig. 1 analogue."""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

SKILL_SCRIPTS = Path(__file__).resolve().parents[2] / "skills" / "odb-openapi-ocean-maps" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))

from odb_ocean_api_helpers import (  # noqa: E402
    add_slim_colorbar,
    build_basemap,
    draw_gebco_relief,
    fetch_gebco_tiled,
    fetch_sadcp,
    select_one_period,
    to_float_array,
)


def main() -> None:
    out = Path("japanese_eel_fig1_skill_only.png")
    lon0, lon1, lat0, lat1 = 118.0, 155.0, 11.0, 40.0

    glon, glat, gz = fetch_gebco_tiled(
        lon0=lon0,
        lon1=lon1,
        lat0=lat0,
        lat1=lat1,
        sample=8,
        tile_deg=10,
        timeout=180,
        cache_path="gebco_eel_fig1_sample8.npz",
    )
    sadcp = select_one_period(
        fetch_sadcp(
            lon0=lon0,
            lon1=lon1,
            lat0=lat0,
            lat1=lat1,
            dep0=30,
            dep1=100,
            dep_mode="mean",
            mode="0",
            append="u,v,speed,direction,count",
            timeout=120,
        )
    )

    fig, ax = plt.subplots(figsize=(12.4, 9.2))
    fig.subplots_adjust(top=0.90, bottom=0.13)
    m = build_basemap(
        ax,
        lon0=lon0,
        lon1=lon1,
        lat0=lat0,
        lat1=lat1,
        show_lat_labels=True,
        show_bottom_lon_labels=True,
        parallel_step=4.0,
        meridian_step=5.0,
    )
    draw_gebco_relief(m, glon, glat, gz)

    bx = np.unique(glon)
    by = np.unique(glat)
    bx.sort()
    by.sort()
    bgrid = np.full((by.size, bx.size), np.nan)
    xi = {v: i for i, v in enumerate(bx)}
    yi = {v: i for i, v in enumerate(by)}
    for x, y, zz in zip(glon, glat, gz, strict=False):
        bgrid[yi[y], xi[x]] = zz
    X, Y = np.meshgrid(bx, by)
    pcm = m.pcolormesh(X, Y, bgrid, latlon=True, cmap="turbo", vmin=-5000, vmax=0, alpha=0.70, shading="auto", zorder=1.5)

    lon = to_float_array(sadcp, "longitude")
    lat = to_float_array(sadcp, "latitude")
    u = to_float_array(sadcp, "u")
    v = to_float_array(sadcp, "v")
    count = to_float_array(sadcp, "count")
    mask = np.isfinite(lon) & np.isfinite(lat) & np.isfinite(u) & np.isfinite(v) & np.isfinite(count) & (count >= 30)
    m.quiver(lon[mask], lat[mask], u[mask], v[mask], latlon=True, color="0.6", scale=28.0, width=0.0014, headwidth=2.6, headlength=3.4, zorder=5)

    region_lines = [
        ([118, 155], [17, 17]),
        ([118, 155], [25, 25]),
        ([118, 155], [31, 31]),
        ([123, 123], [17, 25]),
        ([123, 123], [25, 31]),
        ([141, 141], [11, 17]),
        ([141, 141], [25, 39]),
    ]
    for xs, ys in region_lines:
        rx, ry = m(xs, ys)
        m.plot(rx, ry, color="white", linewidth=1.1, zorder=6)

    labels = {
        "1": (135.0, 20.0),
        "2": (122.2, 20.5),
        "3": (119.2, 20.0),
        "4": (135.0, 27.5),
        "5": (123.2, 27.5),
        "6": (145.5, 34.0),
        "7": (135.0, 14.5),
        "8": (135.0, 11.8),
    }
    for txt, (x, y) in labels.items():
        tx, ty = m(x, y)
        ax.text(tx, ty, txt, color="white", fontsize=18, weight="bold", ha="center", va="center", zorder=7)

    box = [(139.5, 13.0), (143.0, 13.0), (143.0, 15.3), (139.5, 15.3), (139.5, 13.0)]
    sx, sy = m([p[0] for p in box], [p[1] for p in box])
    m.plot(sx, sy, color="#ffd400", linewidth=2.2, zorder=7)

    rivers = [
        (119.0, 24.2), (119.5, 25.0), (120.0, 25.7), (121.0, 30.2), (121.2, 39.0),
        (124.0, 25.0), (130.5, 31.5), (131.8, 33.5), (133.2, 34.0), (135.0, 34.4),
        (137.0, 36.5), (139.0, 38.0), (140.5, 39.0), (141.0, 35.5), (141.2, 37.0),
    ]
    rx, ry = m([p[0] for p in rivers], [p[1] for p in rivers])
    m.scatter(rx, ry, s=26, color="#39d353", edgecolors="black", linewidths=0.45, zorder=8)

    add_slim_colorbar(
        fig,
        pcm,
        ax=ax,
        orientation="horizontal",
        pad=0.05,
        fraction=0.030,
        shrink=0.48,
        label="Bathymetry (m)",
        fontsize=10,
        tick_fontsize=9,
    )
    ax.set_title("Western North Pacific Bathymetry and Available ODB Currents (30-100 m)", fontsize=15, pad=10)
    fig.text(
        0.5,
        0.02,
        "Public-data analogue of Chang et al. 2018 Fig. 1. The background bathymetry is complete, while ODB current vectors remain sparse where observational coverage is limited.",
        ha="center",
        fontsize=9,
    )
    fig.savefig(out, dpi=240)
    print(f"Saved {out}")
    print(f"Vectors plotted: {int(np.count_nonzero(mask))}")


if __name__ == "__main__":
    main()
