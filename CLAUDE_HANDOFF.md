# ECHO dashboard — handoff to Claude

Continue this existing implementation. Inspect the files before making changes. Preserve the local photoreal Earth textures, globe.gl renderer, working N2YO integration, and trained ML service. Do not replace it with a static mockup.

## Project purpose

ECHO is edge compute handoff orchestration. This dashboard is for a live hackathon projector demo: an interactive Earth, visible Starlink satellites over Abu Dhabi (24.4539 N, 54.3773 E), tracking target, next recommendation, horizon-loss countdown, clear status, and plain-language explanation. Original requested integration was a new route inside ECHO's existing dashboard, sharing its framework and tokens. That repository was never supplied, so this implementation is standalone and still needs integration into the actual app.

## Included files

- `src/main.js`: globe, clouds, lighting, night-emission shader, satellite geometry/selection, arcs, HUD, polling, countdown, quality fallback.
- `src/space.js`: local sky texture on a camera-centered sphere and soft star sprites.
- `src/style.css`: dark cyan/amber mission-control panels and responsive layout.
- `src/geometry.mjs`: fallback conversion from station look angles and range to globe position.
- `src/ml.js`: ML panel with explicitly labeled synthetic-dataset examples and Next sample control.
- `server/index.mjs`: Express API and production static-file server.
- `server/tracking.mjs`: N2YO discovery/TLE cache, satellite.js SGP4 propagation, horizon prediction, tracking-target selection.
- `server/start.mjs`: starts the optional Python model worker alongside the gateway.
- `ml/model.joblib`: trained Random Forest v2 plus its preprocessing metadata. Locally trained from the supplied notebook's design.
- `ml/train.py`, `features.py`, `service.py`, `test_features.py`: reproducible training, preprocessing, inference, and tests.
- `ml/replay.json`: 60 selected held-out examples from the synthetic source dataset.
- `ml/metrics.json`, `MODEL_CARD.md`: measured evaluation and limitations.
- `public/textures/`: local Earth day, night, terrain, water, clouds, and sky imagery.
- `README.md`: setup, API contracts, data provenance, integration instructions.
- `package-lock.json` and `ml/requirements.txt`: dependency versions.

## Run from the extracted folder

