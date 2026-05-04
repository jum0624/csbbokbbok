import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QuizKeyword } from '../entities/tb-quiz-keyword.entity';

@Injectable()
export class QuizKeywordRepository extends Repository<QuizKeyword> {
  constructor(@InjectDataSource() private dataSource: DataSource) {
    super(QuizKeyword, dataSource.createEntityManager());
  }

  findByMainQuizId(mainQuizId: number): Promise<QuizKeyword[]> {
    return this.find({
      where: {
        mainQuiz: { mainQuizId },
      },
    });
  }

  findAllWithoutEmbedding(): Promise<QuizKeyword[]> {
    return this.createQueryBuilder('qk')
      .where('qk.embedding IS NULL')
      .getMany();
  }

  async updateEmbedding(
    quizKeywordId: number,
    embedding: number[],
  ): Promise<void> {
    await this.createQueryBuilder()
      .update(QuizKeyword)
      .set({ embedding } as any)
      .where('quiz_keyword_id = :quizKeywordId', { quizKeywordId })
      .execute();
  }

  /**
   * 임베딩 키워드 찾기
   * @param keywords
   */
  findEmbeddingsByKeywords(keywords: string[]): Promise<QuizKeyword[]> {
    return this.createQueryBuilder('qk')
      .where('qk.keyword IN (:...keywords)', { keywords })
      .andWhere('qk.embedding IS NOT NULL')
      .getMany();
  }
}
