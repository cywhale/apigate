#!/usr/bin/env python3
"""Template for ODB-based ocean maps using the odb-openapi-ocean-maps skill.

Copy this file into a project workspace, then edit only the CONFIG block first.
"""

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
    draw_gebco_relief,
    fetch_ctd,
    fetch_gebco_tiled,
    fetch_mhw,
    fetch_sadcp,
    select_one_period,
    to_float_array,
)


CONFIG = {
    "output": "ocean_map_template_output.png",
    "title": "ODB Ocean Map",
    "caption": "Public-data ocean map created from ODB open APIs.",
    "domain": {"lon0": 120.0, "lon1": 123.0, "lat0": 21.0, "lat1": 26.0},
    "grid": {"parallel_step": 1.0, "meridian_step": 1.0},
    "gebco": {"enabled": True, "sample": 1, "tile_deg": 2, "cache": "gebco_template.npz"},
    "background": {
        "source": "sadcp",  # sadcp | ctd | mhw
        "field": "speed",  # sadcp: speed/u/v ; ctd: temperature/salinity/density ; mhw: sst/sst_anomaly/level
        "mode": "0",
        "dep0": 20,
        "dep1": 300,
        "dep_mode": "mean",
        "start": None,
        "end": None,
        "append": None,
        "style": {
            "kind": "scatter",  # scatter | pcolormesh
            "cmap": "jet",
            "vmin": 0.0,
            "vmax": 1.2,
            "size": 85,
            "alpha": 0.95,
            "label": "Current speed (m/s)",
        },
    },
    "vectors": {
        "enabled": True,
        "mode": "0",
        "dep0": 25,
        "dep1": 35,
        "dep_mode": "mean",
        "count_threshold": 30,
        "scale": 26.0,
        "color": "white",
        "width": 0.0021,
        "headwidth": 3.0,
        "headlength": 4.0,
        "quiverkey": {"enabled": True, "x": 0.12, "y": 0.11, "speed": 0.5, "label": "0.5 m/s"},
    },
    "colorbar": {"pad": 0.04, "fraction": 0.035, "shrink": 0.48, "fontsize": 10, "tick_fontsize": 9},
    "figure": {"figsize": (10.5, 8.2), "top": 0.91, "bottom": 0.13},
}


