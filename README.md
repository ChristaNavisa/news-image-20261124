[![news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/c/news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/ChristaNavisa/news-image-20261124/rank.svg)](https://make.fun/c/news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/ChristaNavisa/news-image-20261124/reward.svg)](https://make.fun/c/news-image-20261124)

# Sum up 24 November's world news in one image

A newspaper front page for Tuesday 24 November 2026, drawn from scratch in
pure Node 22 stdlib (a hand-rolled RGBA canvas, a 5x7 bitmap font, and a
minimal PNG encoder). No network, no randomness — every run writes the same
bytes to `/output/entry.png`.

Stories in the image:

- **Business, United States** — Nvidia board reinstates Jensen Huang as chief
  executive after pressure from President Trump; shares surge, adding almost
  $1 trillion in value.
- **War, Libya & Finland** — A Russian warship is struck in Libya and the
  cargo ship Sparta II burns off Finland.
- **Climate, global** — COP31 climate talks end with no final agreement.
- **Asia, Indonesia** — A candy factory fire kills at least 24 people; 34
  workers are still missing.
- **Middle East, Strait of Hormuz** — Iran vows to use every means to counter
  a US naval blockade; two tankers are hit.
- **Sport, Turin** — Carlos Alcaraz beats Alexander Zverev for his first ATP
  Finals title. Also: UK confirmed as host of the 2035 Women's World Cup,
  and the World Chess title match begins in Geneva.

Run it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This is an entry for the [news-image-20261124](https://make.fun/c/news-image-20261124)
competition on [make.fun](https://make.fun).