Requires Node 22.12+ and Python 3.10+.

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r ml/requirements.txt
cp .env.example .env
# Add N2YO_API_KEY to .env. The credential is intentionally not included.
npm run dev
```

Open the Vite URL printed in the terminal. The original machine used port 5174 because 5173 was occupied. Gateway defaults to 3103; ML worker defaults to 3102. Vite's proxy points at 3103. Keep these consistent if changing ports. Services bind to 127.0.0.1.

```sh
npm test
.venv/bin/python ml/test_features.py
npm run build
npm start
```

Production runs at http://127.0.0.1:3103. The trained model is included, so retraining and downloading the full dataset are unnecessary for inference. N2YO requires network access; textures and trained-model inference are local. On Windows, set ECHO_PYTHON to the venv Python executable; the startup script's default path assumes macOS/Linux.

## What works now

1. Earth day/night rendering, terrain bump, ocean specular map, transparent clouds, atmosphere, soft stars, orbit/zoom controls, recenter, idle rotation, and `?bare` review mode.
2. GET `/api/satellite/status`: either forwards to ECHO_BACKEND_URL or runs the N2YO orbital predictor if that variable is unset.
3. Real N2YO orbital-element responses were verified. Satellite positions, elevation, azimuth, and range are calculated by SGP4. The frontend updates incrementally.
4. A 10-degree elevation-loss countdown and next-satellite recommendation among tracked objects. Discovery selects the 16 highest visible objects per refresh every 120 seconds; cached objects can remain visible, so the plotted count can exceed 16. TLE cache lifetime is six hours. At most 150 objects are rendered.
5. ML inference works through GET `/api/ml/status?sample=0` and POST `/api/ml/predict`. Next sample was tested in the UI and changes probability/decision.
6. Six JavaScript tests, four Python tests, model API checks, and a production build passed. Browser render checks showed no shader errors. Projector FPS has not been certified.

## Critical truthfulness constraints

- N2YO is orbital tracking, not proof that a device is connected to a satellite. The main panel says tracking target, not confirmed serving uplink, in prediction mode.
- No real network handoff is executed here. Do not claim handoff-in-progress/complete unless the real ECHO orchestrator reports it.
- The explainer in N2YO mode is deterministic text derived from orbital calculations, not a connected LLM Explainer agent.
- The ML source dataset is **synthetic cellular-mobility data**, not measured satellite telemetry. Source: https://huggingface.co/datasets/unifyair/mobility_data . Keep that visible in the UI.
- The notebook predicts `handover_needed`. It does not predict horizon-loss time or select a satellite. The current ML panel is separate from orbital decisions.
- Live N2YO data does not contain signal strength, SINR, network load, device categories, or the other required network features. Never invent those values or silently replace them with elevation/range.
- POST `/api/ml/predict` is an inference integration point. Live network telemetry is not currently wired from ECHO into the UI/model. Missing or unknown inputs are rejected.
- API keys must remain server-side in ignored `.env` files, never browser code, logs, screenshots, archives, or commits.

## ML details

The supplied `ECHO_handover_predictor.ipynb` had out-of-order cells, invalid cells, and preprocessing before the split. This version repairs those issues and trains the v2 design: 300 Random Forest trees, depth 18, minimum leaf size 2, balanced_subsample weights. User-group holdout prevents rows for the same user from appearing in both train and test sets. Preprocessing is fitted only on training rows. Zero SINR is handled without infinities. The notebook's heading-in-radians assumption is retained.

Inputs: x, y, velocity, heading, signal_strength, sinr, network_load, hour, pattern_type, connected_cell, device_type. Derived features include cyclic hour, velocity components, distance to training cell centers, signal/SINR ratio, and load×velocity. RF does not use the notebook's logistic-regression scaler.

Measured results for this trained artifact:
- Training rows: 238,596; held-out rows: 63,156.
- Accuracy: 0.909747; F1: 0.857536; recall: 0.969867; ROC-AUC: 0.976325.
- These are synthetic-dataset scores, not satellite performance claims.
- Probabilities use threshold 0.5 and are not calibrated certainty.
- The 60 demonstration samples are deliberately balanced; the evaluation metrics use the full held-out set.

The full training parquet and original notebook are not included in this archive. On the original machine they were at `/Users/5ddoua/Downloads/echo-datasets/unifyair-mobility/balanced_data.parquet` and `/Users/5ddoua/Downloads/ECHO_handover_predictor.ipynb`. Do not assume these paths exist on another machine. Training scripts and the trained model are included.

## Remaining work / integration priorities

1. Obtain the actual ECHO repository, inspect its backend/dashboard, and port this into its framework and tokens. Add lifecycle cleanup for polling, animation, event listeners, and GPU resources when making it a mounted route/component.
2. Map the real ECHO API to the documented frontend schema, retaining real orchestration status and agent explanation. The original brief did not guarantee candidate azimuth/range or a visible-satellite list; add those upstream when needed.
3. Wire genuine network measurements into ML only when their units, categories, and domain match training. Validate/retrain on actual deployment data before using ML to control handoffs.
4. Profile on the actual laptop/projector. Current fallback hides clouds first, then reduces pixel ratio. No blanket 60 FPS guarantee. `window.echoPerformance` exposes a sampled rate/quality tier.
5. Review target-selection policy and stale-cache behavior for production. The tracker uses a subset, a 10-degree threshold, and a 30-minute horizon; it is not a full constellation optimizer. A process restart clears the in-memory N2YO cache and causes fresh requests.
6. Keep satellite icons distinguishable from stars. Icons are enlarged for readability, but their position/altitude is not exaggerated. Sun and sky orientation are artistic rather than astronomical ephemerides.
7. Improve small-screen panel arrangement as needed. Projector/desktop is the primary use case. Production bundling succeeds with a large-chunk warning from the 3D dependencies.

Preserve the user's priorities: photorealism, local reliable imagery, smooth interaction, honest live data, readable statuses/explanations, and no mock values presented as actual telemetry.

## Cinematic/global update

The mission-control layout now includes nine agent roles with expandable detail and a disconnected indicator until actual ECHO agent telemetry is available. The supplied 2016 DONKI record is a historical context card, never a live alert.

Global constellation mode is the default. It uses 3,703 complete TLE records retained from an interrupted CelesTrak download on 21 September 2026, stored in `server/cache/`. This is explicitly a PARTIAL global catalog, not all Starlink objects. The endpoint propagates these real elements to the current time using SGP4; snapshots refresh every 15 seconds in the browser. Lightweight GPU points render worldwide positions; the detailed local target/candidate models remain visible. Select Abu Dhabi links to hide the global layer. The server attempts catalog refresh after four hours; failed refreshes retain and flag the cached catalog. API failure does not manufacture positions.

Cinema mode hides mission panels and expands the globe; Escape or Show mission panels restores them. Earth view and Orbital close-up animate the camera. Satellite models have metallic bodies, solar panels and soft glows, with exaggerated model size for visibility but data-derived position and altitude. Earth lighting uses filmic tone mapping and a thin atmosphere. No decorative orbit paths are presented as real trajectories.

Relevant files: `src/agents.js`, `src/weather.js`, `src/constellation.js`, `src/cinematic.js`, `server/constellation.mjs`. The gateway now uses port 3103; ML remains on 3102 and Vite on 5174.
