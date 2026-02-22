# Cold Clear Corresponding Source (MPL-2.0)

This repository distributes generated artifacts in `src/lib/cold_clear_wasm/`.
Those artifacts are derived from Cold Clear source code under MPL-2.0.

Upstream source:
- Repository: `https://github.com/MinusKelvin/cold-clear`
- Commit: `279edd7c3177ff8077f6a930193397814b281f27`

Local modifications used for the distributed wasm artifacts:
- Patch: `third_party/cold-clear/patches/0001-export-move-score-to-wasm.patch`

Distributed artifact checksums (SHA-256):
- `src/lib/cold_clear_wasm/cold_clear_wasm_api_bg.wasm`
  - `96DA5C7970A578FE2C05A7A79BF5B198D09D8119A67F363E46C0EE1B819CC5DB`
- `src/lib/cold_clear_wasm/cold_clear_wasm_api.js`
  - `73743008086897D5E7DA5B4139EEA92786705E8C0E07D16AD79FE23A2A385C6B`
- `src/lib/cold_clear_wasm/cold_clear_wasm_api.d.ts`
  - `4D7A7F1AEFC317D8D153953B5F9C03E53EA816A4C0010DF4369D8E523D35D923`

## Rebuild Steps

1. Clone upstream and checkout the pinned commit.
2. Apply `third_party/cold-clear/patches/0001-export-move-score-to-wasm.patch`.
3. Build from `wasm-api/`:
   - `wasm-pack build --release --target web --out-name cold_clear_wasm_api`
4. Copy generated files to `src/lib/cold_clear_wasm/`.

MPL-2.0 text is provided at `third_party/licenses/MPL-2.0.txt`.
