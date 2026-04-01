# Prisma migrations

## Apply migrations

From the `api/` directory:

```bash
npx prisma migrate deploy
```

This applies all pending migrations, including:

- **RequirementGroundTruth** – ground truth links for metrics (P/R/F1).
- **Embedding.vector** – pgvector column and extension (migration `20260108223142_add_vector_column`). Required for semantic search and requirement matching; without it, `vector` and storage will fail until the migration is applied and `DIRECT_URL` is set.

## Why Embedding.vector and vectorId are null

If the **Embedding** table has `vector` and/or `vectorId` null:

1. **Run migrations** – The `vector` column is added by migration `20260108223142_add_vector_column`. Run `npx prisma migrate deploy` from `api/`.
2. **Set DIRECT_URL** – Vector storage uses a **direct** PostgreSQL connection (not the pooler). In `.env` set `DIRECT_URL` to your DB’s direct connection (e.g. port **5432** for Supabase, not 6543). See “Supabase: TLS / P1011 errors” below.
3. **Re-run analysis** – After fixing the above, trigger “Analyze” again so new embeddings are created with vectors stored. Existing rows with null `vector` are not backfilled; you can delete them or re-analyze the repo.

## "different vector dimensions 1536 and 384"

The `Embedding.vector` column is `vector(1536)`. The app uses OpenAI `text-embedding-3-small` with **1536 dimensions**. If you see an error like `different vector dimensions 1536 and 384`, some rows in `Embedding` contain vectors created with a different model or `dimensions` (e.g. 384). **Fix:** Re-run **Analyze** on the affected repo(s) so all embeddings are regenerated with the current model (1536). You can also delete existing `Embedding` rows for that repo and then re-analyze.

**Token limit:** Very long node text is truncated to ~28k characters before embedding (to stay under the model’s 8191-token limit). So some embeddings can be “partial” for very large nodes; the worker also validates that every stored vector has 1536 dimensions so no wrong-sized vectors are written.

## Supabase: TLS / P1011 errors

If you see **P1011: Error opening a TLS connection: bad certificate format**:

1. **Use the direct connection for migrations**  
   In Supabase: **Project Settings → Database**. Use the **Direct connection** URI (port **5432**), not the Session/Transaction pooler (port 6543). Set that as `DIRECT_URL` in your `.env`:
   ```env
   DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
   ```
   (Your host may be different; use the one shown under "Direct connection".)

2. **Add SSL mode** to `DIRECT_URL` if it still fails:
   ```env
   DIRECT_URL="postgresql://...?sslmode=require"
   ```

3. **Session mode pooler**  
   If you must use the pooler for migrations, use **Session** mode (not Transaction) and add `?pgbouncer=true` to the URL. Prefer the direct connection for `migrate deploy`.

After updating `.env`, run `npx prisma migrate deploy` again from `api/`.

## P2024: Connection pool timeout

If you see **Timed out fetching a new connection from the connection pool** (e.g. when loading Compare at τ or running many metrics requests):

1. **Increase pool size** – Add `connection_limit` and optionally `connect_timeout` to `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql://...?connection_limit=30&connect_timeout=30"
   ```
   (Supabase and other hosted Postgres often limit connections; 20–30 is usually safe. Do not exceed your provider’s limit.)

2. **Reduce concurrent load** – The API now fetches shared data once per “Compare at τ” request to reduce connection usage. If you still hit the limit, avoid triggering many heavy metrics/compare requests at once.
