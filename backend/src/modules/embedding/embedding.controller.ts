import { Controller, Post } from '@nestjs/common';
import { EmbeddingBatchService } from './embedding-batch.service';
import { Public } from 'src/modules/auth/decorator/public.decorator';

@Public()
@Controller('embedding')
export class EmbeddingController {
  constructor(private readonly embeddingBatchService: EmbeddingBatchService) {}

  @Post('batch')
  async runBatch() {
    await this.embeddingBatchService.embedAllQuizzes();
    return { message: '임베딩 완료' };
  }

  @Post('batch/keywords')
  async runKeywordBatch() {
    await this.embeddingBatchService.embedAllKeywords();
    return { message: '키워드 임베딩 완료' };
  }
}
