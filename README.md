# ECHO · Orbital Operations

Vite + globe.gl + Three.js dashboard with an Express gateway, running as demo 6 of the ECHO Hub and still runnable standalone. The nine-agent sidebar reads live state from the macOS handoff backend (demo 3) through `/api/agents/status`; start that demo to see real agent telemetry. Orbital positions come from N2YO orbital elements propagated with SGP4 - orbital tracking, not proof of a network handoff. The ML panel scores held-out cellular-mobility examples, not live satellite telemetry; see `ml/MODEL_CARD.md` for full provenance.

## Run

Requires Node 22.12+.

```sh
npm ci
cp .env.example .env
# Set N2YO_API_KEY in .env for real orbital predictions.
# Alternatively set ECHO_BACKEND_URL to use your ECHO orchestrator.
npm run dev
```

Open the localhost address printed by Vite. Use `?bare` for the globe review without HUD panels. Drag to orbit, scroll to zoom, click a satellite to inspect it. Recenter returns to Abu Dhabi. Auto-orbit resumes after 12 seconds idle.

```sh
npm test
npm run build
npm start
```

The production server serves the built dashboard at http://127.0.0.1:3103. Both servers bind only to loopback by default.

## API contract to map to your existing backend

The browser polls GET `/api/satellite/status`; the gateway forwards to the same path on `ECHO_BACKEND_URL`. When ECHO_BACKEND_URL is unset, the gateway calls N2YO using a server-only N2YO_API_KEY, propagates its TLEs with satellite.js, and returns orbital prediction mode. It does not claim a confirmed serving uplink or execute handovers. The local .env contains the user-supplied key; it is ignored by Git and excluded from the source archive.

Expected JSON fields (this is a contract, not a live-data fixture):

```ts
type Satellite = {
  id?: string | number;
  name: string;
  elevation?: number; // degrees above ground-station horizon
  azimuth?: number;   // degrees clockwise from north
  range?: number;     // slant range in kilometers, NOT altitude
};
type SatelliteStatus = {
  status: 'nominal' | 'handoff-imminent' | 'handoff-in-progress' | 'handoff-complete';
  serving: Satellite | null;
  candidate: Satellite | null;
  visibleSatellites?: Satellite[]; // backend-filtered visible Starlink objects
  predictedLossAt?: string; // ISO 8601 absolute timestamp, preferred
  secondsToHorizonLoss?: number; // fallback duration measured at response
  explanation?: string;
};
```

Map different backend field names before `validate()` in `src/geometry.mjs` or in the gateway. The endpoint described in the brief does not guarantee a visible-satellite list, candidate azimuth, or candidate range. Those fields must be added upstream to render those positions truthfully. Missing HUD fields display a dash. Missing or below-horizon positions are not plotted. At most 150 objects are shown. No external image requests occur at runtime.

ENU look angles are converted to Earth-centered positions using a spherical 6371 km Earth centered on Abu Dhabi (24.4539° N, 54.3773° E). This is suitable for visualization; prediction and orchestration remain backend responsibilities. The Sun is artistically positioned for the review, not an astronomical solar ephemeris. The sky uses a local starfield texture from turban/webgl-earth plus soft, color-varied procedural star sprites on a camera-centered sphere. Sky orientation is artistic, not a time-aligned celestial chart.

## Integration into ECHO

- Copy `public/textures` into your dashboard public folder.
- Mount the DOM structure and globe initialization in a new route using the existing framework's mount/unmount lifecycle; cancel polling and animation, remove event listeners, and dispose scene resources on unmount. This standalone entry currently assumes full-page lifetime.
- Move CSS colors/font/spacing into your existing design tokens; they cannot be matched until that repository is available.
- Keep the existing same-origin satellite endpoint; the included gateway is unnecessary when ECHO already serves it.
- Never put N2YO keys in client code or a `VITE_` environment variable.

## Rendering and performance

Local Blue Marble color, night lights, terrain bump, water specularity, and a transparent cloud sphere. The custom Phong material gates night emission with the solar normal angle. The atmosphere uses globe.gl's limb glow. Star brightness and point sizes vary on a distant 3D shell. Satellite links interpolate to real elevated endpoints and pulse; candidate links are dashed. No scene recreation occurs during polls.

Day, night, and cloud maps are 2048 × 1024; topology is 2048 × 1024; water is 1600 × 800. Pixel ratio is capped at 1.5. After sustained frame rates below 48, clouds are hidden first, then pixel ratio drops to 1. `window.echoPerformance` exposes sampled FPS and quality tier for development. This is a fallback, not a 60 FPS guarantee. Profile on the actual laptop/projector. Hidden-tab throttling may lower quality until reload.

Six coordinate, schema, and orbit tests; four Python preprocessing tests; ML inference API checks; live N2YO responses; and the production build were checked. The bare globe was visually inspected in the browser without shader warnings. Actual network handoff transitions and projector frame rate still require the ECHO orchestrator and target hardware. A WebGL-capable browser is required.

## Assets

Earth maps copied from the installed `three-globe/example/img/` package. Cloud map downloaded from the official globe.gl cloud example (which credits turban/webgl-earth). Originals:
- https://github.com/vasturiano/three-globe/tree/master/example/img
- https://github.com/vasturiano/globe.gl/tree/master/example/clouds

The larger maps were resized locally to 2K. Check original imagery attribution/terms for any redistribution beyond the hackathon. Runtime imagery is entirely local.

## Live N2YO orbital mode

