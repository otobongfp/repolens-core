import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { StorageModule } from './common/storage/storage.module';
import { QueueModule } from './common/queue/queue.module';
import { TensorModule } from './common/tensor/tensor.module';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { AIModule } from './ai/ai.module';
import { RequirementsModule } from './requirements/requirements.module';
import { SecurityModule } from './security/security.module';
import { ActionProposalsModule } from './action-proposals/action-proposals.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SearchModule } from './search/search.module';
import { WorkersModule } from './workers/workers.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ConfigModule,
    DatabaseModule,
    StorageModule,
    QueueModule,
    TensorModule,
    SearchModule,
    HealthModule,
    ProjectsModule,
    RepositoriesModule,
    AIModule,
    RequirementsModule,
    SecurityModule,
    ActionProposalsModule,
    AdminModule,
    SettingsModule,
    WebhooksModule,
    WorkersModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
