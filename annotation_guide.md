# Annotation Guide (Ground Truth)

This guide explains how to annotate requirement-to-code links in RepoLens so metrics (precision/recall/F1) are reliable and comparable across matchers.

## What You Are Annotating

- **Requirement**: a single requirement record (`Requirement`)
- **Code element**: a node/chunk/function/class (`Node`)
- **Ground truth link**: one pair of `requirementId + nodeId` (`RequirementGroundTruth`)

Ground truth is **link-level**, not requirement-level.

## Recommended Workflow

1. **Load one project** and confirm requirements are final (remove duplicates first).
2. **Run matching** (prefer `match/all-baselines`) to surface candidates.
3. For each requirement, review candidate matches and mark links as ground truth only when evidence is clear.
4. Add missing true links manually if the matcher did not propose them.
5. Repeat until each requirement is reviewed at least once.

## Annotation Rules

- Mark a link **true** only if the node directly implements or is required to fulfill the requirement.
- Avoid links that are only generic helpers unless they are essential to the behavior.
- Prefer the **most specific node** that captures implementation intent.
- If multiple nodes are all required, mark all of them.
- If no implementation exists, leave the requirement with zero GT links.

## Consistency Rules

- Use the same interpretation of "implements" across all requirements.
- Keep granularity consistent (do not mix file-level and function-level labeling arbitrarily).
- If uncertain, add a note and resolve in a second pass.
- Do not change requirement text while annotating GT links.

## Avoid Evaluation Leakage

- Do not create GT only from one matcher's top results.
- Always do a second pass to add true links that were not suggested.
- If tuning thresholds, keep validation/test split disjoint.

## Quality Checklist

Before exporting metrics, verify:

- No duplicate requirements.
- Every requirement has been reviewed.
- Obvious true links are not missing.
- GT links are technically defensible from code evidence.
- Annotation style is consistent across the project.

## Practical Tips

- Start with lower threshold candidates (e.g., 0.2-0.4) to improve recall during review.
- Use higher thresholds (e.g., 0.5+) for quick precision-focused pass.
- Re-run matching after major re-indexing before final GT pass.

## Suggested Metadata

When possible, store annotation source/notes:

- `source`: `manual`, `expert`, or `import`
- `notes`: short rationale, edge case, or uncertainty

This helps future audits and reproducibility.

