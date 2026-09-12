#!/usr/bin/env python3
"""Blind cartopy test using only the integrated odb-openapi-ocean-maps skill."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import cartopy.crs as ccrs

SKILL_SCRIPTS = Path(
    os.environ.get(
        "ODB_OCEAN_SKILL_SCRIPTS",
        "/Users/cywhale/proj/apigate/skills/odb-openapi-ocean-maps/scripts",
    )
)
sys.path.insert(0, str(SKILL_SCRIPTS))

from odb_ocean_api_helpers import (  # noqa: E402
    build_cartopy_map,
    draw_gebco_relief,
    fetch_gebco_tiled,
    fetch_sadcp,
    select_one_period,
    to_float_array,
)


def main() -> None:
    out = Path("japanese_eel_fig1_skill_cartopy.png")
    lon0, lon1, lat0, lat1 = 115.0, 160.0, 5.0, 45.0

    glon, glat, gz = fetch_gebco_tiled(
        lon0=lon0,
        lon1=lon1,
        lat0=lat0,
        lat1=lat1,
        sample=4,
        tile_deg=4,
        timeout=180,
        cache_path="gebco_cartopy_skill_test.npz",
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
            append="u,v,count",
            timeout=120,
        )
    )

    fig = plt.figure(figsize=(10.8, 8.5))
    fig.subplots_adjust(top=0.92, bottom=0.12)
    ax = fig.add_subplot(1, 1, 1, projection=ccrs.PlateCarree())
    build_cartopy_map(
        ax,
        lon0=lon0,
        lon1=lon1,
        lat0=lat0,
        lat1=lat1,
        resolution="i",
        parallel_step=10.0,
        meridian_step=10.0,
        show_lat_labels=True,
        show_bottom_lon_labels=True,
    )
    draw_gebco_relief(ax, glon, glat, gz, backend="cartopy")

    lon = to_float_array(sadcp, "longitude")
    lat = to_float_array(sadcp, "latitude")
    u = to_float_array(sadcp, "u")
    v = to_float_array(sadcp, "v")
    count = to_float_array(sadcp, "count")
    mask = np.isfinite(lon) & np.isfinite(lat) & np.isfinite(u) & np.isfinite(v) & np.isfinite(count) & (count >= 30)
    q = ax.quiver(
        lon[mask],
        lat[mask],
        u[mask],
        v[mask],
        transform=ccrs.PlateCarree(),
        color="0.5",
        scale=28.0,
        width=0.0018,
        headwidth=2.8,
        headlength=3.6,
        zorder=5,
        alpha=0.75,
    )
    ax.quiverkey(q, 0.12, 0.08, 0.5, "0.5 m/s", labelpos="E", coordinates="axes", color="0.5")

    spawning_lon = [137.0, 143.0, 143.0, 137.0, 137.0]
    spawning_lat = [12.0, 12.0, 15.0, 15.0, 12.0]
    ax.plot(spawning_lon, spawning_lat, transform=ccrs.PlateCarree(), color="#ffd400", linewidth=2.2, zorder=8)

    rivers = [
        (119.0, 24.2), (119.5, 25.0), (120.0, 25.7), (121.0, 30.2), (121.2, 39.0),
        (124.0, 25.0), (130.5, 31.5), (131.8, 33.5), (133.2, 34.0), (135.0, 34.4),
        (137.0, 36.5), (139.0, 38.0), (140.5, 39.0), (141.0, 35.5), (141.2, 37.0),
    ]
    ax.scatter(
        [p[0] for p in rivers],
        [p[1] for p in rivers],
        transform=ccrs.PlateCarree(),
        color="#39d353",
        edgecolors="black",
        linewidths=0.45,
        s=34,
        zorder=9,
    )

    ax.set_title("Japanese Eel Spawning Area and Drifting Currents (30-100 m, Cartopy)", fontsize=15, pad=10)
    fig.text(
        0.5,
        0.02,
        "Blind test of the integrated skill using Cartopy only. GEBCO provides full bathymetry; ODB currents remain observation-based and sparse where coverage is limited.",
        ha="center",
        fontsize=9,
    )
    fig.savefig(out, dpi=220)
    print(f"Saved {out}")
    print(f"Vectors plotted: {int(np.count_nonzero(mask))}")


if __name__ == "__main__":
    main()
