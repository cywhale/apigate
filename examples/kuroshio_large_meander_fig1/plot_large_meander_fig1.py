#!/usr/bin/env python3
"""Fig.1-style explanatory figure for the Kuroshio Large Meander using ODB MHW API."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import requests
from mpl_toolkits.basemap import Basemap

MHW_API = "https://eco.odb.ntu.edu.tw/api/mhw"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Kuroshio large meander Fig.1-style explanatory figure")
    p.add_argument("--lon0", type=float, default=134.0)
    p.add_argument("--lon1", type=float, default=141.5)
    p.add_argument("--lat0", type=float, default=30.0)
    p.add_argument("--lat1", type=float, default=35.5)
    p.add_argument("--date-left", type=str, default="2017-07-01")
    p.add_argument("--date-right", type=str, default="2017-08-01")
    p.add_argument("--point-lon", type=float, default=139.875)
    p.add_argument("--point-lat", type=float, default=33.125)
    p.add_argument("--ts-start", type=str, default="2016-01-01")
    p.add_argument("--ts-end", type=str, default="2018-12-01")
    p.add_argument("--output", type=str, default="kuroshio_large_meander_fig1_like.png")
    p.add_argument("--timeout", type=int, default=90)
    return p.parse_args()


def fetch_mhw(params: dict, timeout: int) -> list[dict]:
    r = requests.get(MHW_API, params=params, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        raise RuntimeError("MHW API response is not a list")
    return data


def build_map(ax: plt.Axes, lon0, lon1, lat0, lat1) -> Basemap:
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
    m.drawmapboundary(fill_color="#f8fbff")
    m.fillcontinents(color="#cfcfcf", lake_color="#f8fbff", zorder=3)
    m.drawcoastlines(linewidth=0.75, color="0.2", zorder=4)
    m.drawparallels(np.arange(math.floor(lat0), math.ceil(lat1) + 0.001, 1.0), labels=[1, 0, 0, 0], linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    m.drawmeridians(np.arange(math.floor(lon0), math.ceil(lon1) + 0.001, 1.0), labels=[0, 0, 0, 0], linewidth=0.22, dashes=[1, 0], fontsize=9, color="0.4", zorder=2)
    return m


def grid_from_rows(rows: list[dict], value_key: str):
    lon = np.array(sorted({float(r["lon"]) for r in rows if r.get("lon") is not None}), dtype=float)
    lat = np.array(sorted({float(r["lat"]) for r in rows if r.get("lat") is not None}), dtype=float)
    grid = np.full((lat.size, lon.size), np.nan, dtype=float)
    xi = {v: i for i, v in enumerate(lon)}
    yi = {v: i for i, v in enumerate(lat)}
    for r in rows:
        if r.get("lon") is None or r.get("lat") is None or r.get(value_key) is None:
            continue
        grid[yi[float(r["lat"])], xi[float(r["lon"])]] = float(r[value_key])
    return lon, lat, grid


def monthly_point_series(args: argparse.Namespace) -> list[dict]:
    return fetch_mhw(
        {
            "lon0": args.point_lon,
            "lat0": args.point_lat,
            "start": args.ts_start,
            "end": args.ts_end,
            "append": "sst,sst_anomaly,level",
        },
        args.timeout,
    )


def main() -> None:
    args = parse_args()
    left = fetch_mhw(
        {"lon0": args.lon0, "lon1": args.lon1, "lat0": args.lat0, "lat1": args.lat1, "start": args.date_left, "end": args.date_left, "append": "sst,sst_anomaly,level"},
        args.timeout,
    )
    right = fetch_mhw(
        {"lon0": args.lon0, "lon1": args.lon1, "lat0": args.lat0, "lat1": args.lat1, "start": args.date_right, "end": args.date_right, "append": "sst,sst_anomaly,level"},
        args.timeout,
    )
    ts = monthly_point_series(args)

    lon_l, lat_l, anom_l = grid_from_rows(left, "sst_anomaly")
    lon_r, lat_r, anom_r = grid_from_rows(right, "sst_anomaly")

    fig = plt.figure(figsize=(13.6, 10.0))
    gs = fig.add_gridspec(2, 2, height_ratios=[1.0, 0.52], hspace=0.30, wspace=0.12)

    vlim = max(float(np.nanmax(np.abs(anom_l))), float(np.nanmax(np.abs(anom_r))), 1.0)
    point_xy = None

    for ax, lon, lat, grid, title in [
        (fig.add_subplot(gs[0, 0]), lon_l, lat_l, anom_l, f"SST Anomaly {args.date_left[:7]}"),
        (fig.add_subplot(gs[0, 1]), lon_r, lat_r, anom_r, f"SST Anomaly {args.date_right[:7]}"),
    ]:
        m = build_map(ax, args.lon0, args.lon1, args.lat0, args.lat1)
        xx, yy = np.meshgrid(lon, lat)
        pcm = m.pcolormesh(xx, yy, grid, latlon=True, cmap="RdBu_r", vmin=-vlim, vmax=vlim, zorder=1, shading="auto")
        cs = m.contour(xx, yy, grid, latlon=True, colors="black", linewidths=0.55, levels=np.arange(-vlim, vlim + 0.001, 0.5), zorder=2)
        ax.clabel(cs, inline=True, fontsize=7, fmt="%.1f")
        px, py = m(args.point_lon, args.point_lat)
        point_xy = (px, py)
        m.scatter([px], [py], s=28, color="yellow", edgecolor="black", zorder=5)
        ax.text(px + 18000, py + 18000, "Cool-pool point", fontsize=8, color="black", zorder=6)
        ax.set_title(title, fontsize=13, pad=6)

    cbar = fig.colorbar(pcm, ax=fig.axes[:2], orientation="horizontal", pad=0.04, fraction=0.035, shrink=0.42)
    cbar.set_label("SST anomaly (°C)", fontsize=9)
    cbar.ax.tick_params(labelsize=9)

    ax_ts = fig.add_subplot(gs[1, :])
    dates = [r["date"] for r in ts]
    anom = [float(r["sst_anomaly"]) for r in ts]
    ax_ts.plot(dates, anom, color="#1f78b4", linewidth=1.6)
    ax_ts.axhline(0.0, color="0.4", linewidth=0.8)
    ax_ts.axvline(args.date_left, color="#d95f02", linewidth=1.0, linestyle="--")
    ax_ts.axvline(args.date_right, color="#7570b3", linewidth=1.0, linestyle="--")
    ax_ts.set_ylabel("SST anomaly (°C)", fontsize=10)
    ax_ts.set_title(f"Monthly SST anomaly at {args.point_lon:.3f}°E, {args.point_lat:.3f}°N", fontsize=12)
    ax_ts.tick_params(axis="x", labelrotation=45, labelsize=8)
    ax_ts.tick_params(axis="y", labelsize=9)
    ax_ts.grid(axis="y", linewidth=0.3, alpha=0.4)

    fig.suptitle("Kuroshio Large Meander Fig.1-Style Explanatory Figure", fontsize=15, y=0.98)
    fig.text(
        0.5,
        0.02,
        "This figure is an explanatory analogue based on public MHW SST anomaly fields. It highlights the cool anomaly south of Japan during the 2017 large-meander period, not the full ocean-atmosphere mechanism of the original study.",
        ha="center",
        fontsize=9,
    )
    fig.savefig(args.output, dpi=240, bbox_inches="tight")

    Path("kuroshio_large_meander_fig1_summary.md").write_text(
        "\n".join(
            [
                "# Kuroshio Large Meander Fig.1-Style Summary",
                "",
                f"- left map: {args.date_left}",
                f"- right map: {args.date_right}",
                f"- point series: {args.point_lon} E, {args.point_lat} N",
                "",
                "Feasibility is confirmed with the ODB MHW API.",
                "Public monthly SST anomaly fields are sufficient for a figure-level science-communication analogue of the cool-water-pool pattern associated with the large-meander period.",
                "Public SADCP coverage was not reliable in this Japan-domain test region, so this implementation focuses on the SST-anomaly explanatory role instead of current vectors.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Saved figure: {args.output}")
    print(f"Left rows: {len(left)}")
    print(f"Right rows: {len(right)}")
    print(f"Point time-series rows: {len(ts)}")


if __name__ == "__main__":
    main()
