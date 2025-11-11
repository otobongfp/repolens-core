# RepoLens NestJS API Structure

## Overview

The RepoLens API is built with **NestJS** and follows a modular architecture. This document describes the current structure and recommendations.

## Current Directory Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module (imports all feature modules)
├── app.controller.ts          # Root controller
│
├── common/                    # Shared utilities and infrastructure
│   ├── auth/                  # (empty) - Auth logic is in auth/ module
│   ├── config/                 # Configuration management (convict-based)
│   │   ├── config.module.ts
│   │   ├── config.service.ts
│   │   ├── config-loader.service.ts
│   │   └── data/
│   │       └── default.config.json
│   ├── database/               # Prisma database service
│   │   ├── database.module.ts
│   │   └── prisma.service.ts
│   ├── filters/                # (empty) - Exception filters
│   ├── interceptors/           # (empty) - Request/response interceptors
│   ├── logger/                 # (empty) - Logging utilities
│   ├── queue/                  # BullMQ queue management
│   │   ├── queue.module.ts
│   │   └── queue.service.ts
│   ├── redis/                  # (empty) - Redis client
│   ├── s3/                     # AWS S3 service
│   │   ├── s3.module.ts
│   │   └── s3.service.ts
│   ├── storage/                # Local filesystem storage
│   │   ├── storage.module.ts
│   │   └── storage.service.ts
│   └── tensor/                 # AI inference microservice client
│       └── tensor.service.ts
│
├── shared/                     # Shared DTOs, interfaces, models
│   ├── dto/
│   │   ├── auth.dto.ts
│   │   └── projects.dto.ts
│   ├── interfaces/
│   └── models/
│
├── health/                     # Health check module
│   ├── health.controller.ts
│   └── health.module.ts
│
├── auth/                       # Authentication module (better-auth)
│   ├── auth.controller.ts      # Custom endpoints (e.g., /auth/me)
│   ├── auth.service.ts         # Auth business logic
│   ├── auth.module.ts
│   └── better-auth.service.ts  # better-auth integration
│
├── projects/                   # Project management
│   ├── projects.controller.ts
│   ├── projects.service.ts
│   └── projects.module.ts
│
├── repositories/                # Repository management
│   ├── repositories.controller.ts
│   ├── repositories.service.ts
│   └── repositories.module.ts
│
├── ai/                         # AI analysis
│   ├── ai.controller.ts
│   ├── ai.service.ts
│   └── ai.module.ts
│
├── requirements/               # Requirements engineering
│   ├── requirements.controller.ts
│   ├── requirements.service.ts
│   └── requirements.module.ts
│
├── security/                   # Security scanning
│   ├── security.controller.ts
│   ├── security.service.ts
│   └── security.module.ts
│
├── action-proposals/           # AI action proposals
│   ├── action-proposals.controller.ts
│   ├── action-proposals.service.ts
│   └── action-proposals.module.ts
│
├── admin/                      # Admin operations
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   └── admin.module.ts
│
├── settings/                   # User/tenant settings
│   ├── settings.controller.ts
│   ├── settings.service.ts
│   └── settings.module.ts
│
├── webhooks/                   # Webhook receivers (GitHub/GitLab)
│   ├── webhooks.controller.ts
│   └── webhooks.module.ts
│
├── search/                     # RAG search service
│   └── search.service.ts
│
└── workers/                    # Background job workers
    ├── fetcher.worker.ts       # Fetch changed files from Git
    ├── parser.worker.ts        # Parse code with tree-sitter
    └── embedding.worker.ts     # Generate embeddings
