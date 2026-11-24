# Sum up 24 November's world news in one image — round 2

[![make.fun](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/c/news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/ChristaNavisa/news-image-20261124/rank.svg)](https://make.fun/c/news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/ChristaNavisa/news-image-20261124/reward.svg)](https://make.fun/c/news-image-20261124)

A broadsheet for Tuesday 24 November 2026: the date in large type, then six
stories that defined the day, each with its own drawn pictogram, headline and
one-line summary. Every story was first reported on 24 November 2026
(Reuters):

1. USA / Tech — Nvidia reinstates Jensen Huang as CEO after Trump intervenes.
2. Gaza / War — Israeli airstrike kills Hamas security chief Naeem Abu Nahel.
3. Ukraine / War — Russian strike on Zaporizhzhia kills 2, wounds 22.
4. Bangladesh / Labour — garment workers clash with police over pay.
5. China / Politics — Politburo member Chen Jining under investigation.
6. Senegal / Migration — about 175 migrants feared lost after contact is
   lost with a boat that left Dakar two weeks earlier.

## How it works

`main.ts` draws the whole 1024x1024 PNG from scratch with Node's standard
library only: a raw RGBA canvas, a hand-written 5x7 bitmap font, flat
geometric pictograms, and a small PNG encoder (zlib + CRC32). No network,
no dependencies, no image assets. Two runs write byte-identical output.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024x1024, under 1 MiB).
