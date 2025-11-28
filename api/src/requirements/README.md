# Requirements Engineering Module

A robust, fault-tolerant requirements engineering system focused on completeness and traceability for Product Managers.

## Overview

This module provides comprehensive requirements engineering capabilities:

- **Requirements Extraction**: AI-powered extraction from documents
- **Requirements Matching**: Semantic matching to codebase components
- **Traceability**: Full traceability matrices and impact analysis
- **Completeness Tracking**: Real-time completion percentages
- **Drift Detection**: Automatic detection of requirements drift
- **Gap Analysis**: Identification and prioritization of implementation gaps
- **Compliance Reporting**: Generate compliance reports and validate coverage
- **Versioning**: Track requirements changes over time

## Features

### 1. Requirements Extraction

Extract structured requirements from documents (PRDs, tickets, etc.)

```typescript
POST /requirements/extract
{
  "documentContent": "As a user, I want to...",
  "projectId": "project-id"
}
```

**Features:**
- AI-powered extraction with retry logic
- Automatic fallback on errors
- Priority and complexity detection
- Robust error handling

### 2. Requirements Matching

Match requirements to codebase components using semantic search

```typescript
POST /requirements/match
{
  "requirementId": "req-id",
  "projectId": "project-id"
}
```

**Features:**
- Semantic similarity matching
- Multiple match types (symbol, semantic, structural)
- Confidence scoring
- Automatic embedding generation

### 3. Traceability

Generate full traceability matrices and analyze impact

```typescript
GET /requirements/traceability/matrix/:projectId
GET /requirements/traceability/requirement/:requirementId
GET /requirements/traceability/impact/:nodeId
GET /requirements/traceability/export/:projectId?format=markdown
```

**Features:**
- Full requirement → code → dependencies chain
- Impact analysis (what breaks if code changes)
- Export in multiple formats (JSON, CSV, Markdown)
- Comprehensive summaries

### 4. Completeness Tracking

Track implementation completeness with detailed metrics

```typescript
GET /requirements/project/:projectId
```

**Returns:**
- Overall completion percentage
- Per-requirement completion
- Match counts and confidence levels
- Historical tracking

### 5. Drift Detection

Detect when code changes cause requirements to no longer match

```typescript
GET /requirements/drift/:projectId
GET /requirements/drift/requirement/:requirementId
```

**Features:**
- Automatic drift detection
- Score recalculation
- Severity classification (critical, high, medium)
- Match score updates

### 6. Gap Analysis

Identify unimplemented requirements and prioritize them

```typescript
GET /requirements/gaps/:projectId
GET /requirements/gaps/:projectId/priority
GET /requirements/gaps/suggestions/:requirementId
```

**Features:**
- Automatic gap identification
- Priority-based sorting
- Implementation suggestions
- Effort estimation

### 7. Compliance Reporting

Generate compliance reports and validate coverage

```typescript
GET /requirements/compliance/report/:projectId?format=markdown
GET /requirements/compliance/validate/:projectId
```

**Features:**
- Comprehensive compliance metrics
- Multiple export formats (JSON, HTML, Markdown)
- Validation against standards
- Actionable recommendations

### 8. Versioning

Track requirements changes over time

```typescript
POST /requirements/version/:requirementId
GET /requirements/version/history/:requirementId
```

**Features:**
- Version history tracking
- Change comparison
- Audit trail

## MCP Server Integration

The module exposes an MCP server endpoint for goose integration:

```
GET /mcp/tools - List available tools
POST /mcp/tools/call - Call a tool
GET /mcp/health - Health check
```

### Available MCP Tools

1. `repolens_analyze_codebase` - Analyze repository
2. `repolens_extract_requirements` - Extract from document
3. `repolens_match_requirements` - Match to code
4. `repolens_get_traceability` - Get traceability chain
5. `repolens_check_completeness` - Check completion
6. `repolens_get_gaps` - Get implementation gaps
7. `repolens_validate_implementation` - Validate code matches requirement
8. `repolens_suggest_implementation` - Generate suggestions
9. `repolens_detect_drift` - Detect requirements drift
10. `repolens_generate_report` - Generate compliance report

## Fault Tolerance

All services implement:

- **Retry Logic**: Exponential backoff for transient failures
- **Error Handling**: Comprehensive try-catch with fallbacks
- **Transaction Safety**: Database operations use transactions
- **Validation**: Input validation before processing
- **Logging**: Detailed logging for debugging
- **Graceful Degradation**: Fallback modes when services fail

## Error Handling

Services use a consistent error handling pattern:

```typescript
try {
  // Operation with retry
  return await this.withRetry(
    () => this.operation(),
    { maxRetries: 3, exponentialBackoff: true },
    'Operation context'
  );
} catch (error) {
  // Log and return fallback
  this.logger.error('Operation failed:', error);
  return fallbackResult;
}
```

## Performance Considerations

- **Batch Operations**: Embeddings generated in parallel
- **Query Limits**: Results limited to prevent timeouts
- **Caching**: Vector IDs stored for reuse
- **Indexing**: Database indexes on frequently queried fields

## Testing

Run tests with:

```bash
npm test requirements
```

## Future Enhancements

- [ ] Real-time drift detection via webhooks
- [ ] Requirements templates library
- [ ] Team collaboration features
- [ ] Advanced prioritization algorithms
- [ ] Integration with project management tools
- [ ] Requirements approval workflows

