# Product Requirements Document: Mitt

## 1. Executive Summary
Mitt is a tiny 200-byte functional event emitter/pubsub.

## 2. Problem Statement & Goals
Minimalist communication logic without library bloat.

## 3. Scope & Key Features
- **Ultra-Tiny**: Minimal footprint (200 bytes).
- **Simple API**: `on`, `off`, `emit`.
- **Wildcard**: Cross-event listening.
- **Performance**: Zero overhead.

## 4. User Personas
- **Library Authors**: Event emitters for shared components.
- **Frontend Engineers**: Micro-communication between UI elements.

## 5. Functional Requirements
- **FR-1**: Register an event handler for a specific event name.
- **FR-2**: Unregister a specific event handler.
- **FR-3**: Emit an event by name to all registered handlers.
- **FR-4**: Pass any data type (object, string, array) from `emit` to handlers.
- **FR-5**: Listen to *all* events using the wildcard `*`.
- **FR-6**: Support unregistering all handlers for a specific event.
- **FR-7**: Support chaining common operations (if applicable to API design).
- **FR-8**: Correctly handle handler execution even if handler throws.
- **FR-9**: Ensure handlers are only called once per emission.
- **FR-10**: Support event names as strings or symbols.
- **FR-11**: Support clearing all events and handlers (resetting).
- **FR-12**: Provide a map-based storage for events internally.
- **FR-13**: Allow for multiple handlers per identical event name.
- **FR-14**: Ensure handlers are called in registration order.
- **FR-15**: Provide a TypeScript definition for full type-safety.

## 6. Non-Functional Requirements
- **NFR-1 (Extreme Size)**: Target less than 250 bytes minified.
- **NFR-2 (Compatibility)**: Support both ESM and CJS modules.
- **NFR-3 (Performance)**: Emission overhead must be near-zero.
- **NFR-4 (Stability)**: No changes to the core API for longevity.
- **NFR-5 (Ease of Integration)**: Zero dependencies, zero configuration.

## 7. Technology Stack
- **Language**: JavaScript
- **Modules**: ESM / CJS / UMD
