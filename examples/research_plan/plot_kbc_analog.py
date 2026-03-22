#!/usr/bin/env python3
"""KBC analog figures and proxy outputs based on public ODB SADCP + GEBCO APIs."""

from __future__ import annotations

import argparse
import csv
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
    p = argparse.ArgumentParser(description="KBC analog figures and proxy")
    p.add_argument("--lon0", type=float, default=119.5)
    p.add_argument("--lon1", type=float, default=123.5)
    p.add_argument("--lat0", type=float, default=20.5)
    p.add_argument("--lat1", type=float, default=26.5)

    p.add_argument("--bg-dep0", type=float, default=20.0)
    p.add_argument("--bg-dep1", type=float, default=300.0)
    p.add_argument("--bg-dep-mode", type=str, default="mean")
    p.add_argument("--vec-dep0", type=float, default=25.0)
    p.add_argument("--vec-dep1", type=float, default=35.0)
    p.add_argument("--vec-dep-mode", type=str, default="mean")

    p.add_argument("--annual-mode", type=str, default="0")
    p.add_argument("--mode-left", type=str, default="17")
    p.add_argument("--mode-right", type=str, default="18")

    p.add_argument("--proxy-lon0", type=float, default=120.5)
    p.add_argument("--proxy-lon1", type=float, default=121.75)
    p.add_argument("--proxy-lat0", type=float, default=21.0)
    p.add_argument("--proxy-lat1", type=float, default=23.5)

    p.add_argument("--gebco-sample", type=int, default=1)
    p.add_argument("--gebco-tile-deg", type=int, default=2)
    p.add_argument("--gebco-timeout", type=int, default=180)
    p.add_argument("--gebco-cache", type=str, default="gebco_sample1_tile2deg_kbc.npz")

    p.add_argument("--output-prefix", type=str, default="kbc_analog")
    p.add_argument("--title", type=str, default="Kuroshio Branch Current Analog")
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
    payload = r.json()
    if not isinstance(payload, list):
        raise RuntimeError("SADCP API response is not a list")
    return payload


def rect_poly(lon0, lon1, lat0, lat1) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]],
    }


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


def fetch_gebco_tiled(lon0, lon1, lat0, lat1, sample=1, tile_deg=2, timeout=180):
    dedup: dict[tuple[float, float], float] = {}
    for a, b, c, d in tile_bounds(lon0, lon1, lat0, lat1, int(tile_deg)):
        r = requests.get(
            GEBCO_API,
            params={
                "mode": "zonly",
                "sample": sample,
                "jsonsrc": json.dumps(rect_poly(a, b, c, d), separators=(",", ":")),
            },
            timeout=timeout,
        )
        r.raise_for_status()
        js = r.json()
        lon = js.get("longitude", [])
        lat = js.get("latitude", [])
        z = js.get("z", [])
        for x, y, zz in zip(lon, lat, z, strict=False):
            dedup[(round(float(x), 10), round(float(y), 10))] = float(zz)

    if not dedup:
        raise RuntimeError("GEBCO returned no data")
    glon = np.fromiter((k[0] for k in dedup.keys()), dtype=float)
    glat = np.fromiter((k[1] for k in dedup.keys()), dtype=float)
    gz = np.fromiter(dedup.values(), dtype=float)
    return glon, glat, gz


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
    grid = np.full((uy.size, ux.size), np.nan, dtype=float)
    xi = {v: i for i, v in enumerate(ux)}
    yi = {v: i for i, v in enumerate(uy)}
    for x, y, zz in zip(lon, lat, z, strict=False):
        grid[yi[y], xi[x]] = zz
    return ux, uy, grid


def to_float_array(rows: list[dict], key: str) -> np.ndarray:
    return np.array([np.nan if r.get(key) is None else float(r[key]) for r in rows], dtype=float)


def period_sort_key(t: str) -> tuple[int, str]:
    return (0, f"{int(t):03d}") if t.lstrip("-").isdigit() else (1, t)


def select_one_period(rows: list[dict]) -> list[dict]:
    periods = sorted({str(r.get("time_period", "unknown")) for r in rows}, key=period_sort_key)
    if not periods:
        return []
    return [r for r in rows if str(r.get("time_period", "unknown")) == periods[0]]


