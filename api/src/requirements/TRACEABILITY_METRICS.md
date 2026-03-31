# Traceability Metrics (Precision, Recall, F1, Coverage)

## Overview

- **G** = ground truth links (expert-annotated): `(requirement_id, node_id)` in `RequirementGroundTruth`.
- **P(τ)** = predicted links at threshold τ: `RequirementMatch` with `matchScore >= τ`.
- **TP** = |P ∩ G|, **FP** = |P \ G|, **FN** = |G \ P|.
- **Precision** = TP/(TP+FP), **Recall** = TP/(TP+FN), **F1** = 2·TP/(2·TP+FP+FN).
- **Coverage** = (requirements with ≥1 predicted link) / (total requirements).
- **Optimal τ** = argmax over thresholds of F1(τ).

## API (for UI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/requirements/metrics/:projectId` | Metrics at default thresholds + optimal τ. Query `?thresholds=0.1,0.3,0.5` to override. |
| GET | `/api/requirements/metrics/:projectId/at?threshold=0.5` | Metrics at a single threshold. |
| GET | `/api/requirements/metrics/compare/:projectId?threshold=0.3` | Compare all baselines at a **fixed** τ (e.g. 0.3). Omit `threshold` for stored Tune test runs. |
| GET | `/api/requirements/ground-truth/:projectId` | List all ground truth links. |
| POST | `/api/requirements/ground-truth/:projectId` | Add one link. Body: `{ requirementId, nodeId, source?, notes? }`. |
| POST | `/api/requirements/ground-truth/:projectId/bulk` | Bulk add. Body: `{ links: [{ requirementId, nodeId, source?, notes? }] }`. |
| DELETE | `/api/requirements/ground-truth?requirementId=...&nodeId=...` | Remove one link. |

## Response shape: `GET /api/requirements/metrics/:projectId`

```json
{
  "projectId": "uuid",
  "thresholds": [0.1, 0.2, ...],
  "atThreshold": {
    "0.5": {
      "threshold": 0.5,
      "tp": 10,
      "fp": 2,
      "fn": 3,
      "tn": null,
      "precision": 0.8333,
      "recall": 0.7692,
      "f1": 0.8,
      "coverage": 0.9,
      "totalRequirements": 20,
      "linkedRequirements": 18,
      "predictedLinksCount": 12,
      "groundTruthLinksCount": 13
    }
  },
  "optimalThreshold": 0.5,
  "optimalF1": 0.8,
  "summary": {
    "totalRequirements": 20,
    "totalCodeElements": 150,
    "groundTruthLinksCount": 13,
    "requirementsWithGroundTruth": 12
  }
}
```

## UI workflow (at a glance)

1. **Run matching**  
   `POST /api/requirements/match/all` with `{ projectId, matcherType? }` populates `RequirementMatch` for **one** matcher (default `hybrid`).  
   **Why are other baselines 0.0?** Predictions are stored per matcher. If you only ran match/all with default, only hybrid has rows — so metrics for tfidf/embedding/structural-only are 0.  
   Use `POST /api/requirements/match/all-baselines` with `{ projectId }` to run all four matchers so each has stored predictions.

2. **Record ground truth**  
   For each requirement–code pair that is truly correct, add a ground truth link:
   - `POST /api/requirements/ground-truth/:projectId` with `{ requirementId, nodeId }`, or
   - `POST .../bulk` with `{ links: [...] }`.  
   Optionally set `source: "expert"` and `notes`.

3. **Get metrics**  
   `GET /api/requirements/metrics/:projectId` to get TP/FP/FN, Precision, Recall, F1, Coverage per threshold and optimal τ.

4. **Tune threshold**  
   Use `optimalThreshold` or compare `atThreshold` to choose τ (e.g. for reporting or for “predicted = matchScore >= τ”).

5. **Remove bad ground truth**  
   `DELETE /api/requirements/ground-truth?requirementId=...&nodeId=...` to drop a single link.

## Accuracy and high F1

- **Is the system accurate?**  
  We report **link-level** Precision, Recall, and F1: P(τ) comes only from stored predictions (`RequirementMatch`, matcher + score); G comes only from `RequirementGroundTruth`. Matchers never read GT; they only use requirements text and project code. So the numbers reflect how well predicted links agree with your annotated links at the chosen threshold.

- **Why can hybrid F1 be so high?**  
  (1) **More signals** — Hybrid combines embedding similarity, symbol/text overlap, and graph propagation, so it often predicts more of the same links as GT.  
  (2) **Small or easy GT** — With few links or very similar requirement/code wording, high F1 is easier to achieve.  
  (3) **GT from matcher suggestions** — If most GT was created by “Mark as ground truth” on links a matcher already suggested, GT is a subset of that matcher’s output, which can inflate that matcher’s F1 (evaluation circularity). For a stricter check, add GT links that were **not** suggested by the matcher you are evaluating.  
  The service logs a warning when test F1 > 0.95 to flag possible overfitting or circularity.

- **How we handle the data**  
  - **G**: all links in `RequirementGroundTruth` for the project (or a provided subset for validation/test).  
  - **P(τ)**: from `RequirementMatch` for the chosen matcher, `matchScore >= τ`; no filtering by GT.  
  - **Split**: for tuning, GT links are split 70% validation / 30% test (by link, deterministic seed 42). Optimal τ is chosen on **validation** F1; **test** is evaluated once at that τ.  
  - **Code scope**: matchers and metrics use the same “project code” — repos linked to the project via `Project.repositories` → `Repo` by url; code element count and predictions are over that same set.

## Migration

Run:

```bash
npx prisma migrate deploy
```

This applies the `RequirementGroundTruth` table. No change to `RequirementMatch`; predictions stay as-is and are interpreted at different τ via `matchScore >= τ`.
