# Storage Configuration

RepoLens supports two storage modes: **Local Filesystem** and **AWS S3**.

## Local Storage Mode

When `LOCAL_STORAGE=true` is set in your environment variables, RepoLens will use local filesystem storage instead of S3.

### Configuration

Add to your `.env` file:

```bash
LOCAL_STORAGE=true
```

### Storage Location

When local mode is enabled, all files are stored in:
```
storage/any-bucket/
```

This directory structure mirrors S3 bucket structure:
- `storage/any-bucket/repos/{repoId}/{sha}/{filePath}` - Source files
- `storage/any-bucket/ast/{repoId}/{sha}/{filePath}.json` - AST files

### Benefits

- ✅ No AWS credentials needed
- ✅ Faster for local development
- ✅ No cloud costs
- ✅ Easy to inspect files directly

### Limitations

- ❌ Not scalable across multiple servers
- ❌ No redundancy
- ❌ Files lost if server fails
- ❌ Not suitable for production (unless using shared filesystem)

## S3 Storage Mode (Default)

When `LOCAL_STORAGE` is not set or `false`, RepoLens uses AWS S3.

### Configuration

```bash
LOCAL_STORAGE=false
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET=repolens-artifacts
```

### Benefits

- ✅ Scalable across multiple servers
- ✅ Redundant & durable
- ✅ Production-ready
- ✅ Versioning support

## Switching Modes

You can switch between modes by changing the `LOCAL_STORAGE` environment variable and restarting the API server.

**Note:** Files stored in one mode are not automatically migrated to the other. You'll need to re-index repositories when switching modes.

