#!/usr/bin/env python3
"""Kuroshio current map v2: SADCP currents with semi-transparent GEBCO topography overlay."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import requests
from matplotlib.colors import LightSource
from mpl_toolkits.basemap import Basemap

SADCP_API = "https://ecodata.odb.ntu.edu.tw/api/sadcp"
GEBCO_API = "https://api.odb.ntu.edu.tw/gebco"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Kuroshio v2 (SADCP + GEBCO overlay)")
    p.add_argument("--lon0", type=float, default=120.5)
    p.add_argument("--lon1", type=float, default=123.2)
    p.add_argument("--lat0", type=float, default=21.5)
    p.add_argument("--lat1", type=float, default=26.0)

    p.add_argument("--bg-dep0", type=float, default=20.0)
    p.add_argument("--bg-dep1", type=float, default=300.0)
    p.add_argument("--bg-dep-mode", type=str, default="mean")
    p.add_argument("--bg-mode", type=str, default="0")

    p.add_argument("--vec-dep0", type=float, default=25.0)
    p.add_argument("--vec-dep1", type=float, default=35.0)
    p.add_argument("--vec-dep-mode", type=str, default="mean")
    p.add_argument("--vec-mode", type=str, default="mean")

    p.add_argument("--gebco-sample", type=int, default=1)
    p.add_argument("--gebco-tile-deg", type=int, default=2, help="Integer tile size (deg), default 2")
    p.add_argument("--gebco-timeout", type=int, default=180)
    p.add_argument("--gebco-cache", type=str, default="gebco_sample1_tile2deg.npz")

    p.add_argument("--title", type=str, default="Kuroshio Current")
    p.add_argument("--output", type=str, default="kuroshio_current_v2_gebco_overlay.png")
    p.add_argument("--timeout", type=int, default=60)
    return p.parse_args()


def fetch_sadcp(
    lon0: float,
    lon1: float,
    lat0: float,
    lat1: float,
    dep0: float,
    dep1: float,
    dep_mode: str,
    mode: str,
    timeout: int,
) -> list[dict]:
    r = requests.get(
        SADCP_API,
        params={
            "lon0": lon0,
            "lon1": lon1,
            "lat0": lat0,
            "lat1": lat1,
            "dep0": dep0,
            "dep1": dep1,
            "dep_mode": dep_mode,
            "mode": mode,
            "append": "u,v,speed,direction,count",
        },
        timeout=timeout,
    )
    r.raise_for_status()
    out = r.json()
    if not isinstance(out, list):
        raise RuntimeError("SADCP API response is not a list")
    return out


def rect_poly(lon0: float, lon1: float, lat0: float, lat1: float) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]],
    }


def tile_bounds(lon0: float, lon1: float, lat0: float, lat1: float, step: int) -> list[tuple[float, float, float, float]]:
    boxes = []
    x = lon0
    while x < lon1 - 1e-12:
        x2 = min(x + step, lon1)
        y = lat0
        while y < lat1 - 1e-12:
            y2 = min(y + step, lat1)
            boxes.append((x, x2, y, y2))
            y = y2
        x = x2
    return boxes


def fetch_gebco_tile(poly: dict, sample: int, timeout: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    r = requests.get(
        GEBCO_API,
        params={"mode": "zonly", "sample": sample, "jsonsrc": json.dumps(poly, separators=(",", ":"))},
        timeout=timeout,
    )
    r.raise_for_status()
    d = r.json()
    lon = np.array(d.get("longitude", []), dtype=float)
    lat = np.array(d.get("latitude", []), dtype=float)
    z = np.array(d.get("z", []), dtype=float)
    if not (lon.size == lat.size == z.size):
        raise RuntimeError("GEBCO arrays length mismatch")
    return lon, lat, z


def fetch_gebco_tiled(
    lon0: float,
    lon1: float,
    lat0: float,
    lat1: float,
    sample: int = 1,
    tile_deg: int = 2,
    timeout: int = 180,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if sample != 1:
        raise ValueError("This v2 workflow is designed for sample=1.")
    if tile_deg < 1:
        raise ValueError("tile_deg must be integer >= 1")

    dedup: dict[tuple[float, float], float] = {}
    for a, b, c, d in tile_bounds(lon0, lon1, lat0, lat1, tile_deg):
        lon, lat, z = fetch_gebco_tile(rect_poly(a, b, c, d), sample=sample, timeout=timeout)
        for x, y, zz in zip(lon, lat, z, strict=False):
            dedup[(round(float(x), 10), round(float(y), 10))] = float(zz)

    if not dedup:
        raise RuntimeError("GEBCO tiled fetch returned empty data")

    lon_out = np.fromiter((k[0] for k in dedup.keys()), dtype=float)
    lat_out = np.fromiter((k[1] for k in dedup.keys()), dtype=float)
    z_out = np.fromiter(dedup.values(), dtype=float)
    return lon_out, lat_out, z_out


def to_float_array(rows: list[dict], key: str) -> np.ndarray:
    return np.array([np.nan if r.get(key) is None else float(r[key]) for r in rows], dtype=float)


def period_sort_key(t: str) -> tuple[int, str]:
    return (0, f"{int(t):03d}") if t.lstrip("-").isdigit() else (1, t)


def select_one_period(rows: list[dict]) -> list[dict]:
    ps = sorted({str(r.get("time_period", "unknown")) for r in rows}, key=period_sort_key)
    if not ps:
        return []
    p0 = ps[0]
    return [r for r in rows if str(r.get("time_period", "unknown")) == p0]


def centers_to_edges(vals: np.ndarray) -> np.ndarray:
    vals = np.asarray(vals, dtype=float)
    if vals.size == 1:
        return np.array([vals[0] - 0.5 / 240, vals[0] + 0.5 / 240], dtype=float)
    mids = (vals[:-1] + vals[1:]) / 2.0
    first = vals[0] - (vals[1] - vals[0]) / 2.0
    last = vals[-1] + (vals[-1] - vals[-2]) / 2.0
    return np.concatenate([[first], mids, [last]])


def xyz_to_grid(lon: np.ndarray, lat: np.ndarray, z: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ux = np.unique(lon)
    uy = np.unique(lat)
    ux.sort()
    uy.sort()

    grid = np.full((uy.size, ux.size), np.nan, dtype=float)
    xi = {v: i for i, v in enumerate(ux)}
    yi = {v: i for i, v in enumerate(uy)}
    for x, y, zz in zip(lon, lat, z, strict=False):
        grid[yi[y], xi[x]] = zz
    return ux, uy, grid


def build_map(ax: plt.Axes, lon0: float, lon1: float, lat0: float, lat1: float) -> Basemap:
    try:
        m = Basemap(
            projection="merc",
            llcrnrlon=lon0,
            urcrnrlon=lon1,
            llcrnrlat=lat0,
            urcrnrlat=lat1,
            resolution="h",
            ax=ax,
        )
    except OSError:
        m = Basemap(
            projection="merc",
            llcrnrlon=lon0,
            urcrnrlon=lon1,
            llcrnrlat=lat0,
            urcrnrlat=lat1,
            resolution="i",
            ax=ax,
        )

    m.drawmapboundary(fill_color="#f6fbff")
    m.fillcontinents(color="#d7d7d7", lake_color="#f6fbff", zorder=1)
    m.drawcoastlines(linewidth=0.85, color="0.2", zorder=6)
    m.drawparallels(
        np.arange(math.floor(lat0), math.ceil(lat1) + 0.001, 1.0),
        labels=[1, 0, 0, 0],
        linewidth=0.22,
        dashes=[1, 0],
        fontsize=10,
        color="0.4",
        zorder=2,
    )
    m.drawmeridians(
        np.arange(math.floor(lon0), math.ceil(lon1) + 0.001, 1.0),
        labels=[0, 0, 0, 1],
        linewidth=0.22,
        dashes=[1, 0],
        fontsize=10,
        color="0.4",
        zorder=2,
    )
    return m


def plot_v2(
    sadcp_bg: list[dict],
    sadcp_vec: list[dict],
    gebco_lon: np.ndarray,
    gebco_lat: np.ndarray,
    gebco_z: np.ndarray,
    args: argparse.Namespace,
) -> None:
    bg_rows = select_one_period(sadcp_bg)
    vec_rows = select_one_period(sadcp_vec)
    if not bg_rows or not vec_rows:
        raise RuntimeError("SADCP payload has no usable time_period rows")

    fig, ax = plt.subplots(figsize=(10.4, 9.6))
    m = build_map(ax, args.lon0, args.lon1, args.lat0, args.lat1)

    gx, gy, gz = xyz_to_grid(gebco_lon, gebco_lat, gebco_z)
    gx_e = centers_to_edges(gx)
    gy_e = centers_to_edges(gy)
    gx_e2d, gy_e2d = np.meshgrid(gx_e, gy_e)

    ocean_depth = np.ma.masked_where(gz >= 0, -gz)  # positive depth in ocean
    land_elev = np.ma.masked_where(gz <= 0, gz)     # positive elevation on land

    dx_deg = float(np.median(np.diff(gx))) if gx.size > 1 else (1.0 / 240.0)
    dy_deg = float(np.median(np.diff(gy))) if gy.size > 1 else (1.0 / 240.0)
    lat_mid = float(np.mean(gy)) if gy.size else 0.0
    dx_m = max(dx_deg * 111320.0 * math.cos(math.radians(lat_mid)), 1.0)
    dy_m = max(dy_deg * 111320.0, 1.0)

    z_for_shade = np.array(gz, dtype=float)
    if np.isnan(z_for_shade).any():
        z_for_shade = np.nan_to_num(z_for_shade, nan=float(np.nanmedian(z_for_shade)))
    ls = LightSource(azdeg=320, altdeg=38)
    hill = ls.hillshade(z_for_shade, vert_exag=2.0, dx=dx_m, dy=dy_m)

    if ocean_depth.count() > 0:
        vmax_ocean = float(np.nanpercentile(ocean_depth.compressed(), 99.4))
        m.pcolormesh(
            gx_e2d,
            gy_e2d,
            ocean_depth,
            latlon=True,
            cmap="GnBu",
            vmin=0,
            vmax=max(vmax_ocean, 1000.0),
            alpha=0.58,
            zorder=2.5,
            shading="flat",
        )

    if land_elev.count() > 0:
        vmax_land = float(np.nanpercentile(land_elev.compressed(), 99.5))
        m.pcolormesh(
            gx_e2d,
            gy_e2d,
            land_elev,
            latlon=True,
            cmap="gist_earth",
            vmin=0,
            vmax=max(vmax_land, 300.0),
            alpha=0.46,
            zorder=2.6,
            shading="flat",
        )

    # Relief shading layer to enhance terrain/bathymetry texture.
    m.pcolormesh(
        gx_e2d,
        gy_e2d,
        hill,
        latlon=True,
        cmap="gray",
        vmin=0,
        vmax=1,
        alpha=0.28,
        zorder=2.8,
        shading="flat",
    )

    # Sparse bathymetry contours improve relief perception without clutter.
    contour_levels = [-4500, -3500, -2500, -1500, -1000, -500, -200]
    gx2d, gy2d = np.meshgrid(gx, gy)
    m.contour(
        gx2d,
        gy2d,
        gz,
        levels=contour_levels,
        latlon=True,
        colors="#274b74",
        linewidths=0.45,
        alpha=0.30,
        zorder=3.0,
    )

    bg_lon = to_float_array(bg_rows, "longitude")
    bg_lat = to_float_array(bg_rows, "latitude")
    bg_speed = to_float_array(bg_rows, "speed")
    mask_bg = np.isfinite(bg_lon) & np.isfinite(bg_lat) & np.isfinite(bg_speed)
    bg_lon, bg_lat, bg_speed = bg_lon[mask_bg], bg_lat[mask_bg], bg_speed[mask_bg]
    vcur_max = max(float(np.nanpercentile(bg_speed, 98)), 0.2)

    bx, by = m(bg_lon, bg_lat)
    sc = m.scatter(
        bx,
        by,
        c=bg_speed,
        s=56,
        marker="o",
        linewidths=0,
        cmap="jet",
        vmin=0.0,
        vmax=vcur_max,
        alpha=0.93,
        zorder=4,
    )

    vx = to_float_array(vec_rows, "longitude")
    vy = to_float_array(vec_rows, "latitude")
    vu = to_float_array(vec_rows, "u")
    vv = to_float_array(vec_rows, "v")
    mvec = np.isfinite(vx) & np.isfinite(vy) & np.isfinite(vu) & np.isfinite(vv)
    q = m.quiver(
        vx[mvec],
        vy[mvec],
        vu[mvec],
        vv[mvec],
        latlon=True,
        color="white",
        scale=9.5,
        width=0.0025,
        headwidth=3.5,
        headlength=4.4,
        headaxislength=4.0,
        zorder=5,
    )
    # Put vector scale over Taiwan land area to avoid overlap with ocean vectors.
    ax.quiverkey(q, 0.13, 0.50, 1.0, "1 m/s", labelpos="E", coordinates="axes", color="white")

    if args.title.strip():
        ax.set_title(args.title.strip(), fontsize=15, pad=8)

    cbar = fig.colorbar(sc, ax=ax, orientation="horizontal", fraction=0.024, pad=0.035, shrink=0.44, aspect=34)
    cbar.set_label("Speed (m/s), 20-300 m depth-mean (0.25 degree grid)", fontsize=10)

    fig.subplots_adjust(left=0.055, right=0.985, bottom=0.095, top=0.95)
    fig.savefig(args.output, dpi=240)


def main() -> None:
    args = parse_args()

    sadcp_bg = fetch_sadcp(
        lon0=args.lon0,
        lon1=args.lon1,
        lat0=args.lat0,
        lat1=args.lat1,
        dep0=args.bg_dep0,
        dep1=args.bg_dep1,
        dep_mode=args.bg_dep_mode,
        mode=args.bg_mode,
        timeout=args.timeout,
    )
    sadcp_vec = fetch_sadcp(
        lon0=args.lon0,
        lon1=args.lon1,
        lat0=args.lat0,
        lat1=args.lat1,
        dep0=args.vec_dep0,
        dep1=args.vec_dep1,
        dep_mode=args.vec_dep_mode,
        mode=args.vec_mode,
        timeout=args.timeout,
    )
    if not sadcp_vec and args.vec_mode == "mean":
        sadcp_vec = fetch_sadcp(
            lon0=args.lon0,
            lon1=args.lon1,
            lat0=args.lat0,
            lat1=args.lat1,
            dep0=args.vec_dep0,
            dep1=args.vec_dep1,
            dep_mode=args.vec_dep_mode,
            mode="0",
            timeout=args.timeout,
        )

    cache_path = Path(args.gebco_cache) if args.gebco_cache else None
    if cache_path and cache_path.exists():
        cache = np.load(cache_path)
        glon = cache["lon"]
        glat = cache["lat"]
        gz = cache["z"]
    else:
        glon, glat, gz = fetch_gebco_tiled(
            lon0=args.lon0,
            lon1=args.lon1,
            lat0=args.lat0,
            lat1=args.lat1,
            sample=args.gebco_sample,
            tile_deg=args.gebco_tile_deg,
            timeout=args.gebco_timeout,
        )
        if cache_path:
            np.savez_compressed(cache_path, lon=glon, lat=glat, z=gz)

    plot_v2(sadcp_bg, sadcp_vec, glon, glat, gz, args)
    print(f"Saved figure: {args.output}")
    print(f"SADCP BG rows: {len(sadcp_bg)}")
    print(f"SADCP VEC rows: {len(sadcp_vec)}")
    print(f"GEBCO points: {len(gz)}")


if __name__ == "__main__":
    main()
