# Product Requirements Document: json-server

## 1. Executive Summary
json-server is a zero-coding tool for creating mock REST APIs from a JSON source.

## 2. Problem Statement & Goals
Rapid frontend dev without waiting for backend readiness.

## 3. Scope & Key Features
- **Zero-Coding**: Instant API from JSON.
- **REST support**: Full HTTP method handling.
- **Search & Sort**: Query-based manipulation.
- **Persistence**: Writes changes back to file.

## 4. User Personas
- **Frontend Engineers**: Mocking backends.
- **Mobile Developers**: Rapid API prototyping.

## 5. Functional Requirements
- **FR-1**: Expose a RESTful API with full CRUD support from a JSON file.
- **FR-2**: Support filtering data using query parameters (e.g. `?id=123`).
- **FR-3**: Support pagination with `_page` and `_limit` parameters.
- **FR-4**: Support sorting with `_sort` and `_order` parameters.
- **FR-5**: Support full-text search across all fields using `?q=query`.
- **FR-6**: Support slicing/range queries using `_start` and `_end`.
- **FR-7**: Support relationship mapping (e.g. `/posts/1/comments`).
- **FR-8**: Support data persistence (automatically write back to `db.json`).
- **FR-9**: Support custom routing for non-standard path mappings.
- **FR-10**: Support custom middlewares for custom behavior (e.g. auth mock).
- **FR-11**: Handle CORS (Cross-Origin Resource Sharing) headers for dev use.
- **FR-12**: Support custom ID generation for new objects.
- **FR-13**: Support nested data structures in the JSON source.
- **FR-14**: Support watching the JSON file for manual edits and reloading.
- **FR-15**: Provide a CLI for easy installation and startup.

## 6. Non-Functional Requirements
- **NFR-1 (Usability)**: Baseline setup must take less than 60 seconds.
- **NFR-2 (Maintainability)**: Codebase should be approachable for open-source contributors.
- **NFR-3 (Consistency)**: Ensure file I/O doesn't corrupt the source JSON on error.
- **NFR-4 (Documentation)**: Provide 100% feature coverage in the README.
- **NFR-5 (Lightweight)**: Minimal footprint on the development machine.

## 7. Technology Stack
- **Language**: JavaScript
- **Engine**: Node.js
- **Server**: Express
