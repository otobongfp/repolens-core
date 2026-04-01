# Product Requirements Document: Caddy

## 1. Executive Summary
Caddy is an extensible, open-source web server with automatic HTTPS.

## 2. Problem Statement & Goals
Automating HTTPS and simplifying server configuration.

## 3. Scope & Key Features
- **Automatic HTTPS**: Full cert management.
- **Caddyfile**: Simple config language.
- **Dynamic API**: JSON-based configuration.
- **Modern Protocols**: HTTP/3 and TLS 1.3.

## 4. User Personas
- **Web Developers**: Quick deployment.
- **Site Reliability Engineers**: Managed server infrastructure.

## 5. Functional Requirements
- **FR-1**: Automatic SSL/TLS certificate enrollment via Let's Encrypt.
- **FR-2**: Reverse proxy with load balancing and active health checks.
- **FR-3**: Static file serving for modern web applications.
- **FR-4**: FastCGI support (e.g., for PHP applications).
- **FR-5**: Template support for generating dynamic content from static files.
- **FR-6**: Redirection and rewriting rules for incoming requests.
- **FR-7**: Support for multiple configuration adapters (Caddyfile, JSON).
- **FR-8**: Dynamic configuration updates via the admin API.
- **FR-9**: Built-in metrics for Prometheus monitoring.
- **FR-10**: Support for virtual hosting (SNI).
- **FR-11**: HTTP/3 support (QUIC) natively.
- **FR-12**: Advanced logging (structured JSON logs) with filtering.

## 6. Non-Functional Requirements
- **NFR-1 (Security)**: Secure-by-default (Automatic HTTPS).
- **NFR-2 (Reliability)**: Graceful configuration reloads without downtime.
- **NFR-3 (Performance)**: High throughput with the ability to handle thousands of concurrent connections.
- **NFR-4 (Ease of Use)**: Caddyfile should be legible and easy for novices to write.
- **NFR-5 (Extensibility)**: Modular architecture allowing for community plugins.

## 7. Technology Stack
- **Language**: Go
- **Protocols**: HTTP/1.1 - HTTP/3, TLS 1.2+
