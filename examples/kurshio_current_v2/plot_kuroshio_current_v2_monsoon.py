#!/usr/bin/env python3
"""Monsoon comparison figure: mode=17 vs mode=18 (two subplots) with GEBCO overlay."""

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
    p = argparse.ArgumentParser(description="Kuroshio v2 monsoon compare (mode=17 vs mode=18)")
    p.add_argument("--lon0", type=float, default=120.5)
    p.add_argument("--lon1", type=float, default=123.2)
    p.add_argument("--lat0", type=float, default=21.5)
    p.add_argument("--lat1", type=float, default=26.0)

    p.add_argument("--bg-dep0", type=float, default=20.0)
    p.add_argument("--bg-dep1", type=float, default=300.0)
    p.add_argument("--bg-dep-mode", type=str, default="mean")

    p.add_argument("--vec-dep0", type=float, default=25.0)
    p.add_argument("--vec-dep1", type=float, default=35.0)
    p.add_argument("--vec-dep-mode", type=str, default="mean")

    p.add_argument("--mode-left", type=str, default="17")
    p.add_argument("--mode-right", type=str, default="18")

    p.add_argument("--gebco-sample", type=int, default=1)
    p.add_argument("--gebco-tile-deg", type=int, default=2)
    p.add_argument("--gebco-timeout", type=int, default=180)
    p.add_argument("--gebco-cache", type=str, default="gebco_sample1_tile2deg.npz")

    p.add_argument("--title", type=str, default="Kuroshio Current")
    p.add_argument("--output", type=str, default="kurshio_current_v2_monsoon.png")
    p.add_argument("--timeout", type=int, default=60)
    return p.parse_args()


def fetch_sadcp(lon0, lon1, lat0, lat1, dep0, dep1, dep_mode, mode, timeout) -> list[dict]:
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
        raise RuntimeError("SADCP API response is not list")
    return out


def rect_poly(lon0, lon1, lat0, lat1) -> dict:
    return {"type": "Polygon", "coordinates": [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]]}


def tile_bounds(lon0, lon1, lat0, lat1, step: int) -> list[tuple[float, float, float, float]]:
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


def fetch_gebco_tiled(lon0, lon1, lat0, lat1, sample=1, tile_deg=2, timeout=180):
    if sample != 1:
        raise ValueError("This workflow is designed for sample=1")
    dedup: dict[tuple[float, float], float] = {}
    for a, b, c, d in tile_bounds(lon0, lon1, lat0, lat1, int(tile_deg)):
        r = requests.get(
            GEBCO_API,
            params={"mode": "zonly", "sample": sample, "jsonsrc": json.dumps(rect_poly(a, b, c, d), separators=(",", ":"))},
            timeout=timeout,
        )
        r.raise_for_status()
        js = r.json()
        lon = js.get("longitude", [])
        lat = js.get("latitude", [])
        z = js.get("z", [])
        for x, y, zz in zip(lon, lat, z, strict=False):
            dedup[(round(float(x), 10), round(float(y), 10))] = float(zz)
    glon = np.fromiter((k[0] for k in dedup.keys()), dtype=float)
    glat = np.fromiter((k[1] for k in dedup.keys()), dtype=float)
    gz = np.fromiter(dedup.values(), dtype=float)
    return glon, glat, gz


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


