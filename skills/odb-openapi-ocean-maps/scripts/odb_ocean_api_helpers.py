#!/usr/bin/env python3
"""Reusable helpers for ODB open-API ocean mapping tasks."""

from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import requests
from matplotlib.colors import LightSource

SADCP_API = "https://ecodata.odb.ntu.edu.tw/api/sadcp"
CTD_API = "https://ecodata.odb.ntu.edu.tw/api/ctd"
GEBCO_API = "https://api.odb.ntu.edu.tw/gebco"
MHW_API = "https://eco.odb.ntu.edu.tw/api/mhw"


def fetch_list(url: str, params: dict, timeout: int = 90) -> list[dict]:
    r = requests.get(url, params=params, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError(f"Expected list payload from {url}")
    return data


def fetch_sadcp(*, lon0, lon1, lat0, lat1, dep0, dep1, dep_mode="mean", mode="0", append="u,v,speed,direction,count", timeout=90):
    return fetch_list(SADCP_API, locals(), timeout=timeout)


def fetch_ctd(*, lon0, lon1=None, lat0=None, lat1=None, dep0=0, dep1=None, dep_mode=None, mode="0", append="temperature,salinity,density,count", timeout=90):
    params = {"lon0": lon0, "mode": mode, "append": append}
    if lon1 is not None:
        params["lon1"] = lon1
    if lat0 is not None:
        params["lat0"] = lat0
    if lat1 is not None:
        params["lat1"] = lat1
    if dep0 is not None:
        params["dep0"] = dep0
    if dep1 is not None:
        params["dep1"] = dep1
    if dep_mode is not None:
        params["dep_mode"] = dep_mode
    return fetch_list(CTD_API, params, timeout=timeout)


def fetch_mhw(*, lon0, lon1=None, lat0=None, lat1=None, start=None, end=None, append="sst,sst_anomaly,level", timeout=90):
    params = {"lon0": lon0, "append": append}
    if lon1 is not None:
        params["lon1"] = lon1
    if lat0 is not None:
        params["lat0"] = lat0
    if lat1 is not None:
        params["lat1"] = lat1
    if start is not None:
        params["start"] = start
    if end is not None:
        params["end"] = end
    return fetch_list(MHW_API, params, timeout=timeout)


def rect_poly(lon0, lon1, lat0, lat1) -> dict:
    return {"type": "Polygon", "coordinates": [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]]}


def tile_bounds(lon0, lon1, lat0, lat1, step: int) -> list[tuple[float, float, float, float]]:
    out = []
    x = lon0
    while x < lon1 - 1e-12:
        x2 = min(x + step, lon1)
        y = lat0
        while y < lat1 - 1e-12:
            y2 = min(y + step, lat1)
            out.append((x, x2, y, y2))
            y = y2
        x = x2
    return out


