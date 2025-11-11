import convict from 'convict';

const configSchema = {
  env: {
    doc: 'Environment',
    format: ['development', 'production', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  port: {
    doc: 'Port to bind',
    format: 'port',
    default: 4000,
    env: 'PORT',
  },
  app: {
    name: {
      doc: 'Application name',
      format: String,
      default: 'RepoLens API',
    },
    version: {
      doc: 'Application version',
      format: String,
      default: '1.0.0',
    },
  },
  database: {
    url: {
      doc: 'Database connection URL',
      format: String,
      default: 'postgresql://localhost:5432/repolens',
      env: 'DATABASE_URL',
    },
  },
  redis: {
    url: {
      doc: 'Redis connection URL',
      format: String,
      default: 'redis://localhost:6379',
      env: 'REDIS_URL',
    },
  },
  python: {
    aiServiceUrl: {
      doc: 'Python AI service URL',
      format: String,
      default: 'http://localhost:8080',
      env: 'TENSOR_URL',
    },
  },
  cors: {
    origins: {
      doc: 'CORS allowed origins',
      format: Array,
      default: ['http://localhost:3000'],
      env: 'CORS_ORIGINS',
    },
  },
};

export default configSchema;