def build_map(ax: plt.Axes, lon0, lon1, lat0, lat1, show_lat_labels: bool) -> Basemap:
    try:
        m = Basemap(
            projection="merc",
            llcrnrlon=lon0,
            urcrnrlon=lon1,
            llcrnrlat=lat0,
            urcrnrlat=lat1,
            resolution="h",
            ax=ax,
            fix_aspect=True,
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
            fix_aspect=True,
        )
    m.drawmapboundary(fill_color="#f6fbff")
    m.fillcontinents(color="#d7d7d7", lake_color="#f6fbff", zorder=1)
    m.drawcoastlines(linewidth=0.85, color="0.2", zorder=6)
    ylabels = [1, 0, 0, 0] if show_lat_labels else [0, 0, 0, 0]
    m.drawparallels(np.arange(math.floor(lat0), math.ceil(lat1) + 0.001, 1.0), labels=ylabels, linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    m.drawmeridians(np.arange(math.floor(lon0), math.ceil(lon1) + 0.001, 1.0), labels=[0, 0, 0, 1], linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    return m


def draw_gebco_layers(m: Basemap, gx: np.ndarray, gy: np.ndarray, gz: np.ndarray) -> None:
    gx_e = centers_to_edges(gx)
    gy_e = centers_to_edges(gy)
    gx_e2d, gy_e2d = np.meshgrid(gx_e, gy_e)

    ocean_depth = np.ma.masked_where(gz >= 0, -gz)
    land_elev = np.ma.masked_where(gz <= 0, gz)

    dx_deg = float(np.median(np.diff(gx))) if gx.size > 1 else (1.0 / 240.0)
    dy_deg = float(np.median(np.diff(gy))) if gy.size > 1 else (1.0 / 240.0)
    lat_mid = float(np.mean(gy)) if gy.size else 0.0
    dx_m = max(dx_deg * 111320.0 * math.cos(math.radians(lat_mid)), 1.0)
    dy_m = max(dy_deg * 111320.0, 1.0)

    z_for_shade = np.array(gz, dtype=float)
    if np.isnan(z_for_shade).any():
        z_for_shade = np.nan_to_num(z_for_shade, nan=float(np.nanmedian(z_for_shade)))
    hill = LightSource(azdeg=320, altdeg=38).hillshade(z_for_shade, vert_exag=2.0, dx=dx_m, dy=dy_m)

    if ocean_depth.count() > 0:
        vmax_ocean = float(np.nanpercentile(ocean_depth.compressed(), 99.4))
        m.pcolormesh(gx_e2d, gy_e2d, ocean_depth, latlon=True, cmap="GnBu", vmin=0, vmax=max(vmax_ocean, 1000.0), alpha=0.58, zorder=2.5, shading="flat")
    if land_elev.count() > 0:
        vmax_land = float(np.nanpercentile(land_elev.compressed(), 99.5))
        m.pcolormesh(gx_e2d, gy_e2d, land_elev, latlon=True, cmap="gist_earth", vmin=0, vmax=max(vmax_land, 300.0), alpha=0.46, zorder=2.6, shading="flat")

    m.pcolormesh(gx_e2d, gy_e2d, hill, latlon=True, cmap="gray", vmin=0, vmax=1, alpha=0.28, zorder=2.8, shading="flat")
    m.contour(*np.meshgrid(gx, gy), gz, levels=[-4500, -3500, -2500, -1500, -1000, -500, -200], latlon=True, colors="#274b74", linewidths=0.45, alpha=0.30, zorder=3.0)


def draw_panel(
    ax: plt.Axes,
    args: argparse.Namespace,
    gx: np.ndarray,
    gy: np.ndarray,
    gz: np.ndarray,
    bg_rows: list[dict],
    vec_rows: list[dict],
    panel_title: str,
    show_key: bool,
    show_lat_labels: bool,
    anchor: str,
    vmin: float,
    vmax: float,
):
    m = build_map(ax, args.lon0, args.lon1, args.lat0, args.lat1, show_lat_labels=show_lat_labels)
    ax.set_anchor(anchor)
    draw_gebco_layers(m, gx, gy, gz)

    bg_rows = select_one_period(bg_rows)
    vec_rows = select_one_period(vec_rows)

    bg_lon = to_float_array(bg_rows, "longitude")
    bg_lat = to_float_array(bg_rows, "latitude")
    bg_speed = to_float_array(bg_rows, "speed")
    bmask = np.isfinite(bg_lon) & np.isfinite(bg_lat) & np.isfinite(bg_speed)
    bx, by = m(bg_lon[bmask], bg_lat[bmask])
    sc = m.scatter(bx, by, c=bg_speed[bmask], s=56, marker="o", linewidths=0, cmap="jet", vmin=vmin, vmax=vmax, alpha=0.93, zorder=4)

    vx = to_float_array(vec_rows, "longitude")
    vy = to_float_array(vec_rows, "latitude")
    vu = to_float_array(vec_rows, "u")
    vv = to_float_array(vec_rows, "v")
    vmask = np.isfinite(vx) & np.isfinite(vy) & np.isfinite(vu) & np.isfinite(vv)
    q = m.quiver(vx[vmask], vy[vmask], vu[vmask], vv[vmask], latlon=True, color="white", scale=9.5, width=0.0025, headwidth=3.5, headlength=4.4, headaxislength=4.0, zorder=5)

    if show_key:
        ax.quiverkey(q, 0.13, 0.50, 1.0, "1 m/s", labelpos="E", coordinates="axes", color="white")

    ax.set_title(panel_title, fontsize=13, pad=6)
    return sc


def main() -> None:
    args = parse_args()

    # GEBCO load/cache
    cache_path = Path(args.gebco_cache) if args.gebco_cache else None
    if cache_path and cache_path.exists():
        c = np.load(cache_path)
        glon = c["lon"]
        glat = c["lat"]
        gz = c["z"]
    else:
        glon, glat, gz = fetch_gebco_tiled(args.lon0, args.lon1, args.lat0, args.lat1, sample=args.gebco_sample, tile_deg=args.gebco_tile_deg, timeout=args.gebco_timeout)
        if cache_path:
            np.savez_compressed(cache_path, lon=glon, lat=glat, z=gz)

    gx, gy, ggrid = xyz_to_grid(glon, glat, gz)

    # left (mode 17)
    bg17 = fetch_sadcp(args.lon0, args.lon1, args.lat0, args.lat1, args.bg_dep0, args.bg_dep1, args.bg_dep_mode, args.mode_left, args.timeout)
    vec17 = fetch_sadcp(args.lon0, args.lon1, args.lat0, args.lat1, args.vec_dep0, args.vec_dep1, args.vec_dep_mode, args.mode_left, args.timeout)

    # right (mode 18)
    bg18 = fetch_sadcp(args.lon0, args.lon1, args.lat0, args.lat1, args.bg_dep0, args.bg_dep1, args.bg_dep_mode, args.mode_right, args.timeout)
    vec18 = fetch_sadcp(args.lon0, args.lon1, args.lat0, args.lat1, args.vec_dep0, args.vec_dep1, args.vec_dep_mode, args.mode_right, args.timeout)

    speed17 = to_float_array(select_one_period(bg17), "speed")
    speed18 = to_float_array(select_one_period(bg18), "speed")
    s = np.concatenate([speed17[np.isfinite(speed17)], speed18[np.isfinite(speed18)]])
    vmin, vmax = 0.0, max(float(np.nanpercentile(s, 98)), 0.2)

    fig, axes = plt.subplots(1, 2, figsize=(16.4, 8.9))
    sc_left = draw_panel(
        axes[0], args, gx, gy, ggrid, bg17, vec17,
        panel_title="NE Monsoon Oct-Apr", show_key=True, show_lat_labels=True, anchor="E", vmin=vmin, vmax=vmax
    )
    _ = draw_panel(
        axes[1], args, gx, gy, ggrid, bg18, vec18,
        panel_title="SW Monsoon May-Sep", show_key=False, show_lat_labels=False, anchor="W", vmin=vmin, vmax=vmax
    )

    if args.title.strip():
        fig.suptitle(args.title, fontsize=14, y=0.96)

    # Use a dedicated colorbar axes to guarantee separation from x-axis tick labels.
    cax = fig.add_axes([0.36, 0.1, 0.28, 0.02])
    cbar = fig.colorbar(sc_left, cax=cax, orientation="horizontal")
    cbar.set_label("Speed (m/s), 20-300 m depth-mean (0.25 degree grid)", fontsize=9)
    cbar.ax.tick_params(labelsize=9)

    fig.subplots_adjust(left=0.025, right=0.985, bottom=0.16, top=0.90, wspace=0.01)
    fig.savefig(args.output, dpi=240)

    print(f"Saved figure: {args.output}")
    print(f"GEBCO points: {len(gz)}")
    print(f"mode17 BG/VEC rows: {len(bg17)}/{len(vec17)}")
    print(f"mode18 BG/VEC rows: {len(bg18)}/{len(vec18)}")


if __name__ == "__main__":
    main()
