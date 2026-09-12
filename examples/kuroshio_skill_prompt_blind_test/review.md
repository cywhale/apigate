# Blind Test Review

Prompt used:

`Use the odb-openapi-ocean-maps skill to draw a current map from ODB SADCP API for the Kuroshio east of Taiwan. Two subplots: Upper is gridded distribution of current; Lower is current vector map`

## Review Result

Approved with the following interpretation choices:

- Upper panel: annual (`mode=0`) gridded scalar speed for `20-300 m`
- Lower panel: annual (`mode=0`) vector map for `30-100 m`
- Backend: Basemap, chosen as the stable default backend in the skill

## Why this counts as a successful blind test

- The upper panel uses gridded 0.25 degree cell filling rather than overlapping circles.
- The lower panel uses vectors only and does not duplicate scalar speed encoding.
- The colorbar is external and does not overlap the map body.
- The two panels are visually distinct and scientifically interpretable.

## Residual Prompt Ambiguity

The original prompt did not specify:

- annual versus monsoon mode
- scalar depth range
- vector depth range
- whether GEBCO context should be included

The script therefore chose conservative defaults from prior skill guidance and existing examples.
