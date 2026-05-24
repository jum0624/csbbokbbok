import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { DatasourcesModule } from 'src/datasources/datasources.module';
import { EmbeddingBatchService } from 'src/modules/embedding/embedding-batch.service';
import { EmbeddingController } from 'src/modules/embedding/embedding.controller';

@Module({
  imports: [DatasourcesModule],
  controllers: [EmbeddingController],
  providers: [EmbeddingService, EmbeddingBatchService],
  exports: [EmbeddingService, EmbeddingBatchService],
})
export class EmbeddingModule {}
