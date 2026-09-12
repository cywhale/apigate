#!/usr/bin/env python3
"""Create a vertical workflow figure for slide use."""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

OUT_PNG = Path('odb_api_to_skill_workflow.png')
OUT_SVG = Path('odb_api_to_skill_workflow.svg')

BOXES = [
    ('1. Research Question', 'Start from one paper figure\nor one scientific question.', '#edf6ff', '#4f7cac'),
    ('2. ODB Open APIs', 'SADCP currents\nCTD hydrography\nMHW SST anomaly\nGEBCO bathymetry', '#eefaf5', '#2f7d60'),
    ('3. Scientific Translation', 'Choose domain, depth, time mode\ncheck coverage and count\nseparate analogy from full reproduction', '#fff8e8', '#b28704'),
    ('4. Reproducible Figure Logic', 'Grid-cell scalar maps\nvector maps\nsections and proxies\nexternal colorbar layout', '#f7efff', '#7b5ea7'),
    ('5. Verified Examples', 'Kuroshio maps\nKBC proxy\nJapanese eel Fig.1 analogues\nBasemap and Cartopy tests', '#eef3ff', '#4863a0'),
    ('6. Skill for AI Agent', 'odb-openapi-ocean-maps\nhelper scripts and template\nbackend choice\nparameter cheatsheet', '#eaf7ff', '#2374ab'),
    ('7. Prompt-Driven Figure', 'A short prompt can trigger\na reproducible ocean mapping workflow.', '#f1fbf7', '#1f8a5b'),
]


def add_box(ax, x, y, w, h, title, body, fc, ec):
    patch = FancyBboxPatch(
        (x, y), w, h,
        boxstyle='round,pad=0.012,rounding_size=0.02',
        linewidth=1.8, edgecolor=ec, facecolor=fc,
        transform=ax.transAxes,
    )
    ax.add_patch(patch)
    ax.text(x + 0.03, y + h - 0.028, title, transform=ax.transAxes, fontsize=15, fontweight='bold', va='top', ha='left', color='#16202a')
    ax.text(x + 0.03, y + h - 0.078, body, transform=ax.transAxes, fontsize=12, va='top', ha='left', color='#2b3a46', linespacing=1.45)


def add_arrow(ax, x, y0, y1):
    ax.add_patch(
        FancyArrowPatch(
            (x, y0), (x, y1), arrowstyle='-|>', mutation_scale=18,
            linewidth=1.8, color='#62727f', transform=ax.transAxes,
        )
    )


def main() -> None:
    fig = plt.figure(figsize=(8.4, 15.8), facecolor='white')
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()

    ax.text(0.08, 0.975, 'From ODB APIs to Reproducible Ocean Science Figures', transform=ax.transAxes, fontsize=20, fontweight='bold', ha='left', va='top', color='#102030')
    ax.text(0.08, 0.947, 'A compact workflow for turning public ocean data APIs into reproducible scientific graphics and an AI-agent skill.', transform=ax.transAxes, fontsize=11.5, ha='left', va='top', color='#52616d')

    x, w, h = 0.08, 0.68, 0.105
    y_positions = [0.86, 0.73, 0.60, 0.47, 0.34, 0.21, 0.08]
    arrow_x = 0.42

    prev_y = None
    for y, (title, body, fc, ec) in zip(y_positions, BOXES, strict=False):
        add_box(ax, x, y, w, h, title, body, fc, ec)
        if prev_y is not None:
            add_arrow(ax, arrow_x, prev_y - 0.008, y + h + 0.006)
        prev_y = y

    note = FancyBboxPatch((0.80, 0.30), 0.15, 0.37, boxstyle='round,pad=0.012,rounding_size=0.02', linewidth=1.4, edgecolor='#9aa7b3', facecolor='#f8fafc', transform=ax.transAxes)
    ax.add_patch(note)
    ax.text(0.875, 0.645, 'Key rule', transform=ax.transAxes, fontsize=13, fontweight='bold', ha='center', va='top', color='#23313f')
    ax.text(0.875, 0.615, 'Use public data\nhonestly.\n\nDo not claim a\nfull reproduction\nwhen the source\nfigure used model\nor private data.', transform=ax.transAxes, fontsize=11, ha='center', va='top', color='#495965', linespacing=1.4)

    fig.savefig(OUT_PNG, dpi=220, bbox_inches='tight')
    fig.savefig(OUT_SVG, bbox_inches='tight')
    print(f'Saved {OUT_PNG}')
    print(f'Saved {OUT_SVG}')


if __name__ == '__main__':
    main()
