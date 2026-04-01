import type { PrismaService } from '../../common/database/prisma.service';

/**
 * Code scope for a project: the set of Repo ids that contain the project's code.
 * Resolved via Project → Repository[] (urls) → Repo where url in urls.
 *
 * All matchers (embedding, tfidf, structural-only, hybrid) use this same scope so
 * baseline comparison is fair: same requirements, same code; only the matching
 * method (vector embedding, TF-IDF cosine, structural overlap, or hybrid) differs.
 */
export async function getProjectCodeScopeRepoIds(
  prisma: PrismaService,
  projectId: string
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { repositories: true },
  });
  if (!project || project.repositories.length === 0) return [];
  const urls = project.repositories.map((r) => r.url).filter((u): u is string => u != null);
  if (urls.length === 0) return [];
  const repos = await prisma.repo.findMany({
    where: { url: { in: urls } },
    select: { id: true },
  });
  return repos.map((r) => r.id);
}
