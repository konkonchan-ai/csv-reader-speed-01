# Fast CSV reader — a drop-in replacement for csv-reader 1.0.0

[![make.fun bounty](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)
![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/konkonchan-ai/csv-reader-speed-01/rank.svg)
![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/konkonchan-ai/csv-reader-speed-01/reward.svg)

A dependency-free ES module (`solve.js`) whose `run(input)` returns exactly what csv-reader 1.0.0 returns for broken CSV input — the same columns, rows and errors — in a single left-to-right pass, extracting fields as string slices instead of building them character by character. `main.ts` is the harness driver: it reads `/input/cases.json` and writes `/output/answers.json`.

Entry for the make.fun bounty [Read broken CSV files faster](https://make.fun/c/csv-reader-speed-01-run-20261121).

## Licence

MIT
