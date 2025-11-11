# Repository Sync Architecture

## Cloud Platform Approach

### How GitHub/GitLab/Cloud Platforms Handle It

#### 1. **OAuth App Permissions**

```
User grants access → OAuth token → API can access repos
```

**Permissions:**

- Read access to private repos
- Read content, code, commits
- No write access needed (read-only)

#### 2. **Webhook Notifications** (Real-time updates)

```
Repo change → Platform sends webhook → Your service → Update/re-sync
```

**Webhooks include:**

- `push` events (new commits)
- `create` events (new branches/tags)
- `delete` events (deleted branches)
- `pull_request` events

#### 3. **API Polling** (Fallback)

```
Your service → Check last commit SHA → Compare → Decide if clone needed
```

## Recommended Architecture for RepoLens

### Strategy: Smart Incremental Updates

```typescript
interface RepoSync {
  // Store in DB
  lastCommitSha: string;      // Last commit we processed
  lastSyncedAt: Date;          // When we last checked
  repoStatus: 'SYNCED' | 'OUTDATED' | 'SYNCING'
}

// When to re-clone/re-sync
1. Webhook received → Check if needs update → Delta or full clone
2. Manual trigger → Check latest SHA → Compare → Update if changed
3. Scheduled check → Periodic comparison → Update if changed
```

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│ USER ADDS REPO                                              │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. GRANT PERMISSIONS (OAuth)                               │
│    - User authorizes via GitHub/GitLab                     │
│    - Get access token                                      │
│    - Store token securely (encrypted in DB)                │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SETUP WEBHOOK                                           │
│    POST https://github.com/repos/owner/repo/hooks          │
│    {                                                        │
│      url: "https://your-api.com/webhooks/github",          │
│      events: ["push", "create", "delete"]                  │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. INITIAL CLONE                                           │
│    - Clone repo to storage/                                │
│    - Store last commit SHA                                 │
│    - Index in Neo4j                                        │
│    - Extract metadata                                      │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. WEBHOOK RECEIVED                                        │
│    Repo changed → Webhook → Your API                       │
│    Check: Is SHA different?                                │
│    Yes → Incremental update                                │
│    No  → Ignore                                            │
└─────────────────────────────────────────────────────────────┘
```

## Incremental Update Strategies

### Option 1: Git Fetch (Smart)

```bash
cd storage/repo-id
git fetch origin
git reset --hard origin/main  # or merge if needed
```

**Pros:** Only downloads changes
**Cons:** Still need full repo locally

### Option 2: Archive Files to S3 (Best for Scale)

```typescript
// Initial clone
1. Clone to local temp
2. Tar.gz the repo
3. Upload to S3
4. Delete local copy
5. Store S3 URL in DB

// When webhook received
1. Download from S3
2. Extract
3. Git pull latest
4. Re-pack & upload to S3
5. Delete local
```

### Option 3: Delta Updates (Advanced)

```typescript
// Only download changed files
1. Use GitHub API: GET /repos/:owner/:repo/compare/:base...:head
2. Get file diffs
3. Download only changed files
4. Update local copy
```

## Implementation for RepoLens

### Database Schema Addition

```prisma
model Repository {
  id               String   @id
  name             String
  url              String
  // Add these fields
  lastCommitSha    String?   // Last processed commit
  lastSyncedAt     DateTime? // When last synced
  webhookId        String?   // Platform webhook ID
  accessTokenHash  String?   // Encrypted OAuth token
  s3ArchiveUrl     String?   // S3 location of archived repo
  syncStrategy     String    @default("full") // full, incremental, webhook
  repoStatus       String    @default("SYNCED") // SYNCED, OUTDATED, SYNCING
}
```

### Services to Add

#### 1. GitHub/GitLab Integration Service

```typescript
@Injectable()
export class GitPlatformService {
  // Setup webhook
  async setupWebhook(repoUrl: string, accessToken: string);

  // Check for updates
  async checkForUpdates(repoUrl: string, lastSha: string);

  // Get latest commit
  async getLatestCommit(repoUrl: string);
}
```

#### 2. Webhook Handler Controller

```typescript
@Controller('webhooks')
export class WebhookController {
  @Post('github')
  async handleGitHubWebhook(@Body() payload: any)

  @Post('gitlab')
  async handleGitLabWebhook(@Body() payload: any)
}
```

#### 3. Sync Service

```typescript
@Injectable()
export class RepoSyncService {
  // Manual sync trigger
  async syncRepository(repoId: string);

  // Check and update if changed
  async checkAndUpdate(repoId: string);

  // Upload to S3
  async archiveToS3(repoId: string, repoPath: string);
}
```

## S3 Artifact Storage Strategy

### What Goes to S3?

#### Option A: Full Repo Archive (Simple)

```typescript
// Tar.gz the entire repo, upload to S3
const archive = tar.create({ gzip: true }, [repoPath]);
await s3.upload({
  Bucket: 'repolens-repos',
  Key: `repos/${repoId}/${commitSha}.tar.gz`,
  Body: archive,
});
```

#### Option B: Per-File Artifacts (Scalable)

```typescript
// Upload individual files that changed
await s3.upload({
  Bucket: 'repolens-artifacts',
  Key: `repos/${repoId}/files/${filePath}`,
  Body: fileContent,
});
```

### Benefits of S3

- ✅ Only clone when changed (compare SHA)
- ✅ Historical snapshots per commit
- ✅ Multiple servers can access same data
- ✅ Lower disk usage (can delete local)
- ✅ Version controlled (each commit = new file)

## Cloud Platforms' Actual Approach

### GitHub's Approach

1. User grants OAuth permissions to your app
2. Your app gets read access to repos
3. You setup webhooks for repo events
4. Webhooks tell you when changes happen
5. You fetch only updates (git pull) or re-clone if needed

### Alternative: Git Providers API

```typescript
// Check latest commit without cloning
const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/main`, {
  headers: { Authorization: `token ${token}` },
});
const { sha } = await response.json();

// Compare with stored SHA
if (sha !== lastCommitSha) {
  // Trigger sync
  await syncRepository(repoId);
}
```

## Recommended Architecture for RepoLens

### Phase 1: Basic (Now)

- Clone repos to local storage
- Store metadata in PostgreSQL
- No S3, no webhooks yet

### Phase 2: Webhooks

- Add OAuth integration
- Setup webhooks on repo add
- Receive webhooks, trigger sync
- Still use local storage

### Phase 3: S3 + Smart Sync

- Add S3 upload after clone
- Compare SHA before re-cloning
- Only re-sync when changed
- Keep local copies for active repos
- Archive to S3 for inactive ones

## Implementation Plan

```typescript
// In RepositoriesService
async create(projectId, tenantId, repoData) {
  // 1. Create DB record
  const repo = await this.prisma.repository.create({...});

  // 2. Clone to local
  await this.cloneRepository(repo, url);

  // 3. Get latest commit SHA
  const sha = await this.getCommitSha(repo.path);

  // 4. Archive to S3
  const s3Url = await this.archiveToS3(repo.id, repo.path);

  // 5. Setup webhook
  await this.setupWebhook(repo.url);

  // 6. Update DB with SHA and S3 URL
  await this.prisma.repository.update({
    where: { id: repo.id },
    data: { lastCommitSha: sha, s3ArchiveUrl: s3Url }
  });
}
```

This gives you a scalable, cloud-ready architecture! 🚀
