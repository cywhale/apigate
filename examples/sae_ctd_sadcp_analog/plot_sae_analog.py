#!/usr/bin/env python3
"""SAE analog figure based on ODB CTD + SADCP public APIs."""

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

CTD_API = "https://ecodata.odb.ntu.edu.tw/api/ctd"
SADCP_API = "https://ecodata.odb.ntu.edu.tw/api/sadcp"
GEBCO_API = "https://api.odb.ntu.edu.tw/gebco"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="SAE analog using ODB CTD + SADCP")
    p.add_argument("--lon0", type=float, default=117.0)
    p.add_argument("--lon1", type=float, default=122.0)
    p.add_argument("--lat0", type=float, default=18.0)
    p.add_argument("--lat1", type=float, default=22.0)
    p.add_argument("--mode", type=str, default="5", help="Use 5 for May-like analogy, 0 for annual")
    p.add_argument("--map-dep0", type=float, default=50.0)
    p.add_argument("--map-dep1", type=float, default=150.0)
    p.add_argument("--vec-dep0", type=float, default=75.0)
    p.add_argument("--vec-dep1", type=float, default=125.0)
    p.add_argument("--section-lat", type=float, default=20.5)
    p.add_argument("--section-dep-max", type=float, default=250.0)
    p.add_argument("--gebco-sample", type=int, default=1)
    p.add_argument("--gebco-tile-deg", type=int, default=2)
    p.add_argument("--gebco-cache", type=str, default="gebco_sae_analog.npz")
    p.add_argument("--output", type=str, default="sae_analog_ctd_sadcp.png")
    p.add_argument("--timeout", type=int, default=90)
    return p.parse_args()


