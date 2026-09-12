#!/usr/bin/env python3
"""Feasibility checks for using ODB GEBCO API as Kuroshio v2 topography overlay."""

from __future__ import annotations

import json
import time
from pathlib import Path

import requests

GEBCO_API = "https://api.odb.ntu.edu.tw/gebco"


def rect_poly(lon0: float, lon1: float, lat0: float, lat1: float) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [[[lon0, lat0], [lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]]],
    }


def query_polygon(poly: dict, sample: int, timeout: int = 180) -> tuple[dict, float, int]:
    t0 = time.time()
    r = requests.get(
        GEBCO_API,
        params={"mode": "zonly", "sample": sample, "jsonsrc": json.dumps(poly, separators=(",", ":"))},
        timeout=timeout,
    )
    dt = time.time() - t0
    r.raise_for_status()
    return r.json(), dt, len(r.content)


def run_case(name: str, lon0: float, lon1: float, lat0: float, lat1: float, sample: int) -> dict:
    payload, sec, nbytes = query_polygon(rect_poly(lon0, lon1, lat0, lat1), sample)
    lon = payload.get("longitude", [])
    lat = payload.get("latitude", [])
    z = payload.get("z", [])
    return {
        "name": name,
        "sample": sample,
        "points": len(z),
        "bytes": nbytes,
        "seconds": round(sec, 3),
        "equal_lengths": len(lon) == len(lat) == len(z),
        "z_min": min(z) if z else None,
        "z_max": max(z) if z else None,
    }


def tile_bounds(lon0: float, lon1: float, lat0: float, lat1: float, step: float) -> list[tuple[float, float, float, float]]:
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


def run_tiled(name: str, lon0: float, lon1: float, lat0: float, lat1: float, step: float, sample: int = 1) -> dict:
    total_points = 0
    total_bytes = 0
    total_sec = 0.0
    failed = 0
    boxes = tile_bounds(lon0, lon1, lat0, lat1, step)
    for a, b, c, d in boxes:
        try:
            payload, sec, nbytes = query_polygon(rect_poly(a, b, c, d), sample)
            total_points += len(payload.get("z", []))
            total_bytes += nbytes
            total_sec += sec
        except Exception:
            failed += 1
    return {
        "name": name,
        "sample": sample,
        "tile_step_deg": step,
        "tiles": len(boxes),
        "failed": failed,
        "total_points": total_points,
        "total_bytes": total_bytes,
        "total_seconds": round(total_sec, 3),
    }


def point_check(name: str, lon: float, lat: float) -> dict:
    r = requests.get(GEBCO_API, params={"lon": str(lon), "lat": str(lat)}, timeout=30)
    r.raise_for_status()
    d = r.json()
    z = d.get("z", [None])[0]
    return {"name": name, "lon": lon, "lat": lat, "z": z}


def feature_collection_check() -> dict:
    fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"id": "a"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[121, 22.5], [121, 23.0], [121.5, 23.0], [121.5, 22.5], [121, 22.5]]],
                },
            },
            {
                "type": "Feature",
                "properties": {"id": "b"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[122.0, 24.0], [122.0, 24.5], [122.5, 24.5], [122.5, 24.0], [122.0, 24.0]]],
                },
            },
        ],
    }
    d, sec, nbytes = query_polygon(fc, sample=5, timeout=60)
    return {
        "points": len(d.get("z", [])),
        "bytes": nbytes,
        "seconds": round(sec, 3),
        "z_min": min(d.get("z", [0])),
        "z_max": max(d.get("z", [0])),
    }


def main() -> None:
    cases = [
        run_case("example_1x1", 121, 122, 22.5, 23.5, sample=5),
        run_case("example_1x1", 121, 122, 22.5, 23.5, sample=1),
        run_case("target_2.7x4.5", 120.5, 123.2, 21.5, 26.0, sample=5),
        run_case("target_2.7x4.5", 120.5, 123.2, 21.5, 26.0, sample=2),
        run_case("target_2.7x4.5", 120.5, 123.2, 21.5, 26.0, sample=1),
    ]

    tiled = [
        run_tiled("target_tiled_2deg", 120.5, 123.2, 21.5, 26.0, step=2.0, sample=1),
        run_tiled("target_tiled_1deg", 120.5, 123.2, 21.5, 26.0, step=1.0, sample=1),
    ]

    point_semantics = [
        point_check("taiwan_land", 121.0, 24.0),
        point_check("east_ocean", 122.8, 24.0),
        point_check("lanyu", 121.56, 22.05),
    ]

    report = {
        "api": GEBCO_API,
        "cases": cases,
        "tiled": tiled,
        "point_semantics": point_semantics,
        "feature_collection": feature_collection_check(),
        "conclusion": {
            "response_schema": "longitude/latitude/z arrays with equal length",
            "z_meaning": "z > 0 above sea level; z < 0 below sea level",
            "recommended_fetch_strategy": "tile-based polygon calls (1deg or 2deg) with sample=1",
        },
    }

    out = Path("gebco_feasibility_report.json")
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote report: {out}")


if __name__ == "__main__":
    main()
