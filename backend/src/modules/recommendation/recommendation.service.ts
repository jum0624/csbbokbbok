import { Injectable } from '@nestjs/common';
import { SolvedQuizRepository } from 'src/datasources/repositories/tb-solved-quiz.repository';
import { QuizKeywordRepository } from 'src/datasources/repositories/tb-quiz-keyword.repository';
import { MainQuizRepository } from 'src/datasources/repositories/tb-main-quiz.repository';
import { QuizKeyword } from 'src/datasources/entities/tb-quiz-keyword.entity';
import { AiFeedback } from 'src/types/ai-feedback';
import { RecommendResponseDto } from 'src/modules/recommendation/dto/recommend-response.dto';
import {
  CompareResponseDto,
  IndividualSearchResultDto,
} from 'src/modules/recommendation/dto/compare-response.dto';

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

    if (missedKeywords.length === 0) {
      const similar = await this.mainQuizRepository.findSimilarQuizzes(
        solvedQuiz.mainQuiz.embedding,
        solvedQuiz.mainQuiz.mainQuizId,
      );
      return similar.map((quiz) => RecommendResponseDto.from(quiz));
    }

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

  async getRecommendedQuizzesIndividual(
    solvedQuizId: number,
  ): Promise<IndividualSearchResultDto[]> {
    const solvedQuiz = await this.solvedQuizRepository.getById(solvedQuizId);
    if (!solvedQuiz?.aiFeedback) return [];

    const aiFeedback = solvedQuiz.aiFeedback as AiFeedback;
    const missedKeywords = aiFeedback.includedKeywords
      .filter((k) => !k.isIncluded)
      .map((k) => k.keyword);

    if (missedKeywords.length === 0) {
      const similar = await this.mainQuizRepository.findSimilarQuizzes(
        solvedQuiz.mainQuiz.embedding,
        solvedQuiz.mainQuiz.mainQuizId,
      );
      return similar.map((q) => ({
        quizId: q.mainQuizId,
        title: q.title,
        category: q.quizCategory?.name,
        avgSimilarity: q.similarityScore,
        matchCount: 1,
      }));
    }

    const keywordEntities =
      await this.quizKeywordRepository.findEmbeddingsByKeywords(missedKeywords);
    if (keywordEntities.length === 0) return [];

    return this.aggregateIndividualSearch(
      keywordEntities,
      solvedQuiz.mainQuiz.mainQuizId,
    );
  }

  async compareRecommendationMethods(
    solvedQuizId: number,
  ): Promise<CompareResponseDto> {
    const solvedQuiz = await this.solvedQuizRepository.getById(solvedQuizId);
    if (!solvedQuiz?.aiFeedback) {
      return { fKeywords: [], averageVector: [], individualSearch: [] };
    }

    const aiFeedback = solvedQuiz.aiFeedback as AiFeedback;
    const missedKeywords = aiFeedback.includedKeywords
      .filter((k) => !k.isIncluded)
      .map((k) => k.keyword);

    // 전부 맞힌 경우: 두 방식 모두 현재 문제 임베딩 기반으로 동일 결과
    if (missedKeywords.length === 0) {
      const similar = await this.mainQuizRepository.findSimilarQuizzes(
        solvedQuiz.mainQuiz.embedding,
        solvedQuiz.mainQuiz.mainQuizId,
      );
      return {
        fKeywords: [],
        averageVector: similar.map((q) => ({
          quizId: q.mainQuizId,
          title: q.title,
          category: q.quizCategory?.name,
          similarity: q.similarityScore,
        })),
        individualSearch: similar.map((q) => ({
          quizId: q.mainQuizId,
          title: q.title,
          category: q.quizCategory?.name,
          avgSimilarity: q.similarityScore,
          matchCount: 1,
        })),
      };
    }

    const keywordEntities =
      await this.quizKeywordRepository.findEmbeddingsByKeywords(missedKeywords);
    if (keywordEntities.length === 0) {
      return {
        fKeywords: missedKeywords,
        averageVector: [],
        individualSearch: [],
      };
    }

    // 평균 벡터 방식
    const avgEmbedding = this.averageEmbeddings(
      keywordEntities.map((k) => k.embedding),
    );
    const avgResults = await this.mainQuizRepository.findSimilarQuizzes(
      avgEmbedding,
      solvedQuiz.mainQuiz.mainQuizId,
    );

    // 개별 검색 방식
    const indResults = await this.aggregateIndividualSearch(
      keywordEntities,
      solvedQuiz.mainQuiz.mainQuizId,
    );

    return {
      fKeywords: missedKeywords,
      averageVector: avgResults.map((q) => ({
        quizId: q.mainQuizId,
        title: q.title,
        category: q.quizCategory?.name,
        similarity: q.similarityScore,
      })),
      individualSearch: indResults,
    };
  }

  private async aggregateIndividualSearch(
    keywordEntities: QuizKeyword[],
    excludeQuizId: number,
    topNPerKeyword = 10,
  ): Promise<IndividualSearchResultDto[]> {
    const scoreMap = new Map<
      number,
      {
        quiz: Awaited<
          ReturnType<MainQuizRepository['findSimilarQuizzes']>
        >[number];
        totalScore: number;
        matchCount: number;
      }
    >();

    for (const entity of keywordEntities) {
      const candidates = await this.mainQuizRepository.findSimilarQuizzes(
        entity.embedding,
        excludeQuizId,
        topNPerKeyword,
      );
      for (const candidate of candidates) {
        const existing = scoreMap.get(candidate.mainQuizId);
        if (existing) {
          existing.totalScore += candidate.similarityScore;
          existing.matchCount += 1;
        } else {
          scoreMap.set(candidate.mainQuizId, {
            quiz: candidate,
            totalScore: candidate.similarityScore,
            matchCount: 1,
          });
        }
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5)
      .map(({ quiz, totalScore, matchCount }) => ({
        quizId: quiz.mainQuizId,
        title: quiz.title,
        category: quiz.quizCategory?.name,
        avgSimilarity: parseFloat((totalScore / matchCount).toFixed(4)),
        matchCount,
      }));
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
