# Product Requirements Document: MiniSearch

## 1. Executive Summary
MiniSearch is a tiny but powerful full-text search library for JavaScript.

## 2. Problem Statement & Goals
Client-side search for small-to-medium datasets without external servers.

## 3. Scope & Key Features
- **In-Memory Index**: Fast client-side retrieval.
- **Fuzzy Search**: Handling spelling errors.
- **Boosting**: Importance-based field weighting.
- **Zero-Dep**: 100% self-contained library.

## 4. User Personas
- **Web Developers**: Building documentation or blog search.
- **SPA Developers**: Needing lightning-fast local search.

## 5. Functional Requirements
- **FR-1**: Add many documents to the index at once.
- **FR-2**: Remove specific documents from the index via ID.
- **FR-3**: Update existing documents in the index.
- **FR-4**: Search across multiple fields with configurable field weights (boosting).
- **FR-5**: Support fuzzy matching with configurable Edit Distance (Levenshtein).
- **FR-6**: Support prefix matching for auto-completion features.
- **FR-7**: Support custom tokenization (including splitting by non-whitespace).
- **FR-8**: Support custom term stemming (optional plugin or integration point).
- **FR-9**: Support filtering results via an external filter function.
- **FR-10**: Support term-level boolean logic (AND/OR).
- **FR-11**: Provide rank scores for each search result.
- **FR-12**: Support for persistent indices (serialization to JSON).
- **FR-13**: Support for custom normalization rules (ignore case, etc.).
- **FR-14**: Support field-specific search (searching only within `title`).
- **FR-15**: Support custom aggregation/grouping of search results.

## 6. Non-Functional Requirements
- **NFR-1 (Bundle Size)**: Keep the library gzipped size under 5KB.
- **NFR-2 (Speed)**: Search must complete in under 50ms for 10,000 documents.
- **NFR-3 (Maintainability)**: Full code coverage for the search engine core.
- **NFR-4 (Simplicity)**: API should be clear enough that the README alone suffices.
- **NFR-5 (Interop)**: Run perfectly in Browsers (ESM) and Node.js (CJS).

## 7. Technology Stack
- **Language**: JavaScript/TypeScript
- **Platform**: Modern Browsers / Node.js