def load_gebco(args: argparse.Namespace):
    cache_path = Path(args.gebco_cache) if args.gebco_cache else None
    if cache_path and cache_path.exists():
        c = np.load(cache_path)
        return c["lon"], c["lat"], c["z"]
    glon, glat, gz = fetch_gebco_tiled(
        args.lon0,
        args.lon1,
        args.lat0,
        args.lat1,
        sample=args.gebco_sample,
        tile_deg=args.gebco_tile_deg,
        timeout=args.gebco_timeout,
    )
    if cache_path:
        np.savez_compressed(cache_path, lon=glon, lat=glat, z=gz)
    return glon, glat, gz


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
    m.drawparallels(
        np.arange(math.floor(lat0), math.ceil(lat1) + 0.001, 1.0),
        labels=ylabels,
        linewidth=0.22,
        dashes=[1, 0],
        fontsize=9,
        color="0.4",
        zorder=2,
    )
    m.drawmeridians(
        np.arange(math.floor(lon0), math.ceil(lon1) + 0.001, 1.0),
        labels=[0, 0, 0, 1],
        linewidth=0.22,
        dashes=[1, 0],
        fontsize=9,
        color="0.4",
        zorder=2,
    )
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


def draw_proxy_box(m: Basemap, args: argparse.Namespace) -> None:
    xs = [args.proxy_lon0, args.proxy_lon1, args.proxy_lon1, args.proxy_lon0, args.proxy_lon0]
    ys = [args.proxy_lat0, args.proxy_lat0, args.proxy_lat1, args.proxy_lat1, args.proxy_lat0]
    px, py = m(xs, ys)
    m.plot(px, py, color="black", linewidth=1.9, zorder=7)
    m.plot(px, py, color="white", linewidth=0.9, dashes=[4, 2], zorder=7.1)


def plot_panel(
    ax: plt.Axes,
    args: argparse.Namespace,
    gx: np.ndarray,
    gy: np.ndarray,
    gz: np.ndarray,
    bg_rows: list[dict],
    vec_rows: list[dict],
    title: str,
    show_lat_labels: bool,
    show_key: bool,
    anchor: str,
    vmin: float,
    vmax: float,
):
    m = build_map(ax, args.lon0, args.lon1, args.lat0, args.lat1, show_lat_labels=show_lat_labels)
    ax.set_anchor(anchor)
    draw_gebco_layers(m, gx, gy, gz)

    bg = select_one_period(bg_rows)
    vec = select_one_period(vec_rows)

    bg_lon = to_float_array(bg, "longitude")
    bg_lat = to_float_array(bg, "latitude")
    bg_speed = to_float_array(bg, "speed")
    bmask = np.isfinite(bg_lon) & np.isfinite(bg_lat) & np.isfinite(bg_speed)
    bx, by = m(bg_lon[bmask], bg_lat[bmask])
    sc = m.scatter(
        bx,
        by,
        c=bg_speed[bmask],
        s=56,
        marker="o",
        linewidths=0,
        cmap="jet",
        vmin=vmin,
        vmax=vmax,
        alpha=0.93,
        zorder=4,
    )

    vx = to_float_array(vec, "longitude")
    vy = to_float_array(vec, "latitude")
    vu = to_float_array(vec, "u")
    vv = to_float_array(vec, "v")
    vmask = np.isfinite(vx) & np.isfinite(vy) & np.isfinite(vu) & np.isfinite(vv)
    q = m.quiver(vx[vmask], vy[vmask], vu[vmask], vv[vmask], latlon=True, color="white", scale=9.5, width=0.0025, headwidth=3.5, headlength=4.4, headaxislength=4.0, zorder=5)

    draw_proxy_box(m, args)
    if show_key:
        ax.quiverkey(q, 0.13, 0.50, 1.0, "1 m/s", labelpos="E", coordinates="axes", color="white")
    ax.set_title(title, fontsize=13, pad=6)
    return sc


