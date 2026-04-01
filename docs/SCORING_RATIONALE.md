# Scoring Rationale: Calibrated Hybrid Traceability

This document explains the technical design of the RepoLens scoring system, specifically addressing why we moved beyond raw semantic search.

## 🔍 The Problem: Semantic Noise

In requirements engineering for code, raw semantic search (Bi-Encoders) often suffers from "noisy recall" at low thresholds ($\tau < 0.4$):
- **Boilerplate Interference**: Standard code structures (try-catch, loops) look identical to embedding models across different modules.
- **Centroid Drift**: Long requirements and long code blocks result in "blurry" vectors that match too many candidates.

## 🛠️ The Solution: The 70/30 Weighted model

To increase precision, we implemented a three-pillar strategy:

### 1. Context-Aware Embeddings (Enrichment)
Instead of embedding raw code snippets, we now embed a structured header:
`File Path | Symbol Name | Signature | Code`
This ensures the vector captures the **architectural role** of the code, not just its syntax.

### 2. Weighted Identity Scoring (The $\alpha, \beta, \gamma$ model)

To ensure precision, we combine three distinct signals into a final Confidence Score:
**`Score = (α * Semantic Similarity) + (β * Symbol Match) + (γ * Structural Integrity)`**

Where the current default weights are:
- **$\alpha = 0.7$ (Semantic Foundation)**: Provides the broadest recall by matching conceptual intent.
- **$\beta = 0.2$ (Symbol Identity)**: Provides a high-precision binary boost when requirement terms exactly match function or class names.
- **$\gamma = 0.1$ (Structural Neighborhood)**: Rewards candidates that are structurally linked (calls/imports) to other high-confidence matches.

### 3. Structural Pruning (The "Orphan" Filter)
Beyond the weighted score, we apply an **Orphan Penalty**.
If a node was added purely through structural expansion ($\gamma$) but lacks any incoming/outgoing `SymbolRef` links to other high-confidence candidates in the same PRD, its final score is penalized by 50%. This "prunes" semantic coincidences.

## 🚀 Impact
This calibration shifts the F1 peak from $\tau=0.3$ (noisy) to $\tau=0.6 \sim 0.7$ (precise), allowing for higher-fidelity automated traceability and drift detection.