def build_background(cfg: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    domain = CONFIG["domain"]
    style = cfg["style"]
    source = cfg["source"]

    if source == "sadcp":
        rows = select_one_period(
            fetch_sadcp(
                lon0=domain["lon0"],
                lon1=domain["lon1"],
                lat0=domain["lat0"],
                lat1=domain["lat1"],
                dep0=cfg["dep0"],
                dep1=cfg["dep1"],
                dep_mode=cfg["dep_mode"],
                mode=cfg["mode"],
                append=cfg["append"] or f"{cfg['field']},count",
            )
        )
    elif source == "ctd":
        rows = select_one_period(
            fetch_ctd(
                lon0=domain["lon0"],
                lon1=domain["lon1"],
                lat0=domain["lat0"],
                lat1=domain["lat1"],
                dep0=cfg["dep0"],
                dep1=cfg["dep1"],
                dep_mode=cfg["dep_mode"],
                mode=cfg["mode"],
                append=cfg["append"] or f"{cfg['field']},count",
            )
        )
    elif source == "mhw":
        rows = select_one_period(
            fetch_mhw(
                lon0=domain["lon0"],
                lon1=domain["lon1"],
                lat0=domain["lat0"],
                lat1=domain["lat1"],
                start=cfg["start"],
                end=cfg["end"],
                append=cfg["append"] or cfg["field"],
            )
        )
    else:
        raise ValueError(f"Unsupported background source: {source}")

    lon = to_float_array(rows, "longitude")
    lat = to_float_array(rows, "latitude")
    val = to_float_array(rows, cfg["field"])
    mask = np.isfinite(lon) & np.isfinite(lat) & np.isfinite(val)
    return lon[mask], lat[mask], val[mask]


def draw_background(m, lon: np.ndarray, lat: np.ndarray, val: np.ndarray, cfg: dict):
    style = cfg["style"]
    if style["kind"] == "scatter":
        x, y = m(lon, lat)
        return m.scatter(
            x,
            y,
            c=val,
            s=style["size"],
            linewidths=0,
            cmap=style["cmap"],
            vmin=style["vmin"],
            vmax=style["vmax"],
            alpha=style["alpha"],
            zorder=4,
        )

    ux = np.unique(lon)
    uy = np.unique(lat)
    ux.sort()
    uy.sort()
    grid = np.full((uy.size, ux.size), np.nan)
    xi = {v: i for i, v in enumerate(ux)}
    yi = {v: i for i, v in enumerate(uy)}
    for x0, y0, z0 in zip(lon, lat, val, strict=False):
        grid[yi[y0], xi[x0]] = z0
    xx, yy = np.meshgrid(ux, uy)
    return m.pcolormesh(
        xx,
        yy,
        grid,
        latlon=True,
        cmap=style["cmap"],
        vmin=style["vmin"],
        vmax=style["vmax"],
        alpha=style["alpha"],
        shading="auto",
        zorder=3.8,
    )


def draw_vectors(m, cfg: dict) -> None:
    if not cfg["enabled"]:
        return
    domain = CONFIG["domain"]
    rows = select_one_period(
        fetch_sadcp(
            lon0=domain["lon0"],
            lon1=domain["lon1"],
            lat0=domain["lat0"],
            lat1=domain["lat1"],
            dep0=cfg["dep0"],
            dep1=cfg["dep1"],
            dep_mode=cfg["dep_mode"],
            mode=cfg["mode"],
            append="u,v,count",
        )
    )
    lon = to_float_array(rows, "longitude")
    lat = to_float_array(rows, "latitude")
    u = to_float_array(rows, "u")
    v = to_float_array(rows, "v")
    count = to_float_array(rows, "count")
    mask = np.isfinite(lon) & np.isfinite(lat) & np.isfinite(u) & np.isfinite(v) & np.isfinite(count) & (count >= cfg["count_threshold"])
    if not np.any(mask):
        return
    q = m.quiver(
        lon[mask],
        lat[mask],
        u[mask],
        v[mask],
        latlon=True,
        color=cfg["color"],
        scale=cfg["scale"],
        width=cfg["width"],
        headwidth=cfg["headwidth"],
        headlength=cfg["headlength"],
        zorder=5,
    )
    if cfg["quiverkey"]["enabled"]:
        m.ax.quiverkey(
            q,
            cfg["quiverkey"]["x"],
            cfg["quiverkey"]["y"],
            cfg["quiverkey"]["speed"],
            cfg["quiverkey"]["label"],
            labelpos="E",
            coordinates="axes",
            color=cfg["color"],
        )


def main() -> None:
    domain = CONFIG["domain"]
    fig, ax = plt.subplots(figsize=CONFIG["figure"]["figsize"])
    fig.subplots_adjust(top=CONFIG["figure"]["top"], bottom=CONFIG["figure"]["bottom"])
    m = build_basemap(
        ax,
        lon0=domain["lon0"],
        lon1=domain["lon1"],
        lat0=domain["lat0"],
        lat1=domain["lat1"],
        parallel_step=CONFIG["grid"]["parallel_step"],
        meridian_step=CONFIG["grid"]["meridian_step"],
        show_lat_labels=True,
        show_bottom_lon_labels=True,
    )

    if CONFIG["gebco"]["enabled"]:
        glon, glat, gz = fetch_gebco_tiled(
            lon0=domain["lon0"],
            lon1=domain["lon1"],
            lat0=domain["lat0"],
            lat1=domain["lat1"],
            sample=CONFIG["gebco"]["sample"],
            tile_deg=CONFIG["gebco"]["tile_deg"],
            cache_path=CONFIG["gebco"]["cache"],
        )
        draw_gebco_relief(m, glon, glat, gz)

    lon, lat, val = build_background(CONFIG["background"])
    mappable = draw_background(m, lon, lat, val, CONFIG["background"])
    draw_vectors(m, CONFIG["vectors"])

    add_slim_colorbar(
        fig,
        mappable,
        ax=ax,
        orientation="horizontal",
        pad=CONFIG["colorbar"]["pad"],
        fraction=CONFIG["colorbar"]["fraction"],
        shrink=CONFIG["colorbar"]["shrink"],
        label=CONFIG["background"]["style"]["label"],
        fontsize=CONFIG["colorbar"]["fontsize"],
        tick_fontsize=CONFIG["colorbar"]["tick_fontsize"],
    )
    ax.set_title(CONFIG["title"], fontsize=15, pad=10)
    fig.text(0.5, 0.02, CONFIG["caption"], ha="center", fontsize=9)
    fig.savefig(CONFIG["output"], dpi=240)
    print(f"Saved {CONFIG['output']}")


if __name__ == "__main__":
    main()