Discovery fetches the 16 highest-elevation visible Starlink objects every 120 seconds. TLEs are cached for six hours, and locally propagated positions update each browser poll. Previously discovered satellites continue to be tracked while above the horizon. Predictions use a 10° elevation threshold and a 30-minute look-ahead with subsecond crossing refinement. The current target remains selected until it falls below that threshold; the next recommendation is ranked by predicted elevation at the target's loss time among currently tracked satellites. This is a limited tracked subset, not a constellation-wide optimizer. Scene icons are enlarged for readability; geographic positions and altitude are unexaggerated.

Source API: https://www.n2yo.com/api/
Orbit propagation: https://github.com/shashwatak/satellite-js
Starfield asset: https://github.com/turban/webgl-earth/blob/master/images/galaxy_starfield.png

## ML from the supplied notebook

The repaired v2 pipeline, trained forest, preprocessing metadata, 60 held-out synthetic-dataset examples, and metrics are in `ml/`. It uses the notebook's 18-feature Random Forest design (300 trees, max depth 18, balanced subsample weights). Training order, preprocessing leakage, and zero-SINR handling were repaired. Metrics differ from notebook outputs because users are held out as groups and preprocessing is fitted only to training data.

Python setup (needed once; model is already trained):

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r ml/requirements.txt
npm run dev
```

`npm run dev` and `npm start` launch both the gateway and the local inference worker. The worker binds only to loopback port 3102. ML inference works offline after setup; live orbital discovery still needs N2YO connectivity.

- GET `/api/ml/status?sample=0` evaluates a held-out dataset example. The dashboard's **Next sample** button changes the input. The curated replay is balanced for demonstrating both outcomes and is not the evaluation distribution.
- POST `/api/ml/predict` accepts genuine network telemetry: `x`, `y`, `velocity`, `heading`, `signal_strength`, `sinr`, `network_load`, `hour`, `pattern_type`, `connected_cell`, `device_type`. Numeric fields must be finite, categorical fields must match training metadata, and hour must be 0–23. Missing measurements are rejected, not guessed.
- Dataset coordinates, category names, and heading conventions must match training (the notebook assumes radians). Satellite azimuth/elevation cannot substitute for network signal strength or SINR. This network-mobility model is not validated on satellite links and does not drive orbital target selection.

Retrain with:

```sh
.venv/bin/python ml/train.py /path/to/balanced_data.parquet
.venv/bin/python ml/test_features.py
```

Held-out evaluation: 238,596 training rows / 63,156 test rows; accuracy 0.9097, F1 0.8575, recall 0.9699, ROC-AUC 0.9763. These are this run's measurements, not quoted notebook scores or satellite accuracy claims.

Dataset provenance: https://huggingface.co/datasets/unifyair/mobility_data — publisher labels it synthetic telecommunications/mobility data (MIT). The ML scores measure performance on that dataset only, not measured satellite network conditions.

## Nine-agent control plane

The left panel lists Watcher, Predictor, Intent, Decision, Orchestrator, Handoff, Recovery, Troubleshooter, and Explainer. Click a row for detail. The 250 ms label is the target runtime cycle, not an assertion that nine agents are executing. It polls `/api/agents/status` without overlapping requests and backs off to 15 seconds when unavailable. The gateway forwards that route only when ECHO_BACKEND_URL is configured. Missing runtime telemetry is explicitly shown as disconnected with idle placeholders.

Response shape: `{ "agents": [{ "id": "watcher", "state": "running", "detail": "Received measurements", "durationMs": 4.25 }] }`. Agent IDs are lowercase names. Accepted states: idle, running, complete, error, waiting, disabled. This illustrative contract is not used as demo telemetry.

## Historical DONKI example

`public/data/donki-gst-example.json` contains the user-supplied 21 January 2016 GST record, with broken Markdown link formatting repaired. The weather panel shows Kp 6.0, NOAA, observation time, related event IDs, and links to two notifications. It is explicitly historical and does not change orbital or agent states. No live NASA feed or NASA API key is configured. To add a live feed later, fetch GST server-side with NASA_API_KEY, cache conservatively, show observation age and stale/error states, and never interpret lack of records as guaranteed quiet conditions.

## Cinematic/global update

The mission-control layout now includes nine agent roles with expandable detail and a disconnected indicator until actual ECHO agent telemetry is available. The supplied 2016 DONKI record is a historical context card, never a live alert.

Global constellation mode is the default. It uses 3,703 complete TLE records retained from an interrupted CelesTrak download on 21 September 2026, stored in `server/cache/`. This is explicitly a PARTIAL global catalog, not all Starlink objects. The endpoint propagates these real elements to the current time using SGP4; snapshots refresh every 15 seconds in the browser. Lightweight GPU points render worldwide positions; the detailed local target/candidate models remain visible. Select Abu Dhabi links to hide the global layer. The server attempts catalog refresh after four hours; failed refreshes retain and flag the cached catalog. API failure does not manufacture positions.

Cinema mode hides mission panels and expands the globe; Escape or Show mission panels restores them. Earth view and Orbital close-up animate the camera. Satellite models have metallic bodies, solar panels and soft glows, with exaggerated model size for visibility but data-derived position and altitude. Earth lighting uses filmic tone mapping and a thin atmosphere. No decorative orbit paths are presented as real trajectories.

Relevant files: `src/agents.js`, `src/weather.js`, `src/constellation.js`, `src/cinematic.js`, `server/constellation.mjs`. The gateway now uses port 3103; ML remains on 3102 and Vite on 5174.
