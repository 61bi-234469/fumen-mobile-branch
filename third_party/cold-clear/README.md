# Cold Clear Corresponding Source (MPL-2.0)

This repository distributes generated artifacts in `src/lib/cold_clear_wasm/`.
Those artifacts are derived from Cold Clear source code under MPL-2.0.

Upstream source:
- Repository: `https://github.com/MinusKelvin/cold-clear`
- Commit: `279edd7c3177ff8077f6a930193397814b281f27`

Local modifications used for the distributed wasm artifacts:
- Patch: `third_party/cold-clear/patches/0002-add-hold-speculate-and-b2b-combo-feedback.patch`
  - Note: this patch supersedes `0001-export-move-score-to-wasm.patch` for current artifacts.

Distributed artifact checksums (SHA-256):
- `src/lib/cold_clear_wasm/cold_clear_wasm_api_bg.wasm`
  - `B62A4822BB7176260F4A6ADE400ABD2B1C5731823A2F8B7DFFD4E77F6F015DA6`
- `src/lib/cold_clear_wasm/cold_clear_wasm_api.js`
  - `75C2E0A31CFB1B50BCC7BB473AF706235CBEE99F05DB3ABDA3DFD7B0B4F9F944`
- `src/lib/cold_clear_wasm/cold_clear_wasm_api.d.ts`
  - `171A5313F5CB115164A0D1B35C7AAEC50D42BFD782672985431391C05484CFF4`

## Rebuild Steps

1. Clone upstream and checkout the pinned commit.
2. Apply `third_party/cold-clear/patches/0001-export-move-score-to-wasm.patch`.
3. Build from `wasm-api/`:
   - `wasm-pack build --release --target web --out-name cold_clear_wasm_api`
4. Copy generated files to `src/lib/cold_clear_wasm/`.

MPL-2.0 text is provided at `third_party/licenses/MPL-2.0.txt`.
