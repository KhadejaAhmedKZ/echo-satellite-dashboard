# ECHO handover Random Forest v2

Trained from the supplied notebook design and local `balanced_data.parquet` (301,752 rows). Source: https://huggingface.co/datasets/unifyair/mobility_data. The publisher describes the source as synthetic cellular-mobility data.

The supplied notebook has out-of-order execution, invalid code cells, and preprocessing fitted before the split. `train.py` fixes those issues and stores preprocessing with the forest. A user-group holdout is used instead of a random row split. Evaluation results are in `metrics.json`; the notebook's original numbers are not presented as this model's results.

The model predicts `handover_needed`, not handover success, horizon-loss time, or a specific satellite. Signal strength and SINR dominate its inputs. N2YO orbital elements do not contain these network features. The dashboard therefore demonstrates inference with marked held-out synthetic-dataset samples. POST `/api/ml/predict` accepts matching telemetry for integration; no absent feature is filled with a fabricated value.

Threshold: 0.5. Random Forest probabilities are model outputs, not calibrated certainty. Data domains, units, and known categories must match training. The notebook's heading-in-radians assumption is retained. Unknown categories are rejected. A time holdout and validation on real deployment telemetry are still needed before using predictions to control handovers.

The 60 displayed examples are balanced to demonstrate both predictions; test metrics use the entire user-held-out set. No satellite status is driven by the synthetic replay.
