import { Injectable } from '@nestjs/common';
import { SolvedQuizRepository } from 'src/datasources/repositories/tb-solved-quiz.repository';
import { QuizKeywordRepository } from 'src/datasources/repositories/tb-quiz-keyword.repository';
import { MainQuizRepository } from 'src/datasources/repositories/tb-main-quiz.repository';
import { AiFeedback } from 'src/types/ai-feedback';
import { RecommendResponseDto } from 'src/modules/recommendation/dto/recommend-response.dto';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly solvedQuizRepository: SolvedQuizRepository,
    private readonly quizKeywordRepository: QuizKeywordRepository,
    private readonly mainQuizRepository: MainQuizRepository,
  ) {}

  async getRecommendedQuizzes(
    solvedQuizId: number,
  ): Promise<RecommendResponseDto[]> {
    // 1. solvedQuiz 조회
    const solvedQuiz = await this.solvedQuizRepository.getById(solvedQuizId);
    if (!solvedQuiz?.aiFeedback) return [];

    const aiFeedback = solvedQuiz.aiFeedback as AiFeedback;

    // 2. 언급 못한 키워드 추출
    const missedKeywords = aiFeedback.includedKeywords
      .filter((k) => !k.isIncluded)
      .map((k) => k.keyword);

    if (missedKeywords.length === 0) return [];

    // 3. 키워드 임베딩 조회
    const keywordEntities =
      await this.quizKeywordRepository.findEmbeddingsByKeywords(missedKeywords);
    if (keywordEntities.length === 0) return [];

    // 4. 벡터 평균 계산
    const avgEmbedding = this.averageEmbeddings(
      keywordEntities.map((k) => k.embedding),
    );

    // 5. 유사 문제 검색 (현재 푼 문제 제외)
    const recommendedQuizzes = await this.mainQuizRepository.findSimilarQuizzes(
      avgEmbedding,
      solvedQuiz.mainQuiz.mainQuizId,
    );

    return recommendedQuizzes.map((quiz) => RecommendResponseDto.from(quiz));
  }

  private averageEmbeddings(embeddings: number[][]): number[] {
    const dim = embeddings[0].length;
    const sum = new Array(dim).fill(0);

    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        sum[i] += emb[i];
      }
    }

    return sum.map((v) => v / embeddings.length);
  }
}
