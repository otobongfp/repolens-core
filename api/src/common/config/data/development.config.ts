export default {
  env: 'development',
  port: 4000,
  app: {
    name: 'RepoLens API (Dev)',
    version: '1.0.0',
  },
  database: {
    url: 'postgresql://localhost:5432/repolens',
  },
  redis: {
    url: 'redis://localhost:6379',
  },
  python: {
    aiServiceUrl: 'http://localhost:8080',
  },
  cors: {
    origins: ['http://localhost:3000', 'http://localhost:3001'],
  },
};
