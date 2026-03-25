# GEBCO Colorbar Validation

This test disabled the scalar background layer and enabled `gebco.colorbar.enabled = True` in the integrated template.

Result:

- The map rendered successfully with Cartopy.
- The GEBCO bathymetry colorbar appeared even though `background.enabled = False`.
- The colorbar stayed outside the map panel and did not collide with the title or caption.

This closes the earlier skill gap where a pure GEBCO + vectors figure had no direct path to a legend.