def compute_proxy(rows: list[dict], args: argparse.Namespace, mode_label: str) -> dict:
    rows = select_one_period(rows)
    lon = to_float_array(rows, "longitude")
    lat = to_float_array(rows, "latitude")
    u = to_float_array(rows, "u")
    v = to_float_array(rows, "v")
    speed = to_float_array(rows, "speed")
    direction = to_float_array(rows, "direction")

    box_mask = (
        np.isfinite(lon)
        & np.isfinite(lat)
        & np.isfinite(u)
        & np.isfinite(v)
        & np.isfinite(speed)
        & (lon >= args.proxy_lon0)
        & (lon <= args.proxy_lon1)
        & (lat >= args.proxy_lat0)
        & (lat <= args.proxy_lat1)
    )

    count_total = int(np.count_nonzero(box_mask))
    if count_total == 0:
        return {
            "mode": mode_label,
            "grid_count_total": 0,
            "grid_count_nw": 0,
            "nw_ratio_percent": float("nan"),
            "nw_mean_speed_mps": float("nan"),
            "all_mean_speed_mps": float("nan"),
            "mean_u_mps": float("nan"),
            "mean_v_mps": float("nan"),
            "mean_direction_deg": float("nan"),
        }

    nw_mask = box_mask & (u < 0.0) & (v > 0.0)
    count_nw = int(np.count_nonzero(nw_mask))
    ratio = 100.0 * count_nw / count_total
    return {
        "mode": mode_label,
        "grid_count_total": count_total,
        "grid_count_nw": count_nw,
        "nw_ratio_percent": ratio,
        "nw_mean_speed_mps": float(np.nanmean(speed[nw_mask])) if count_nw else float("nan"),
        "all_mean_speed_mps": float(np.nanmean(speed[box_mask])),
        "mean_u_mps": float(np.nanmean(u[box_mask])),
        "mean_v_mps": float(np.nanmean(v[box_mask])),
        "mean_direction_deg": float(np.nanmean(direction[box_mask])) if np.isfinite(direction[box_mask]).any() else float("nan"),
    }


def save_proxy_outputs(records: list[dict], prefix: str) -> None:
    csv_path = Path(f"{prefix}_proxy.csv")
    json_path = Path(f"{prefix}_proxy.json")

    fieldnames = list(records[0].keys())
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def plot_proxy_chart(records: list[dict], prefix: str) -> None:
    labels = [r["mode"] for r in records]
    ratios = [r["nw_ratio_percent"] for r in records]
    speeds = [r["nw_mean_speed_mps"] if np.isfinite(r["nw_mean_speed_mps"]) else 0.0 for r in records]

    fig, ax1 = plt.subplots(figsize=(7.8, 4.8))
    x = np.arange(len(labels))
    bars = ax1.bar(x, ratios, color=["#d95f02", "#1b9e77", "#7570b3"], width=0.62)
    ax1.set_xticks(x, labels)
    ax1.set_ylabel("Northwestward grid-cell ratio (%)", fontsize=10)
    ax1.set_ylim(0, max(max(ratios) * 1.25 if ratios else 1, 10))
    ax1.tick_params(axis="both", labelsize=9)
    ax1.grid(axis="y", linewidth=0.3, alpha=0.4)

    ax2 = ax1.twinx()
    ax2.plot(x, speeds, color="black", marker="o", linewidth=1.2)
    ax2.set_ylabel("Mean NW speed (m/s)", fontsize=10)
    ax2.tick_params(axis="y", labelsize=9)

    for rect, val in zip(bars, ratios, strict=False):
        ax1.text(rect.get_x() + rect.get_width() / 2.0, rect.get_height() + 0.6, f"{val:.1f}", ha="center", va="bottom", fontsize=8)

    ax1.set_title("KBC Proxy in Target Box", fontsize=12, pad=8)
    fig.tight_layout()
    fig.savefig(f"{prefix}_proxy.png", dpi=240)
    plt.close(fig)


def write_summary(records: list[dict], args: argparse.Namespace, prefix: str) -> None:
    lines = [
        "# KBC Analog Summary",
        "",
        "此輸出對應 Han et al. 2021 的 Kuroshio Branch Current 類比問題。",
        "它使用 ODB SADCP 公開 0.25 度格點流場，觀察在目標盒區中具有西向且北向分量的格點比例。",
        "",
        "## Proxy Box",
        "",
        f"- lon: {args.proxy_lon0} to {args.proxy_lon1}",
        f"- lat: {args.proxy_lat0} to {args.proxy_lat1}",
        "",
        "## Records",
        "",
    ]
    for r in records:
        lines.extend(
            [
                f"### {r['mode']}",
                "",
                f"- total grid cells: {r['grid_count_total']}",
                f"- northwestward grid cells: {r['grid_count_nw']}",
                f"- northwestward ratio: {r['nw_ratio_percent']:.2f}%",
                f"- mean speed in target box: {r['all_mean_speed_mps']:.3f} m/s",
                f"- mean northwestward speed: {r['nw_mean_speed_mps']:.3f} m/s" if np.isfinite(r["nw_mean_speed_mps"]) else "- mean northwestward speed: n/a",
                f"- mean u: {r['mean_u_mps']:.3f} m/s",
                f"- mean v: {r['mean_v_mps']:.3f} m/s",
                "",
            ]
        )
    Path(f"{prefix}_summary.md").write_text("\n".join(lines), encoding="utf-8")


