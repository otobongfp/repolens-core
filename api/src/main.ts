import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { execSync } from 'child_process';
import { AppModule } from './app.module';
import { ConfigService } from './common/config/config.service';
import { QueueService } from './common/queue/queue.service';
import { PrometheusService } from './common/monitoring/prometheus.service';
import { MonitoringInterceptor } from './common/monitoring/monitoring.interceptor';
import { FetcherWorker } from './workers/fetcher.worker';
import { ParserWorker } from './workers/parser.worker';
import { EmbeddingWorker } from './workers/embedding.worker';
import { RequirementsWorker } from './requirements/requirements.worker';

async function bootstrap() {
  // Auto-run migrations on startup (development only)
  if (process.env.AUTO_MIGRATE === 'true' || process.env.NODE_ENV !== 'production') {
    try {
      console.log('Checking database migrations...');
      const migrateStatus = execSync('npx prisma migrate status', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (migrateStatus.includes('have not yet been applied')) {
        console.log('Applying pending migrations...');
        execSync('npx prisma migrate deploy', {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
        console.log('Migrations applied successfully');
      } else {
        console.log('Database is up to date');
      }
    } catch (error: any) {
      console.warn(
        'Migration check failed (this is OK if database is not accessible yet):',
        error.message
      );
    }
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  app.use(helmet());

  app.enableCors({
    origin: configService.getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Monitoring interceptor
  const prometheusService = app.get(PrometheusService);
  app.useGlobalInterceptors(new MonitoringInterceptor(prometheusService));

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('RepoLens API (Core)')
    .setDescription(
      'Codebase analysis and requirements engineering platform - Core version (no auth)'
    )
    .setVersion('1.0')
    .addBearerAuth()
    // Auth tag removed - not available in core
    .addTag('projects', 'Project management')
    .addTag('repositories', 'Repository analysis')
    .addTag('ai', 'Analysis')
    .addTag('requirements', 'Requirements engineering')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const disableWorkers = process.env.DISABLE_WORKERS === 'true' || process.env.DISABLE_WORKERS === '1';

  if (!disableWorkers) {
    const queueService = app.get(QueueService);
    const fetcherWorker = app.get(FetcherWorker);
    const parserWorker = app.get(ParserWorker);
    const embeddingWorker = app.get(EmbeddingWorker);
    const requirementsWorker = app.get(RequirementsWorker);

    queueService.createWorker('webhook-events', async (job) => fetcherWorker.process(job));
    queueService.createWorker('fetch-files', async (job) => fetcherWorker.process(job));
    queueService.createWorker('parse-files', async (job) => parserWorker.process(job));
    queueService.createWorker('embed-chunks', async (job) => embeddingWorker.process(job));
    queueService.createWorker('match-requirements', async (job) => requirementsWorker.process(job), { concurrency: 1 });
    queueService.createWorker('resolve-cross-file-refs', async (job) => {
      await parserWorker.resolveCrossFileRefs(job.data.repoId);
    });
  }

  const port = configService.getPort();
  await app.listen(port);

  console.log(`RepoLens Core API is running on: http://localhost:${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/docs`);
  console.log(
    `Storage Mode: ${process.env.LOCAL_STORAGE === 'true' ? 'LOCAL (any-bucket)' : 'S3'}`
  );
  console.log(`Note: This is core-only mode. Auth, billing, and integrations are not available.`);
  if (disableWorkers) {
    console.log('Workers are DISABLED (DISABLE_WORKERS=true). Fetcher, parser, and embedding will not run.');
  } else {
    console.log('Workers registered: fetcher, parser, embedding');
  }
}

bootstrap();