def fetch_json(url: str, params: dict, timeout: int) -> list[dict]:
    r = requests.get(url, params=params, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError(f"Expected list payload from {url}")
    return data


def fetch_ctd_field(args: argparse.Namespace) -> list[dict]:
    return fetch_json(
        CTD_API,
        {
            "lon0": args.lon0,
            "lon1": args.lon1,
            "lat0": args.lat0,
            "lat1": args.lat1,
            "dep0": args.map_dep0,
            "dep1": args.map_dep1,
            "dep_mode": "mean",
            "mode": args.mode,
            "append": "temperature,salinity,density,count",
        },
        args.timeout,
    )


def fetch_ctd_section(args: argparse.Namespace) -> list[dict]:
    return fetch_json(
        CTD_API,
        {
            "lon0": args.lon0,
            "lon1": args.lon1,
            "lat0": args.section_lat,
            "lat1": args.section_lat,
            "dep0": 0,
            "dep1": int(args.section_dep_max),
            "mode": args.mode,
            "append": "temperature,salinity,density,count",
        },
        args.timeout,
    )


def fetch_sadcp_vectors(args: argparse.Namespace) -> list[dict]:
    return fetch_json(
        SADCP_API,
        {
            "lon0": args.lon0,
            "lon1": args.lon1,
            "lat0": args.lat0,
            "lat1": args.lat1,
            "dep0": args.vec_dep0,
            "dep1": args.vec_dep1,
            "dep_mode": "mean",
            "mode": args.mode,
            "append": "u,v,speed,direction,count",
        },
        args.timeout,
    )


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


def fetch_gebco(args: argparse.Namespace):
    cache = Path(args.gebco_cache)
    if cache.exists():
        c = np.load(cache)
        return c["lon"], c["lat"], c["z"]

    dedup: dict[tuple[float, float], float] = {}
    for a, b, c, d in tile_bounds(args.lon0, args.lon1, args.lat0, args.lat1, args.gebco_tile_deg):
        r = requests.get(
            GEBCO_API,
            params={"mode": "zonly", "sample": args.gebco_sample, "jsonsrc": json.dumps(rect_poly(a, b, c, d), separators=(",", ":"))},
            timeout=args.timeout,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        r.raise_for_status()
        js = r.json()
        for x, y, zz in zip(js.get("longitude", []), js.get("latitude", []), js.get("z", []), strict=False):
            dedup[(round(float(x), 10), round(float(y), 10))] = float(zz)
    lon = np.fromiter((k[0] for k in dedup.keys()), dtype=float)
    lat = np.fromiter((k[1] for k in dedup.keys()), dtype=float)
    z = np.fromiter(dedup.values(), dtype=float)
    np.savez_compressed(cache, lon=lon, lat=lat, z=z)
    return lon, lat, z


def period_sort_key(t: str) -> tuple[int, str]:
    return (0, f"{int(t):03d}") if t.lstrip("-").isdigit() else (1, t)


def select_one_period(rows: list[dict]) -> list[dict]:
    periods = sorted({str(r.get("time_period", "unknown")) for r in rows}, key=period_sort_key)
    if not periods:
        return []
    return [r for r in rows if str(r.get("time_period", "unknown")) == periods[0]]


def to_float(rows: list[dict], key: str) -> np.ndarray:
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


def build_map(ax: plt.Axes, args: argparse.Namespace) -> Basemap:
    try:
        m = Basemap(
            projection="merc",
            llcrnrlon=args.lon0,
            urcrnrlon=args.lon1,
            llcrnrlat=args.lat0,
            urcrnrlat=args.lat1,
            resolution="h",
            ax=ax,
        )
    except OSError:
        m = Basemap(
            projection="merc",
            llcrnrlon=args.lon0,
            urcrnrlon=args.lon1,
            llcrnrlat=args.lat0,
            urcrnrlat=args.lat1,
            resolution="i",
            ax=ax,
        )
    m.drawmapboundary(fill_color="#f6fbff")
    m.fillcontinents(color="#d7d7d7", lake_color="#f6fbff", zorder=1)
    m.drawcoastlines(linewidth=0.8, color="0.2", zorder=6)
    m.drawparallels(np.arange(math.floor(args.lat0), math.ceil(args.lat1) + 0.001, 1.0), labels=[1, 0, 0, 0], linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    m.drawmeridians(np.arange(math.floor(args.lon0), math.ceil(args.lon1) + 0.001, 1.0), labels=[0, 0, 0, 1], linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    return m


def draw_gebco(m: Basemap, glon: np.ndarray, glat: np.ndarray, gz: np.ndarray) -> None:
    gx, gy, ggrid = xyz_to_grid(glon, glat, gz)
    gx_e, gy_e = centers_to_edges(gx), centers_to_edges(gy)
    gx_e2d, gy_e2d = np.meshgrid(gx_e, gy_e)
    ocean_depth = np.ma.masked_where(ggrid >= 0, -ggrid)
    land_elev = np.ma.masked_where(ggrid <= 0, ggrid)
    dx_deg = float(np.median(np.diff(gx))) if gx.size > 1 else (1.0 / 240.0)
    dy_deg = float(np.median(np.diff(gy))) if gy.size > 1 else (1.0 / 240.0)
    lat_mid = float(np.mean(gy)) if gy.size else 0.0
    dx_m = max(dx_deg * 111320.0 * math.cos(math.radians(lat_mid)), 1.0)
    dy_m = max(dy_deg * 111320.0, 1.0)
    z_for_shade = np.nan_to_num(ggrid, nan=float(np.nanmedian(ggrid)))
    hill = LightSource(azdeg=320, altdeg=35).hillshade(z_for_shade, vert_exag=2.0, dx=dx_m, dy=dy_m)
    if ocean_depth.count() > 0:
        vmax = float(np.nanpercentile(ocean_depth.compressed(), 99.4))
        m.pcolormesh(gx_e2d, gy_e2d, ocean_depth, latlon=True, cmap="GnBu", vmin=0, vmax=max(vmax, 1000.0), alpha=0.52, zorder=2.4, shading="flat")
    if land_elev.count() > 0:
        vmax = float(np.nanpercentile(land_elev.compressed(), 99.5))
        m.pcolormesh(gx_e2d, gy_e2d, land_elev, latlon=True, cmap="gist_earth", vmin=0, vmax=max(vmax, 300.0), alpha=0.42, zorder=2.5, shading="flat")
    m.pcolormesh(gx_e2d, gy_e2d, hill, latlon=True, cmap="gray", vmin=0, vmax=1, alpha=0.22, zorder=2.7, shading="flat")


def section_grid(rows: list[dict], value_key: str):
    lon = sorted({float(r["longitude"]) for r in rows if r.get("longitude") is not None})
    dep = sorted({float(r["depth"]) for r in rows if r.get("depth") is not None})
    arr = np.full((len(dep), len(lon)), np.nan, dtype=float)
    ix = {v: i for i, v in enumerate(lon)}
    iy = {v: i for i, v in enumerate(dep)}
    for r in rows:
        if r.get("longitude") is None or r.get("depth") is None or r.get(value_key) is None:
            continue
        arr[iy[float(r["depth"])], ix[float(r["longitude"])]] = float(r[value_key])
    return np.array(lon), np.array(dep), arr


def main() -> None:
    args = parse_args()
    ctd_field = select_one_period(fetch_ctd_field(args))
    ctd_section = select_one_period(fetch_ctd_section(args))
    sadcp = select_one_period(fetch_sadcp_vectors(args))
    glon, glat, gz = fetch_gebco(args)

    fig = plt.figure(figsize=(14.2, 10.5))
    gs = fig.add_gridspec(2, 2, height_ratios=[1.0, 0.85], hspace=0.22, wspace=0.16)

    # Map panel
    ax0 = fig.add_subplot(gs[0, :])
    m = build_map(ax0, args)
    draw_gebco(m, glon, glat, gz)

    lon = to_float(ctd_field, "longitude")
    lat = to_float(ctd_field, "latitude")
    sal = to_float(ctd_field, "salinity")
    mask = np.isfinite(lon) & np.isfinite(lat) & np.isfinite(sal)
    x, y = m(lon[mask], lat[mask])
    sc = m.scatter(x, y, c=sal[mask], s=90, linewidths=0, cmap="Spectral_r", alpha=0.95, zorder=4)

    vx = to_float(sadcp, "longitude")
    vy = to_float(sadcp, "latitude")
    vu = to_float(sadcp, "u")
    vv = to_float(sadcp, "v")
    vmask = np.isfinite(vx) & np.isfinite(vy) & np.isfinite(vu) & np.isfinite(vv)
    q = m.quiver(vx[vmask], vy[vmask], vu[vmask], vv[vmask], latlon=True, color="white", scale=7.0, width=0.0026, headwidth=3.5, headlength=4.4, headaxislength=4.0, zorder=5)
    ax0.quiverkey(q, 0.12, 0.48, 0.5, "0.5 m/s", labelpos="E", coordinates="axes", color="white")

    sx, sy = m([args.lon0, args.lon1], [args.section_lat, args.section_lat])
    m.plot(sx, sy, color="black", linewidth=2.2, zorder=6)
    m.plot(sx, sy, color="white", linewidth=1.0, dashes=[4, 2], zorder=6.1)

    ax0.set_title(f"Map: {args.map_dep0:.0f}-{args.map_dep1:.0f} m salinity with {args.vec_dep0:.0f}-{args.vec_dep1:.0f} m currents (mode={args.mode})", fontsize=13, pad=8)
    cax = fig.add_axes([0.36, 0.49, 0.28, 0.018])
    cbar = fig.colorbar(sc, cax=cax, orientation="horizontal")
    cbar.set_label("Salinity (psu), CTD depth-mean", fontsize=9)
    cbar.ax.tick_params(labelsize=9)

    # Sections
    sec = [r for r in ctd_section if float(r["depth"]) <= args.section_dep_max]
    lon_sec, dep_sec, temp_sec = section_grid(sec, "temperature")
    _, _, sal_sec = section_grid(sec, "salinity")
    _, _, den_sec = section_grid(sec, "density")
    XX, YY = np.meshgrid(lon_sec, dep_sec)

    ax1 = fig.add_subplot(gs[1, 0])
    pcm1 = ax1.pcolormesh(XX, YY, temp_sec, shading="auto", cmap="turbo")
    cs1 = ax1.contour(XX, YY, den_sec, colors="black", linewidths=0.55, levels=np.arange(np.nanmin(den_sec), np.nanmax(den_sec), 0.4))
    ax1.clabel(cs1, inline=True, fontsize=7, fmt="%.1f")
    ax1.invert_yaxis()
    ax1.set_ylim(args.section_dep_max, 0)
    ax1.set_title(f"Section at {args.section_lat:.1f}°N: Temperature", fontsize=12)
    ax1.set_xlabel("Longitude (°E)", fontsize=10)
    ax1.set_ylabel("Depth (m)", fontsize=10)
    cb1 = fig.colorbar(pcm1, ax=ax1, orientation="horizontal", pad=0.12, fraction=0.08)
    cb1.set_label("Temperature (°C)", fontsize=9)
    cb1.ax.tick_params(labelsize=8)

    ax2 = fig.add_subplot(gs[1, 1])
    pcm2 = ax2.pcolormesh(XX, YY, sal_sec, shading="auto", cmap="viridis")
    cs2 = ax2.contour(XX, YY, den_sec, colors="white", linewidths=0.6, levels=np.arange(np.nanmin(den_sec), np.nanmax(den_sec), 0.4))
    ax2.clabel(cs2, inline=True, fontsize=7, fmt="%.1f")
    ax2.invert_yaxis()
    ax2.set_ylim(args.section_dep_max, 0)
    ax2.set_title(f"Section at {args.section_lat:.1f}°N: Salinity", fontsize=12)
    ax2.set_xlabel("Longitude (°E)", fontsize=10)
    ax2.set_ylabel("Depth (m)", fontsize=10)
    cb2 = fig.colorbar(pcm2, ax=ax2, orientation="horizontal", pad=0.12, fraction=0.08)
    cb2.set_label("Salinity (psu)", fontsize=9)
    cb2.ax.tick_params(labelsize=8)

    fig.suptitle("SAE Analog with ODB CTD + SADCP", fontsize=15, y=0.98)
    fig.text(0.5, 0.02, "Analog only: public 0.25 degree mean fields can suggest subsurface warm/salty anticyclonic structure, but do not reproduce the original 2021 event.", ha="center", fontsize=9)
    fig.savefig(args.output, dpi=240, bbox_inches="tight")

    summary = Path("sae_analog_summary.md")
    summary.write_text(
        "\n".join(
            [
                "# SAE Analog Summary",
                "",
                f"- mode: {args.mode}",
                f"- map salinity depth mean: {args.map_dep0}-{args.map_dep1} m",
                f"- vector depth mean: {args.vec_dep0}-{args.vec_dep1} m",
                f"- section latitude: {args.section_lat} N",
                "",
                "This figure is feasible because ODB CTD provides gridded temperature, salinity, and density fields, which cross the main bottleneck identified in planning.",
                "It remains an analog rather than a reproduction because the original study used an event-specific eddy, hydrographic sections, and water-mass interpretation tied to 2021 observations.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Saved figure: {args.output}")
    print(f"CTD field rows: {len(ctd_field)}")
    print(f"CTD section rows: {len(ctd_section)}")
    print(f"SADCP vector rows: {len(sadcp)}")


if __name__ == "__main__":
    main()