def fetch_mode_bundle(args: argparse.Namespace, mode: str) -> tuple[list[dict], list[dict]]:
    bg = fetch_sadcp(args.lon0, args.lon1, args.lat0, args.lat1, args.bg_dep0, args.bg_dep1, args.bg_dep_mode, mode, args.timeout)
    vec = fetch_sadcp(args.lon0, args.lon1, args.lat0, args.lat1, args.vec_dep0, args.vec_dep1, args.vec_dep_mode, mode, args.timeout)
    return bg, vec


def main() -> None:
    args = parse_args()
    prefix = args.output_prefix

    glon, glat, gz = load_gebco(args)
    gx, gy, ggrid = xyz_to_grid(glon, glat, gz)

    annual_bg, annual_vec = fetch_mode_bundle(args, args.annual_mode)
    left_bg, left_vec = fetch_mode_bundle(args, args.mode_left)
    right_bg, right_vec = fetch_mode_bundle(args, args.mode_right)

    all_speeds = []
    for rows in [annual_bg, left_bg, right_bg]:
        s = to_float_array(select_one_period(rows), "speed")
        all_speeds.append(s[np.isfinite(s)])
    speeds = np.concatenate(all_speeds) if all_speeds else np.array([0.2])
    vmin, vmax = 0.0, max(float(np.nanpercentile(speeds, 98)), 0.2)

    # Output A: annual main figure
    fig, ax = plt.subplots(figsize=(10.6, 9.4))
    sc = plot_panel(ax, args, gx, gy, ggrid, annual_bg, annual_vec, "Annual Mean", True, True, "C", vmin, vmax)
    if args.title.strip():
        fig.suptitle(args.title, fontsize=14, y=0.96)
    cax = fig.add_axes([0.32, 0.1, 0.36, 0.022])
    cbar = fig.colorbar(sc, cax=cax, orientation="horizontal")
    cbar.set_label("Speed (m/s), 20-300 m depth-mean (0.25 degree grid)", fontsize=9)
    cbar.ax.tick_params(labelsize=9)
    fig.subplots_adjust(left=0.06, right=0.97, bottom=0.16, top=0.92)
    fig.savefig(f"{prefix}_annual.png", dpi=240)
    plt.close(fig)

    # Output B: monsoon comparison
    fig, axes = plt.subplots(1, 2, figsize=(16.4, 8.9))
    sc_left = plot_panel(axes[0], args, gx, gy, ggrid, left_bg, left_vec, "NE Monsoon Oct-Apr", True, True, "E", vmin, vmax)
    plot_panel(axes[1], args, gx, gy, ggrid, right_bg, right_vec, "SW Monsoon May-Sep", False, False, "W", vmin, vmax)
    if args.title.strip():
        fig.suptitle(args.title, fontsize=14, y=0.96)
    cax = fig.add_axes([0.36, 0.1, 0.28, 0.02])
    cbar = fig.colorbar(sc_left, cax=cax, orientation="horizontal")
    cbar.set_label("Speed (m/s), 20-300 m depth-mean (0.25 degree grid)", fontsize=9)
    cbar.ax.tick_params(labelsize=9)
    fig.subplots_adjust(left=0.025, right=0.985, bottom=0.16, top=0.90, wspace=0.01)
    fig.savefig(f"{prefix}_monsoon.png", dpi=240)
    plt.close(fig)

    # Output C: proxy
    records = [
        compute_proxy(annual_vec, args, "Annual"),
        compute_proxy(left_vec, args, "NE Monsoon"),
        compute_proxy(right_vec, args, "SW Monsoon"),
    ]
    save_proxy_outputs(records, prefix)
    plot_proxy_chart(records, prefix)
    write_summary(records, args, prefix)

    print(f"Saved {prefix}_annual.png")
    print(f"Saved {prefix}_monsoon.png")
    print(f"Saved {prefix}_proxy.png/.csv/.json and summary")
    for rec in records:
        print(
            f"{rec['mode']}: nw_ratio={rec['nw_ratio_percent']:.2f}% "
            f"nw_count={rec['grid_count_nw']}/{rec['grid_count_total']} "
            f"mean_u={rec['mean_u_mps']:.3f} mean_v={rec['mean_v_mps']:.3f}"
        )


if __name__ == "__main__":
    main()
