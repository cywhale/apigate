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
    build_cartopy_map,
    draw_gebco_relief,
    fetch_ctd,
    fetch_gebco_tiled,
    fetch_mhw,
    fetch_sadcp,
    select_one_period,
    to_float_array,
)


CONFIG = {
    "output": "japanese_eel_fig1_skill_cartopy_gebco_cbar.png",
    "backend": "cartopy",  # basemap | cartopy
    "title": "Japanese Eel Spawning Area and Drifting Currents (GEBCO Colorbar Test)",
    "caption": "Blind test for GEBCO-only colorbar support after disabling scalar background.",
    "domain": {"lon0": 115.0, "lon1": 160.0, "lat0": 5.0, "lat1": 45.0},
    "grid": {"parallel_step": 10.0, "meridian_step": 10.0},
    "gebco": {
        "enabled": True,
        "sample": 4,
        "tile_deg": 4,
        "cache": "gebco_cartopy_gebco_cbar_test.npz",
        "hillshade": True,
        "hillshade_alpha": 0.22,
        "ocean_cmap": "GnBu",
        "land_cmap": "gist_earth",
        "colorbar": {
            "enabled": True,
            "label": "Bathymetry (m)",
        },
    },
    "background": {
        "enabled": False,
        "source": "sadcp",  # sadcp | ctd | mhw
        "field": "speed",  # sadcp: speed/u/v ; ctd: temperature/salinity/density ; mhw: sst/sst_anomaly/level
        "mode": "0",
        "dep0": 30,
        "dep1": 100,
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
        "dep0": 30,
        "dep1": 100,
        "dep_mode": "mean",
        "count_threshold": 30,
        "scale": 26.0,
        "color": "0.5",
        "width": 0.0018,
        "headwidth": 2.8,
        "headlength": 3.6,
        "stride": 1,
        "quiverkey": {"enabled": True, "x": 0.12, "y": 0.08, "speed": 0.5, "label": "0.5 m/s"},
    },
    "colorbar": {"pad": 0.04, "fraction": 0.035, "shrink": 0.48, "fontsize": 10, "tick_fontsize": 9},
    "figure": {"figsize": (10.8, 8.5), "top": 0.92, "bottom": 0.13},
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


def draw_background(m_or_ax, lon: np.ndarray, lat: np.ndarray, val: np.ndarray, cfg: dict):
    style = cfg["style"]
    backend = CONFIG["backend"]
    if style["kind"] == "scatter":
        kwargs = {
            "c": val,
            "s": style["size"],
            "linewidths": 0,
            "cmap": style["cmap"],
            "vmin": style["vmin"],
            "vmax": style["vmax"],
            "alpha": style["alpha"],
            "zorder": 4,
        }
        if backend == "basemap":
            x, y = m_or_ax(lon, lat)
            return m_or_ax.scatter(x, y, **kwargs)
        import cartopy.crs as ccrs
        return m_or_ax.scatter(lon, lat, transform=ccrs.PlateCarree(), **kwargs)

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
    kwargs = {
        "cmap": style["cmap"],
        "vmin": style["vmin"],
        "vmax": style["vmax"],
        "alpha": style["alpha"],
        "shading": "auto",
        "zorder": 3.8,
    }
    if backend == "basemap":
        kwargs["latlon"] = True
    else:
        import cartopy.crs as ccrs
        kwargs["transform"] = ccrs.PlateCarree()
    return m_or_ax.pcolormesh(xx, yy, grid, **kwargs)


def draw_vectors(m_or_ax, cfg: dict) -> None:
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
    stride = max(int(cfg.get("stride", 1)), 1)
    if stride > 1:
        idx = np.flatnonzero(mask)[::stride]
        lon = lon[idx]
        lat = lat[idx]
        u = u[idx]
        v = v[idx]
    else:
        lon = lon[mask]
        lat = lat[mask]
        u = u[mask]
        v = v[mask]
    kwargs = {
        "color": cfg["color"],
        "scale": cfg["scale"],
        "width": cfg["width"],
        "headwidth": cfg["headwidth"],
        "headlength": cfg["headlength"],
        "zorder": 5,
    }
    if CONFIG["backend"] == "basemap":
        q = m_or_ax.quiver(lon, lat, u, v, latlon=True, **kwargs)
        if cfg["quiverkey"]["enabled"]:
            m_or_ax.ax.quiverkey(
                q,
                cfg["quiverkey"]["x"],
                cfg["quiverkey"]["y"],
                cfg["quiverkey"]["speed"],
                cfg["quiverkey"]["label"],
                labelpos="E",
                coordinates="axes",
                color=cfg["color"],
            )
        return

    import cartopy.crs as ccrs

    q = m_or_ax.quiver(lon, lat, u, v, transform=ccrs.PlateCarree(), **kwargs)
    if cfg["quiverkey"]["enabled"]:
        m_or_ax.quiverkey(
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
    fig = plt.figure(figsize=CONFIG["figure"]["figsize"])
    fig.subplots_adjust(top=CONFIG["figure"]["top"], bottom=CONFIG["figure"]["bottom"])
    if CONFIG["backend"] == "cartopy":
        import cartopy.crs as ccrs

        ax = fig.add_subplot(1, 1, 1, projection=ccrs.PlateCarree())
        m_or_ax = build_cartopy_map(
            ax,
            lon0=domain["lon0"],
            lon1=domain["lon1"],
            lat0=domain["lat0"],
            lat1=domain["lat1"],
            resolution="i",
            parallel_step=CONFIG["grid"]["parallel_step"],
            meridian_step=CONFIG["grid"]["meridian_step"],
            show_lat_labels=True,
            show_bottom_lon_labels=True,
        )
    else:
        ax = fig.add_subplot(1, 1, 1)
        m_or_ax = build_basemap(
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
        ocean_mesh = draw_gebco_relief(
            m_or_ax,
            glon,
            glat,
            gz,
            backend=CONFIG["backend"],
            hillshade=CONFIG["gebco"].get("hillshade", True),
            hillshade_alpha=CONFIG["gebco"].get("hillshade_alpha", 0.22),
            ocean_cmap=CONFIG["gebco"].get("ocean_cmap", "GnBu"),
            land_cmap=CONFIG["gebco"].get("land_cmap", "gist_earth"),
        )
        if CONFIG["gebco"].get("colorbar", {}).get("enabled", False) and ocean_mesh is not None:
            add_slim_colorbar(
                fig,
                ocean_mesh,
                ax=ax,
                orientation="horizontal",
                pad=CONFIG["colorbar"]["pad"],
                fraction=CONFIG["colorbar"]["fraction"],
                shrink=CONFIG["colorbar"]["shrink"],
                label=CONFIG["gebco"]["colorbar"].get("label", "Bathymetry (m)"),
                fontsize=CONFIG["colorbar"]["fontsize"],
                tick_fontsize=CONFIG["colorbar"]["tick_fontsize"],
            )

    if CONFIG["background"].get("enabled", True):
        lon, lat, val = build_background(CONFIG["background"])
        mappable = draw_background(m_or_ax, lon, lat, val, CONFIG["background"])
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
    draw_vectors(m_or_ax, CONFIG["vectors"])
    ax.set_title(CONFIG["title"], fontsize=15, pad=10)
    fig.text(0.5, 0.02, CONFIG["caption"], ha="center", fontsize=9)
    fig.savefig(CONFIG["output"], dpi=240)
    print(f"Saved {CONFIG['output']}")


if __name__ == "__main__":
    main()
