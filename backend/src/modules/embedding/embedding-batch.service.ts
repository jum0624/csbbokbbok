import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { MainQuizRepository } from 'src/datasources/repositories/tb-main-quiz.repository';
import { QuizKeywordRepository } from 'src/datasources/repositories/tb-quiz-keyword.repository';

@Injectable()
export class EmbeddingBatchService {
  private readonly logger = new Logger(EmbeddingBatchService.name);

  constructor(
    private readonly mainQuizRepository: MainQuizRepository,
    private readonly embeddingService: EmbeddingService,
    private readonly quizKeywordRepository: QuizKeywordRepository,
  ) {}

  async embedAllQuizzes(): Promise<void> {
    const quizzes = await this.mainQuizRepository.findAllWithoutEmbedding();

    this.logger.log(`임베딩 대상 문제 수: ${quizzes.length}`);

    for (const quiz of quizzes) {
      try {
        const keywordText =
          quiz.keywords?.map((k) => k.keyword).join(', ') ?? '';
        const text = `${quiz.title}\n${quiz.content}\n키워드: ${keywordText}`;
        this.logger.log(`${text}`);

        const embedding = await this.embeddingService.generateEmbedding(text);
        await this.mainQuizRepository.updateEmbedding(
          quiz.mainQuizId,
          embedding,
        );

        this.logger.log(`완료: ${quiz.mainQuizId} - ${quiz.title}`);
      } catch (e) {
        this.logger.error(
          `실패: ${quiz.mainQuizId} - ${e?.message ?? e}`,
          e?.stack,
        );
      }
    }

    this.logger.log('전체 임베딩 완료');
  }

  async embedAllKeywords() {
    const keywords = await this.quizKeywordRepository.findAllWithoutEmbedding();

    this.logger.log(`임베딩 대상 키워드 수: ${keywords.length}`);

    for (const keyword of keywords) {
      try {
        const text = keyword.description
          ? `${keyword.keyword}: ${keyword.description}`
          : keyword.keyword;
        this.logger.log(`${text}`);

        const embedding = await this.embeddingService.generateEmbedding(text);
        await this.quizKeywordRepository.updateEmbedding(
          keyword.quizKeywordId,
          embedding,
        );

        this.logger.log(`완료: ${keyword.quizKeywordId} - ${keyword.keyword}`);
      } catch (e) {
        this.logger.error(
          `실패: ${keyword.quizKeywordId} - ${e?.message ?? e}`,
          e?.stack,
        );
      }
    }

    this.logger.log('전체 임베딩 완료');
  }
}
