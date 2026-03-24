# Skill Validation Review

Target: Chang et al. 2018 Fig. 1

## What Worked

- The skill helper was sufficient to fetch and tile large-domain GEBCO data.
- The skill helper was sufficient to fetch annual upper-200 m SADCP vectors where data exist.
- The dedicated slim colorbar layout worked on a large single-panel map.

## What Was Difficult

- Japan-region SADCP coverage is sparse, so vectors remain discontinuous.
- The original figure contains many river points and model subregions that are not available as a public dataset here and had to be approximated manually.
- Large-domain GEBCO requires lower-resolution sampling; `sample=1` is not practical at this map scale.

## Skill Improvements Applied

- The skill now explicitly tells agents to leave currents blank when coverage is sparse.
- The skill now explicitly tells agents to shorten and isolate shared colorbars.
- The skill now explicitly warns that large GEBCO domains require coarser sampling.
