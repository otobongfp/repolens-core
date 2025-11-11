# Archive Format: tar.gz vs zip

## Why tar.gz? (Our Choice)

### ✅ Advantages

1. **Git Native**
   - Git uses tar internally: `git archive` outputs tar
   - GitHub/GitLab APIs provide `.tar.gz` archives
   - Native to the ecosystem we're working in

2. **Better Compression**
   - Gzip compression typically 5-15% better than zip for text
   - Especially effective on code files (high redundancy)
   - Smaller storage in S3 = lower costs

3. **Preserves Permissions**
   - Unix file permissions (755, 644, etc.)
   - Symbolic links preserved correctly
   - git maintains these for executables and symlinks

4. **Streaming Support**

   ```bash
   # Can stream create without storing entire archive in memory
   tar czf - source/ | aws s3 cp - s3://bucket/file.tar.gz
   ```

5. **Production Server Environment**
   - All production servers are Linux/unix
   - Docker containers are Linux
   - No Windows extraction needed

6. **Node.js Support**
   ```javascript
   // Native tar library works great
   await tar.create({ gzip: true, file: 'archive.tar.gz' }, ['.']);
   ```

### ⚠️ zip Advantages (What we're not using)

1. **Cross-platform**
   - Better for downloads to users (Windows/Mac)
   - But we're not serving archives to users

2. **Random Access**
   - Can read individual files without full extraction
   - But we download full repos anyway for parsing

3. **Partial Updates**
   - Can append files to zip
   - But we create archives once, not incrementally

## Our Use Case

For RepoLens:

- **Server-to-S3**: Linux → AWS S3 (both support tar.gz natively)
- **One-time archive**: We create once after clone, not incrementally
- **Full downloads**: Always extract full repo for parsing
- **Compression matters**: Storing many repos in S3

## Recommendation: **tar.gz** ✅

Perfect fit for our needs. If you need to serve archives to users for download, consider:

- Adding a zip endpoint for user downloads (when requested)
- Converting on-the-fly when needed
- Keeping tar.gz for internal storage

## Implementation Note

```typescript
// Our current approach - works great
await tar.create({ gzip: true, file: archivePath, cwd: repoPath }, ['.']);
```

If you need zip support, use `yauzl` or `adm-zip`, but tar.gz is the better choice for our architecture.