```

## Architecture Patterns

### 1. **Module Structure**

Each feature module follows NestJS conventions:

```
feature-name/
├── feature-name.controller.ts  # HTTP endpoints
├── feature-name.service.ts     # Business logic
└── feature-name.module.ts      # Module definition
```

### 2. **Common Utilities**

Located in `src/common/`:

- **Infrastructure services** (database, queue, storage, S3, tensor)
- **Cross-cutting concerns** (config, logging, filters, interceptors)
- Marked as `@Global()` modules for app-wide availability

### 3. **Shared Resources**

Located in `src/shared/`:

- DTOs (Data Transfer Objects) for request/response validation
- Interfaces for type definitions
- Models (if needed, though Prisma handles most)

### 4. **Authentication Flow**

1. **Better-Auth Middleware** (`main.ts`)
   - Mounted at `/auth/*` routes
   - Handles: sign-up, sign-in, sign-out, session, OAuth callbacks
   - Routes: `/auth/sign-up`, `/auth/sign-in`, `/auth/session`, etc.

2. **Custom Auth Module** (`src/auth/`)
   - `/api/v1/auth/me` - Extended endpoint with tenant info
   - Integrates better-auth with RepoLens User/Tenant models

### 5. **Background Processing**

Workers in `src/workers/` process:

1. **Fetcher**: Clones repos, detects changes, stores files in S3
2. **Parser**: Uses tree-sitter to extract ASTs, stores in S3
3. **Embedding**: Generates summaries and embeddings via tensor service

### 6. **External Services**

- **Tensor Service**: Python FastAPI microservice for AI inference
  - Located in `repolens/tensor/`
  - Handles: embeddings, summarization, chat
- **S3**: AWS S3 for artifact storage (ASTs, file blobs, archives)
- **PostgreSQL**: Database via Prisma ORM
- **Redis**: Queue management (BullMQ) and caching
- **Local Filesystem**: Repository clones

## Route Organization

```
/auth/*                      # Better-auth routes (sign-up, sign-in, etc.)
/api/v1/auth/me             # Custom: Get user with tenant info
/api/v1/health              # Health check
/api/v1/projects            # Project CRUD
/api/v1/repositories        # Repository management
/api/v1/ai                 # AI analysis endpoints
/api/v1/requirements       # Requirements engineering
/api/v1/security           # Security scanning
/api/v1/action-proposals   # AI-generated action proposals
/api/v1/admin              # Admin operations
/api/v1/settings           # User/tenant settings
/api/v1/webhooks           # GitHub/GitLab webhooks
/api/docs                  # Swagger documentation
```

## Current Issues & Recommendations

### ❌ **Issues**

1. **Empty Directories**
   - `common/auth/` - Should be removed (auth is in `auth/` module)
   - `common/filters/` - No exception filters implemented
   - `common/interceptors/` - No interceptors implemented
   - `common/logger/` - No logger service implemented
   - `common/redis/` - No Redis client module (queue uses ioredis directly)

2. **Missing Modules**
   - `search/` has a service but no module/controller
   - `workers/` are not registered as modules or queue processors
   - `tensor/` service not wrapped in a module

3. **Inconsistent Patterns**
   - Some services in `common/` have modules, some don't
   - `tensor.service.ts` in `common/tensor/` but not a module
   - `search.service.ts` standalone without module

### ✅ **Recommended Structure Improvements**

#### 1. **Clean Up Empty Directories**

```bash
# Remove or populate these:
rm -rf src/common/auth
# OR populate with guards/decorators if needed

# Implement or remove:
src/common/filters/        → Add exception filters
src/common/interceptors/   → Add logging/transform interceptors
src/common/logger/         → Add Winston logger module
src/common/redis/          → Add Redis module (if needed beyond BullMQ)
```

#### 2. **Complete Module Structure**

**Create missing modules:**

```
src/search/
├── search.module.ts        # NEW
├── search.controller.ts     # NEW
└── search.service.ts        # EXISTS

src/workers/
├── workers.module.ts        # NEW
├── fetcher.worker.ts       # EXISTS
├── parser.worker.ts        # EXISTS
└── embedding.worker.ts      # EXISTS

src/common/tensor/
├── tensor.module.ts         # NEW (to export TensorService properly)
└── tensor.service.ts        # EXISTS
```

#### 3. **Consolidate Common Modules**

**Option A: Keep `common/` for infrastructure**

- ✅ Database, Config, Queue, Storage, S3 → Stay in `common/`
- ✅ Tensor, Redis → Move to `common/` with modules

**Option B: Create separate infrastructure modules**

- Database, Config, Queue → Already in `common/`
- Tensor → Could stay or move to `services/`

#### 4. **Recommended Final Structure**

```
src/
├── main.ts
├── app.module.ts
├── app.controller.ts
│
├── common/                   # Infrastructure & shared utilities
│   ├── config/              # ✅ Complete
│   ├── database/            # ✅ Complete
│   ├── queue/               # ✅ Complete
│   ├── storage/             # ✅ Complete
│   ├── s3/                  # ✅ Complete
│   ├── tensor/              # ⚠️ Add tensor.module.ts
│   ├── redis/               # ⚠️ Create redis.module.ts (or remove)
│   ├── logger/              # ⚠️ Create logger.module.ts
│   ├── filters/              # ⚠️ Create exception filters
│   └── interceptors/         # ⚠️ Create interceptors
│
├── shared/                   # Shared types & DTOs
│   ├── dto/
│   ├── interfaces/
│   └── models/
│
├── [feature-modules]/        # Business logic modules
│   ├── auth/
│   ├── projects/
│   ├── repositories/
│   ├── ai/
│   ├── requirements/
│   ├── security/
│   ├── action-proposals/
│   ├── admin/
│   ├── settings/
│   ├── webhooks/
│   ├── health/
│   ├── search/              # ⚠️ Add search.module.ts & controller
│   └── workers/              # ⚠️ Add workers.module.ts
```

## Migration Status

✅ **Complete:**

- Core module structure (auth, projects, repositories, etc.)
- Database integration (Prisma)
- Better-auth integration
- Basic services (S3, Storage, Queue)
- Worker implementations (fetcher, parser, embedding)

⚠️ **Incomplete:**

- Search module (service exists, no module/controller)
- Workers module (workers exist, not registered)
- Tensor module (service exists, not a proper module)
- Logging, filters, interceptors (not implemented)
- Redis module (if needed separately from BullMQ)

## Next Steps

1. **Clean up empty directories** (remove or populate)
2. **Create missing modules** (search, workers, tensor)
3. **Implement cross-cutting concerns** (logger, filters, interceptors)
4. **Register workers** with BullMQ queue processor
5. **Add guards/decorators** for authentication/authorization
6. **Complete service implementations** (many are TODO stubs)
