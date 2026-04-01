import { Test, TestingModule } from '@nestjs/testing';
import { StructuralOnlyMatcher } from './structural-only.matcher';
import { PrismaService } from '../../common/database/prisma.service';

describe('StructuralOnlyMatcher', () => {
  let matcher: StructuralOnlyMatcher;
  let prisma: PrismaService;

  const mockProject = {
    id: 'proj-1',
    repositories: [{ url: 'https://github.com/foo/repo' }],
  };

  const mockRepos = [{ id: 'repo-1' }];

  const mockNodes = [
    {
      id: 'node-1',
      nodePath: 'src/auth/function.login',
      filePath: 'src/auth.ts',
      symbol: { name: 'login' },
    },
    {
      id: 'node-2',
      nodePath: 'src/payment/function.processPayment',
      filePath: 'src/payment.ts',
      symbol: { name: 'processPayment' },
    },
    {
      id: 'node-3',
      nodePath: 'src/utils/function.helper',
      filePath: 'src/utils.ts',
      symbol: { name: 'helper' },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuralOnlyMatcher,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findUnique: jest.fn().mockResolvedValue(mockProject),
            },
            repo: {
              findMany: jest.fn().mockResolvedValue(mockRepos),
            },
            node: {
              findMany: jest.fn().mockResolvedValue(mockNodes),
            },
            symbolRef: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    matcher = module.get<StructuralOnlyMatcher>(StructuralOnlyMatcher);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(matcher).toBeDefined();
    expect(matcher.matcherType).toBe('structural-only');
  });

  it('should return matches with structural score from token overlap', async () => {
    const requirement = {
      id: 'req-1',
      text: 'The system shall allow user login and process payment',
      projectId: 'proj-1',
    };

    const results = await matcher.match(requirement, 'proj-1');

    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      include: { repositories: true },
    });
    expect(prisma.node.findMany).toHaveBeenCalledWith({
      where: { repoId: { in: ['repo-1'] } },
      select: expect.objectContaining({
        id: true,
        nodePath: true,
        filePath: true,
        signature: true,
        symbol: { select: { name: true, signature: true } },
      }),
    });

    expect(Array.isArray(results)).toBe(true);
    results.forEach((r) => {
      expect(r).toHaveProperty('nodeId');
      expect(r).toHaveProperty('similarity');
      expect(r.similarity).toBeGreaterThanOrEqual(0);
      expect(r.similarity).toBeLessThanOrEqual(1);
      expect(r.structuralMatch).toBe(true);
    });

    const node1 = results.find((r) => r.nodeId === 'node-1');
    const node2 = results.find((r) => r.nodeId === 'node-2');
    expect(node1).toBeDefined();
    expect(node2).toBeDefined();
    expect(node1!.similarity).toBeGreaterThan(0);
    expect(node2!.similarity).toBeGreaterThan(0);
  });

  it('should return empty array when project has no repos', async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

    const results = await matcher.match(
      { id: 'req-1', text: 'user login', projectId: 'proj-1' },
      'proj-1'
    );

    expect(results).toEqual([]);
    expect(prisma.node.findMany).not.toHaveBeenCalled();
  });

  it('should return empty array when requirement tokenizes to empty', async () => {
    const results = await matcher.match(
      { id: 'req-1', text: 'the and the', projectId: 'proj-1' },
      'proj-1'
    );

    expect(results).toEqual([]);
  });
});
