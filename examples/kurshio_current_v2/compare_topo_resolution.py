#!/usr/bin/env python3
"""Quick, tolerant comparison between GEBCO npz grid and Taidp500m.grd grid."""

from __future__ import annotations

import argparse
from pathlib import Path

import netCDF4
import numpy as np


def robust_step(vals: np.ndarray) -> float:
    vals = np.unique(np.asarray(vals, dtype=float))
    vals = vals[np.isfinite(vals)]
    if vals.size < 2:
        return float("nan")
    d = np.diff(np.sort(vals))
    d = d[np.isfinite(d) & (d > 0)]
    if d.size == 0:
        return float("nan")
    return float(np.median(d))


def find_coord_var(ds: netCDF4.Dataset, candidates: list[str]) -> np.ndarray | None:
    for name in candidates:
        if name in ds.variables:
            arr = np.array(ds.variables[name][:], dtype=float)
            if arr.size > 1:
                return arr
    return None


def get_grd_xy(ds: netCDF4.Dataset) -> tuple[np.ndarray, np.ndarray]:
    x = find_coord_var(ds, ["x", "lon", "longitude", "X"])
    y = find_coord_var(ds, ["y", "lat", "latitude", "Y"])
    if x is not None and y is not None:
        return x, y

    # fallback: infer x/y from first 2D variable shape and global range attrs
    var2d = None
    for v in ds.variables.values():
        if len(v.dimensions) >= 2:
            var2d = v
            break
    if var2d is None:
        raise RuntimeError("Cannot infer 2D grid variable from grd file")

    ny, nx = var2d.shape[-2], var2d.shape[-1]
    x_min = getattr(ds, "x_range", [np.nan, np.nan])[0]
    x_max = getattr(ds, "x_range", [np.nan, np.nan])[1]
    y_min = getattr(ds, "y_range", [np.nan, np.nan])[0]
    y_max = getattr(ds, "y_range", [np.nan, np.nan])[1]
    if np.isfinite(x_min) and np.isfinite(x_max) and np.isfinite(y_min) and np.isfinite(y_max):
        x = np.linspace(float(x_min), float(x_max), int(nx))
        y = np.linspace(float(y_min), float(y_max), int(ny))
        return x, y

    raise RuntimeError("Cannot determine x/y coordinates from grd file")


def summarize_grid(name: str, x: np.ndarray, y: np.ndarray) -> dict:
    dx = robust_step(x)
    dy = robust_step(y)
    nx = int(np.unique(x).size)
    ny = int(np.unique(y).size)
    return {
        "name": name,
        "nx": nx,
        "ny": ny,
        "points": nx * ny,
        "x_min": float(np.nanmin(x)),
        "x_max": float(np.nanmax(x)),
        "y_min": float(np.nanmin(y)),
        "y_max": float(np.nanmax(y)),
        "dx_deg": dx,
        "dy_deg": dy,
        "dx_m_approx": dx * 111320.0,
        "dy_m_approx": dy * 111320.0,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Compare GEBCO npz vs Taidp500m.grd resolution")
    p.add_argument(
        "--npz",
        type=Path,
        default=Path("/Users/cywhale/proj/apigate/examples/kurshio_current_v2/gebco_sample1_tile2deg.npz"),
    )
    p.add_argument(
        "--grd",
        type=Path,
        default=Path("/Users/cywhale/proj/apigate/examples/kuroshio_original/Taidp500m.grd"),
    )
    p.add_argument("--tol-ratio", type=float, default=2.5, help="Tolerance multiplier for rough similarity check")
    args = p.parse_args()

    npz = np.load(args.npz)
    gx = np.array(npz["lon"], dtype=float)
    gy = np.array(npz["lat"], dtype=float)

    with netCDF4.Dataset(args.grd) as ds:
        tx, ty = get_grd_xy(ds)

    s_gebco = summarize_grid("GEBCO npz", gx, gy)
    s_taidp = summarize_grid("Taidp500m.grd", tx, ty)

    ratio_x = s_taidp["dx_deg"] / s_gebco["dx_deg"]
    ratio_y = s_taidp["dy_deg"] / s_gebco["dy_deg"]

    print("=== Grid Summary ===")
    for s in (s_gebco, s_taidp):
        print(
            f"{s['name']}: nx={s['nx']}, ny={s['ny']}, points={s['points']}, "
            f"dx={s['dx_deg']:.8f} deg (~{s['dx_m_approx']:.1f} m), "
            f"dy={s['dy_deg']:.8f} deg (~{s['dy_m_approx']:.1f} m)"
        )
        print(
            f"  extent: lon {s['x_min']:.4f}..{s['x_max']:.4f}, "
            f"lat {s['y_min']:.4f}..{s['y_max']:.4f}"
        )

    print("\n=== Resolution Ratio (Taidp / GEBCO) ===")
    print(f"dx ratio: {ratio_x:.2f}")
    print(f"dy ratio: {ratio_y:.2f}")

    rx_ok = (1 / args.tol_ratio) <= ratio_x <= args.tol_ratio
    ry_ok = (1 / args.tol_ratio) <= ratio_y <= args.tol_ratio
    print("\n=== Tolerant Check ===")
    print(f"within tolerance (x): {rx_ok}")
    print(f"within tolerance (y): {ry_ok}")
    if rx_ok and ry_ok:
        print("Result: rough resolution level is comparable (within tolerance).")
    else:
        print("Result: resolution levels differ beyond tolerance (still may both be valid).")


if __name__ == "__main__":
    main()
