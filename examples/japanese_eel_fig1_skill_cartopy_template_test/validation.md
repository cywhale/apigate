# Template Cartopy Validation

This validation copied the integrated `ocean_map_template.py`, changed only the `CONFIG` block, and successfully produced a Cartopy figure with:

- GEBCO relief background
- SADCP scalar background (`speed`, 30-100 m)
- SADCP vectors (`count >= 30`)
- an external horizontal colorbar

Result:

- The figure rendered successfully.
- The colorbar remained outside the map panel.
- The title, map body, caption, and colorbar did not overlap.
- This confirms that the template itself, not only a hand-written test script, is sufficient for Cartopy-based ODB mapping in this workspace.