def fetch_gebco_tiled(*, lon0, lon1, lat0, lat1, sample=1, tile_deg=2, timeout=180, cache_path: str | None = None):
    cache = Path(cache_path) if cache_path else None
    if cache and cache.exists():
        c = np.load(cache)
        return c["lon"], c["lat"], c["z"]
    dedup: dict[tuple[float, float], float] = {}
    for a, b, c, d in tile_bounds(lon0, lon1, lat0, lat1, int(tile_deg)):
        r = requests.get(
            GEBCO_API,
            params={"mode": "zonly", "sample": sample, "jsonsrc": json.dumps(rect_poly(a, b, c, d), separators=(",", ":"))},
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        r.raise_for_status()
        js = r.json()
        for x, y, zz in zip(js.get("longitude", []), js.get("latitude", []), js.get("z", []), strict=False):
            dedup[(round(float(x), 10), round(float(y), 10))] = float(zz)
    lon = np.fromiter((k[0] for k in dedup.keys()), dtype=float)
    lat = np.fromiter((k[1] for k in dedup.keys()), dtype=float)
    z = np.fromiter(dedup.values(), dtype=float)
    if cache:
        np.savez_compressed(cache, lon=lon, lat=lat, z=z)
    return lon, lat, z


def select_one_period(rows: list[dict]) -> list[dict]:
    periods = sorted({str(r.get("time_period", "unknown")) for r in rows}, key=lambda t: (0, f"{int(t):03d}") if t.lstrip("-").isdigit() else (1, t))
    return [r for r in rows if str(r.get("time_period", "unknown")) == periods[0]] if periods else []


def to_float_array(rows: list[dict], key: str) -> np.ndarray:
    return np.array([np.nan if r.get(key) is None else float(r[key]) for r in rows], dtype=float)


def centers_to_edges(vals: np.ndarray) -> np.ndarray:
    vals = np.asarray(vals, dtype=float)
    if vals.size == 1:
        return np.array([vals[0] - 0.5 / 240, vals[0] + 0.5 / 240], dtype=float)
    mids = (vals[:-1] + vals[1:]) / 2.0
    return np.concatenate([[vals[0] - (vals[1] - vals[0]) / 2.0], mids, [vals[-1] + (vals[-1] - vals[-2]) / 2.0]])


def xyz_to_grid(lon: np.ndarray, lat: np.ndarray, z: np.ndarray):
    ux = np.unique(lon)
    uy = np.unique(lat)
    ux.sort()
    uy.sort()
    g = np.full((uy.size, ux.size), np.nan, dtype=float)
    xi = {v: i for i, v in enumerate(ux)}
    yi = {v: i for i, v in enumerate(uy)}
    for x, y, zz in zip(lon, lat, z, strict=False):
        g[yi[y], xi[x]] = zz
    return ux, uy, g


def build_basemap(
    ax: plt.Axes,
    *,
    lon0,
    lon1,
    lat0,
    lat1,
    resolution="h",
    show_lat_labels=True,
    show_bottom_lon_labels=True,
    parallel_step=1.0,
    meridian_step=1.0,
) -> object:
    from mpl_toolkits.basemap import Basemap
    try:
        m = Basemap(projection="merc", llcrnrlon=lon0, urcrnrlon=lon1, llcrnrlat=lat0, urcrnrlat=lat1, resolution=resolution, ax=ax, fix_aspect=True)
    except OSError:
        m = Basemap(projection="merc", llcrnrlon=lon0, urcrnrlon=lon1, llcrnrlat=lat0, urcrnrlat=lat1, resolution="i", ax=ax, fix_aspect=True)
    m.drawmapboundary(fill_color="#f8fbff")
    m.fillcontinents(color="#d7d7d7", lake_color="#f8fbff", zorder=1)
    m.drawcoastlines(linewidth=0.8, color="0.2", zorder=6)
    ylabels = [1, 0, 0, 0] if show_lat_labels else [0, 0, 0, 0]
    xlabels = [0, 0, 0, 1] if show_bottom_lon_labels else [0, 0, 0, 0]
    m.drawparallels(np.arange(math.floor(lat0), math.ceil(lat1) + 0.001, parallel_step), labels=ylabels, linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    m.drawmeridians(np.arange(math.floor(lon0), math.ceil(lon1) + 0.001, meridian_step), labels=xlabels, linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    return m


def build_cartopy_map(
    ax: plt.Axes,
    *,
    lon0,
    lon1,
    lat0,
    lat1,
    resolution="i",
    show_lat_labels=True,
    show_bottom_lon_labels=True,
    parallel_step=1.0,
    meridian_step=1.0,
):
    import cartopy.crs as ccrs
    import cartopy.feature as cfeature
    import matplotlib.ticker as mticker

    ax.set_extent([lon0, lon1, lat0, lat1], crs=ccrs.PlateCarree())
    scale_map = {"f": "f", "h": "h", "i": "i", "l": "l", "c": "c"}
    scale = scale_map.get(resolution, "i")
    gshhs = cfeature.GSHHSFeature(scale=scale, levels=[1], edgecolor="0.2", facecolor="#d7d7d7")
    ax.add_feature(gshhs, zorder=6, linewidth=0.8)
    ax.patch.set_facecolor("#f8fbff")

    gl = ax.gridlines(crs=ccrs.PlateCarree(), draw_labels=True, linewidth=0.22, color="0.4", linestyle="--")
    gl.top_labels = False
    gl.right_labels = False
    gl.left_labels = show_lat_labels
    gl.bottom_labels = show_bottom_lon_labels
    gl.xlocator = mticker.FixedLocator(np.arange(math.floor(lon0), math.ceil(lon1) + 0.001, meridian_step))
    gl.ylocator = mticker.FixedLocator(np.arange(math.floor(lat0), math.ceil(lat1) + 0.001, parallel_step))
    gl.xlabel_style = {"size": 9}
    gl.ylabel_style = {"size": 9}
    return ax


def draw_gebco_relief(
    m_or_ax,
    lon: np.ndarray,
    lat: np.ndarray,
    z: np.ndarray,
    backend="basemap",
    hillshade=True,
    hillshade_alpha=0.22,
) -> None:
    gx, gy, ggrid = xyz_to_grid(lon, lat, z)
    gx_e, gy_e = centers_to_edges(gx), centers_to_edges(gy)
    gx_e2d, gy_e2d = np.meshgrid(gx_e, gy_e)
    ocean_depth = np.ma.masked_where(ggrid >= 0, -ggrid)
    land_elev = np.ma.masked_where(ggrid <= 0, ggrid)
    dx_deg = float(np.median(np.diff(gx))) if gx.size > 1 else (1.0 / 240.0)
    dy_deg = float(np.median(np.diff(gy))) if gy.size > 1 else (1.0 / 240.0)
    lat_mid = float(np.mean(gy)) if gy.size else 0.0
    dx_m = max(dx_deg * 111320.0 * math.cos(math.radians(lat_mid)), 1.0)
    dy_m = max(dy_deg * 111320.0, 1.0)
    hill = None
    if hillshade:
        hill = LightSource(azdeg=320, altdeg=35).hillshade(np.nan_to_num(ggrid, nan=float(np.nanmedian(ggrid))), vert_exag=2.0, dx=dx_m, dy=dy_m)
    ocean_kwargs = {"cmap": "GnBu", "alpha": 0.55, "zorder": 2.5, "shading": "flat"}
    land_kwargs = {"cmap": "gist_earth", "alpha": 0.44, "zorder": 2.6, "shading": "flat"}
    hill_kwargs = {"cmap": "gray", "vmin": 0, "vmax": 1, "alpha": hillshade_alpha, "zorder": 2.8, "shading": "flat"}
    if backend == "cartopy":
        import cartopy.crs as ccrs

        ocean_kwargs["transform"] = ccrs.PlateCarree()
        land_kwargs["transform"] = ccrs.PlateCarree()
        hill_kwargs["transform"] = ccrs.PlateCarree()
    else:
        ocean_kwargs["latlon"] = True
        land_kwargs["latlon"] = True
        hill_kwargs["latlon"] = True
    if ocean_depth.count() > 0:
        vmax = float(np.nanpercentile(ocean_depth.compressed(), 99.4))
        m_or_ax.pcolormesh(gx_e2d, gy_e2d, ocean_depth, vmin=0, vmax=max(vmax, 1000.0), **ocean_kwargs)
    if land_elev.count() > 0:
        vmax = float(np.nanpercentile(land_elev.compressed(), 99.5))
        m_or_ax.pcolormesh(gx_e2d, gy_e2d, land_elev, vmin=0, vmax=max(vmax, 300.0), **land_kwargs)
    if hill is not None:
        m_or_ax.pcolormesh(gx_e2d, gy_e2d, hill, **hill_kwargs)


def add_bottom_cbar(fig: plt.Figure, mappable, *, left=0.39, bottom=0.10, width=0.22, height=0.013, label="", fontsize=9):
    cax = fig.add_axes([left, bottom, width, height])
    cbar = fig.colorbar(mappable, cax=cax, orientation="horizontal")
    if label:
        cbar.set_label(label, fontsize=fontsize)
    cbar.ax.tick_params(labelsize=fontsize)
    return cbar


def add_slim_colorbar(
    fig: plt.Figure,
    mappable,
    *,
    ax=None,
    location=None,
    orientation="horizontal",
    pad=0.03,
    fraction=0.04,
    shrink=0.5,
    label="",
    fontsize=9,
    tick_fontsize=None,
):
    """Attach a short, thin colorbar outside the target axes.

    This should be preferred over manually overlaying a `cax` for most
    single-panel maps and small shared-panel groups.
    """
    kwargs = {
        "ax": ax,
        "orientation": orientation,
        "pad": pad,
        "fraction": fraction,
        "shrink": shrink,
    }
    if location is not None:
        kwargs["location"] = location
    cbar = fig.colorbar(mappable, **kwargs)
    if label:
        cbar.set_label(label, fontsize=fontsize)
    cbar.ax.tick_params(labelsize=fontsize if tick_fontsize is None else tick_fontsize)
    return cbar
