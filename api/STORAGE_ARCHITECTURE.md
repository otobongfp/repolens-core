# Storage Architecture

## Current Implementation (Local Filesystem)

### What We're Using

- **PostgreSQL** - Only stores METADATA about repositories
- **Local Filesystem** - Stores actual code in `storage/` directory
- **Neo4j** - Stores parsed code structure (functions, classes, relationships)

### What Gets Stored Where

#### PostgreSQL (Metadata Only)

```sql
- Projects: id, name, description, status, owner, dates
- Repositories: id, name, url, path (local), branch, status
- Users, Tenants, Analyses, etc.
```

#### Local Filesystem (Actual Code)

```
storage/
  └── <projectId>/
      └── <repoId>/
          ├── src/
          ├── package.json
          └── ...
```

#### Neo4j (Code Structure Graph)

```
- Nodes: Functions, Classes, Files
- Edges: Calls, Imports, Relationships
- Properties: Code snippets, signatures, docstrings
```

## PostgreSQL vs S3 for Code Storage

### ❌ PostgreSQL - DON'T STORE CODE HERE

**Why not:**

- Databases are for structured data, not large files
- Performance issues with large blobs
- Expensive storage (database storage costs)
- Not optimized for file operations
- Code in DB = slow queries, bloated backups

### ✅ Local Filesystem (Current)

**Pros:**

- Fast access (local disk)
- Free (no cloud costs)
- Git operations work natively
- Easy to parse files
- Perfect for development

**Cons:**

- Not scalable (one machine)
- No redundancy
- Lost on server failure
- Hard to share across instances

### ✅ S3 (For Production/Scale)

**Pros:**

- Scalable across multiple servers
- Redundant & durable
- Can serve multiple instances
- Versioning support
- Lower cost at scale

**Cons:**

- Slower access (network)
- Git operations need download first
- Cloud costs
- More complex setup

## FastAPI Backend Approach

The FastAPI backend uses:

1. **Local Filesystem** for storing cloned repos (like we're doing)
2. **S3** for storing evidence snippets and patches (small files)
3. **PostgreSQL** for metadata only
4. **Neo4j** for code graph structure

## Recommendation

### Development (Current)

✅ **Local filesystem** - What we have now

- Store repos in `storage/`
- Fast, simple, works great

### Production (Future Enhancement)

🔥 **Hybrid Approach**:

1. **Local filesystem** for active repos (being analyzed)
2. **S3** for archival/inactive repos
3. **PostgreSQL** for metadata (always)
4. **Neo4j** for code graphs (always)

### Implementation Strategy

```typescript
// In storage service
class StorageService {
  async storeRepository() {
    if (config.env === 'production' && config.useS3) {
      // Clone to local temp, upload to S3, delete local
      await this.uploadToS3(localPath, s3Key);
    } else {
      // Keep on local filesystem
      await this.cloneToLocal(localPath);
    }
  }
}
```

## Summary

**Current State:**

- ✅ Repos stored locally in filesystem
- ✅ PostgreSQL stores only metadata
- ✅ Neo4j stores parsed code structure
- ❌ NOT storing code in PostgreSQL (correct!)

**For now, local filesystem is perfect.** Add S3 later for production scale.
