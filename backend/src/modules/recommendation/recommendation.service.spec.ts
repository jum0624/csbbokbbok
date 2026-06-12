/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from './recommendation.service';
import { SolvedQuizRepository } from 'src/datasources/repositories/tb-solved-quiz.repository';
import { QuizKeywordRepository } from 'src/datasources/repositories/tb-quiz-keyword.repository';
import { MainQuizRepository } from 'src/datasources/repositories/tb-main-quiz.repository';
import { AiFeedback } from 'src/types/ai-feedback';
import { DifficultyLevel } from 'src/datasources/entities/tb-main-quiz.entity';

const makeSolvedQuiz = (aiFeedback: AiFeedback | null) => ({
  solvedQuizId: 10,
  aiFeedback,
  mainQuiz: { mainQuizId: 42, embedding: [1, 0, 0, 0] },
});

const makeAiFeedback = (
  keywords: { keyword: string; isIncluded: boolean }[],
): AiFeedback => ({
  includedKeywords: keywords,
  keywordsFeedback: '',
  followUpQuestions: [],
  complementsFeedback: [],
});

const makeKeywordEntity = (keyword: string, embedding: number[]) => ({
  quizKeywordId: 1,
  keyword,
  embedding,
});

const makeQuiz = (id: number) => ({
  mainQuizId: id,
  title: `문제 ${id}`,
  content: `내용 ${id}`,
  difficultyLevel: DifficultyLevel.MEDIUM,
  embedding: new Array(4).fill(0.1),
  quizCategory: { name: '운영체제' },
});

const makeQuizWithScore = (id: number, score: number) => ({
  ...makeQuiz(id),
  similarityScore: score,
});

describe('RecommendationService', () => {
  let service: RecommendationService;
  let solvedQuizRepository: jest.Mocked<SolvedQuizRepository>;
  let quizKeywordRepository: jest.Mocked<QuizKeywordRepository>;
  let mainQuizRepository: jest.Mocked<MainQuizRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: SolvedQuizRepository,
          useValue: { getById: jest.fn() },
        },
        {
          provide: QuizKeywordRepository,
          useValue: { findEmbeddingsByKeywords: jest.fn() },
        },
        {
          provide: MainQuizRepository,
          useValue: { findSimilarQuizzes: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    solvedQuizRepository = module.get(SolvedQuizRepository);
    quizKeywordRepository = module.get(QuizKeywordRepository);
    mainQuizRepository = module.get(MainQuizRepository);
  });

  describe('정상 케이스', () => {
    it('missed 키워드 기반으로 추천 문제를 정상 반환한다', async () => {
      const feedback = makeAiFeedback([
        { keyword: '교착상태', isIncluded: false },
        { keyword: '기아현상', isIncluded: true },
      ]);
      solvedQuizRepository.getById.mockResolvedValue(
        makeSolvedQuiz(feedback) as never,
      );
      quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
        makeKeywordEntity('교착상태', [1, 0, 0, 0]),
      ] as never);
      mainQuizRepository.findSimilarQuizzes.mockResolvedValue([
        makeQuiz(99),
      ] as never);

      const result = await service.getRecommendedQuizzes(10);

      expect(result).toHaveLength(1);
      expect(result[0].mainQuizId).toBe(99);
      expect(result[0].title).toBe('문제 99');
      expect(result[0].category).toBe('운영체제');
    });
  });

  describe('엣지 케이스', () => {
    it('aiFeedback이 null이면 빈 배열을 반환한다', async () => {
      solvedQuizRepository.getById.mockResolvedValue(
        makeSolvedQuiz(null) as never,
      );

      const result = await service.getRecommendedQuizzes(10);

      expect(result).toEqual([]);
      expect(
        quizKeywordRepository.findEmbeddingsByKeywords,
      ).not.toHaveBeenCalled();
    });

    it('모든 키워드를 맞혔으면 현재 문제 임베딩 기반으로 유사 문제를 반환한다', async () => {
      const feedback = makeAiFeedback([
        { keyword: '교착상태', isIncluded: true },
        { keyword: '기아현상', isIncluded: true },
      ]);
      solvedQuizRepository.getById.mockResolvedValue(
        makeSolvedQuiz(feedback) as never,
      );
      mainQuizRepository.findSimilarQuizzes.mockResolvedValue([
        makeQuiz(77),
      ] as never);

      const result = await service.getRecommendedQuizzes(10);

      expect(result).toHaveLength(1);
      expect(result[0].mainQuizId).toBe(77);
      expect(mainQuizRepository.findSimilarQuizzes).toHaveBeenCalledWith(
        [1, 0, 0, 0],
        42,
      );
      expect(
        quizKeywordRepository.findEmbeddingsByKeywords,
      ).not.toHaveBeenCalled();
    });

    it('missed 키워드가 DB에 없으면 빈 배열을 반환한다', async () => {
      const feedback = makeAiFeedback([
        { keyword: '없는키워드', isIncluded: false },
      ]);
      solvedQuizRepository.getById.mockResolvedValue(
        makeSolvedQuiz(feedback) as never,
      );
      quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue(
        [] as never,
      );

      const result = await service.getRecommendedQuizzes(10);

      expect(result).toEqual([]);
      expect(mainQuizRepository.findSimilarQuizzes).not.toHaveBeenCalled();
    });
  });

  describe('검증 포인트', () => {
    it('벡터 평균이 올바르게 계산된다', async () => {
      const feedback = makeAiFeedback([
        { keyword: '교착상태', isIncluded: false },
        { keyword: '기아현상', isIncluded: false },
      ]);
      solvedQuizRepository.getById.mockResolvedValue(
        makeSolvedQuiz(feedback) as never,
      );
      quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
        makeKeywordEntity('교착상태', [1, 0, 0, 0]),
        makeKeywordEntity('기아현상', [0, 1, 0, 0]),
      ] as never);
      mainQuizRepository.findSimilarQuizzes.mockResolvedValue([] as never);

      await service.getRecommendedQuizzes(10);

      expect(mainQuizRepository.findSimilarQuizzes).toHaveBeenCalledWith(
        [0.5, 0.5, 0, 0],
        42,
      );
    });

    it('findSimilarQuizzes 호출 시 현재 푼 문제 ID가 제외된다', async () => {
      const feedback = makeAiFeedback([
        { keyword: '교착상태', isIncluded: false },
      ]);
      solvedQuizRepository.getById.mockResolvedValue(
        makeSolvedQuiz(feedback) as never,
      );
      quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
        makeKeywordEntity('교착상태', [1, 0, 0, 0]),
      ] as never);
      mainQuizRepository.findSimilarQuizzes.mockResolvedValue([] as never);

      await service.getRecommendedQuizzes(10);

      expect(mainQuizRepository.findSimilarQuizzes).toHaveBeenCalledWith(
        expect.any(Array),
        42, // solvedQuiz.mainQuiz.mainQuizId
      );
    });

    it('반환 DTO에 embedding 필드가 없다', async () => {
      const feedback = makeAiFeedback([
        { keyword: '교착상태', isIncluded: false },
      ]);
      solvedQuizRepository.getById.mockResolvedValue(
        makeSolvedQuiz(feedback) as never,
      );
      quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
        makeKeywordEntity('교착상태', [1, 0, 0, 0]),
      ] as never);
      mainQuizRepository.findSimilarQuizzes.mockResolvedValue([
        makeQuiz(99),
      ] as never);

      const result = await service.getRecommendedQuizzes(10);

      expect(result[0]).not.toHaveProperty('embedding');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getRecommendedQuizzesIndividual
  // ─────────────────────────────────────────────────────────────────────────
  describe('getRecommendedQuizzesIndividual', () => {
    describe('정상 케이스', () => {
      it('단일 missed 키워드는 matchCount 1로 결과를 반환한다', async () => {
        const feedback = makeAiFeedback([
          { keyword: '교착상태', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
          makeKeywordEntity('교착상태', [1, 0, 0, 0]),
        ] as never);
        mainQuizRepository.findSimilarQuizzes.mockResolvedValue([
          makeQuizWithScore(99, 0.75),
          makeQuizWithScore(88, 0.65),
        ] as never);

        const result = await service.getRecommendedQuizzesIndividual(10);

        expect(result).toHaveLength(2);
        expect(result[0].quizId).toBe(99);
        expect(result[0].matchCount).toBe(1);
        expect(result[0].avgSimilarity).toBeCloseTo(0.75, 3);
        expect(result[1].quizId).toBe(88);
        expect(result[1].matchCount).toBe(1);
      });

      it('여러 키워드에 공통으로 등장한 문제는 matchCount가 누적된다', async () => {
        // K1: [quiz99(0.75), quiz88(0.65)]
        // K2: [quiz99(0.70), quiz77(0.60)]
        // quiz99 totalScore=1.45, matchCount=2
        const feedback = makeAiFeedback([
          { keyword: '교착상태', isIncluded: false },
          { keyword: '비선점', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
          makeKeywordEntity('교착상태', [1, 0, 0, 0]),
          makeKeywordEntity('비선점', [0, 1, 0, 0]),
        ] as never);
        mainQuizRepository.findSimilarQuizzes
          .mockResolvedValueOnce([
            makeQuizWithScore(99, 0.75),
            makeQuizWithScore(88, 0.65),
          ] as never)
          .mockResolvedValueOnce([
            makeQuizWithScore(99, 0.7),
            makeQuizWithScore(77, 0.6),
          ] as never);

        const result = await service.getRecommendedQuizzesIndividual(10);

        const quiz99 = result.find((r) => r.quizId === 99)!;
        expect(quiz99.matchCount).toBe(2);
        expect(quiz99.avgSimilarity).toBeCloseTo(0.725, 3);
      });

      it('단독 고득점보다 다중 키워드에 등장한 문제가 totalScore 기준으로 앞선다', async () => {
        // quiz88: K1에서만 등장, score=0.85 (totalScore=0.85)
        // quiz99: K1(0.75) + K2(0.70) 등장 (totalScore=1.45)
        // 개별 유사도는 quiz88이 높지만 totalScore는 quiz99가 높아 quiz99가 1위
        const feedback = makeAiFeedback([
          { keyword: '교착상태', isIncluded: false },
          { keyword: '비선점', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
          makeKeywordEntity('교착상태', [1, 0, 0, 0]),
          makeKeywordEntity('비선점', [0, 1, 0, 0]),
        ] as never);
        mainQuizRepository.findSimilarQuizzes
          .mockResolvedValueOnce([
            makeQuizWithScore(88, 0.85), // 단독 고득점
            makeQuizWithScore(99, 0.75),
          ] as never)
          .mockResolvedValueOnce([
            makeQuizWithScore(99, 0.7), // quiz99 두 번째 등장
          ] as never);

        const result = await service.getRecommendedQuizzesIndividual(10);

        // quiz99: totalScore=1.45 > quiz88: totalScore=0.85
        expect(result[0].quizId).toBe(99);
        expect(result[0].matchCount).toBe(2);
        expect(result[1].quizId).toBe(88);
        expect(result[1].matchCount).toBe(1);
      });
    });

    describe('엣지 케이스', () => {
      it('aiFeedback이 null이면 빈 배열을 반환한다', async () => {
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(null) as never,
        );

        const result = await service.getRecommendedQuizzesIndividual(10);

        expect(result).toEqual([]);
        expect(
          quizKeywordRepository.findEmbeddingsByKeywords,
        ).not.toHaveBeenCalled();
      });

      it('모든 키워드를 맞혔으면 임베딩 기반 결과를 matchCount=1로 반환한다', async () => {
        const feedback = makeAiFeedback([
          { keyword: '교착상태', isIncluded: true },
          { keyword: '비선점', isIncluded: true },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        mainQuizRepository.findSimilarQuizzes.mockResolvedValue([
          makeQuizWithScore(77, 0.8),
        ] as never);

        const result = await service.getRecommendedQuizzesIndividual(10);

        expect(result).toHaveLength(1);
        expect(result[0].quizId).toBe(77);
        expect(result[0].matchCount).toBe(1);
        expect(mainQuizRepository.findSimilarQuizzes).toHaveBeenCalledWith(
          [1, 0, 0, 0],
          42,
        );
        expect(
          quizKeywordRepository.findEmbeddingsByKeywords,
        ).not.toHaveBeenCalled();
      });

      it('missed 키워드가 DB에 없으면 빈 배열을 반환한다', async () => {
        const feedback = makeAiFeedback([
          { keyword: '없는키워드', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue(
          [] as never,
        );

        const result = await service.getRecommendedQuizzesIndividual(10);

        expect(result).toEqual([]);
        expect(mainQuizRepository.findSimilarQuizzes).not.toHaveBeenCalled();
      });
    });

    describe('검증 포인트', () => {
      it('findSimilarQuizzes가 키워드마다 topNPerKeyword=10으로 호출된다', async () => {
        const feedback = makeAiFeedback([
          { keyword: '교착상태', isIncluded: false },
          { keyword: '비선점', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
          makeKeywordEntity('교착상태', [1, 0, 0, 0]),
          makeKeywordEntity('비선점', [0, 1, 0, 0]),
        ] as never);
        mainQuizRepository.findSimilarQuizzes.mockResolvedValue([] as never);

        await service.getRecommendedQuizzesIndividual(10);

        expect(mainQuizRepository.findSimilarQuizzes).toHaveBeenCalledTimes(2);
        expect(mainQuizRepository.findSimilarQuizzes).toHaveBeenCalledWith(
          [1, 0, 0, 0],
          42,
          10,
        );
        expect(mainQuizRepository.findSimilarQuizzes).toHaveBeenCalledWith(
          [0, 1, 0, 0],
          42,
          10,
        );
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // compareRecommendationMethods
  // ─────────────────────────────────────────────────────────────────────────
  describe('compareRecommendationMethods', () => {
    describe('두 방식 차이가 유의미한 케이스', () => {
      it('다중 키워드에 등장한 문제가 개별 검색 상위로 올라와 두 방식의 1위가 달라진다', async () => {
        // 평균 벡터 결과: quiz77(0.80) 1위
        // 개별 검색 결과: quiz99(totalScore=1.45, matchCount=2) 1위
        //   → 실제 실험의 "프로세스와 스레드 차이" 케이스와 같은 패턴
        const feedback = makeAiFeedback([
          { keyword: '컨텍스트 스위칭', isIncluded: false },
          { keyword: '자원 공유', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue([
          makeKeywordEntity('컨텍스트 스위칭', [1, 0, 0, 0]),
          makeKeywordEntity('자원 공유', [0, 1, 0, 0]),
        ] as never);

        // 호출 순서:
        // 1) findSimilarQuizzes(avgEmbedding, 42)     → 평균 벡터 결과
        // 2) findSimilarQuizzes([1,0,0,0], 42, 10)   → 키워드1 개별 검색
        // 3) findSimilarQuizzes([0,1,0,0], 42, 10)   → 키워드2 개별 검색
        mainQuizRepository.findSimilarQuizzes
          .mockResolvedValueOnce([
            makeQuizWithScore(77, 0.8), // 평균 벡터 1위
            makeQuizWithScore(99, 0.72),
          ] as never)
          .mockResolvedValueOnce([
            makeQuizWithScore(99, 0.75), // 키워드1: quiz99 등장
            makeQuizWithScore(88, 0.65),
          ] as never)
          .mockResolvedValueOnce([
            makeQuizWithScore(99, 0.7), // 키워드2: quiz99 재등장 → totalScore=1.45
            makeQuizWithScore(77, 0.6),
          ] as never);

        const result = await service.compareRecommendationMethods(10);

        expect(result.fKeywords).toEqual(['컨텍스트 스위칭', '자원 공유']);
        // 평균 벡터: quiz77이 1위
        expect(result.averageVector[0].quizId).toBe(77);
        // 개별 검색: quiz99(totalScore=1.45)가 1위로 역전
        expect(result.individualSearch[0].quizId).toBe(99);
        expect(result.individualSearch[0].matchCount).toBe(2);
        // 두 방식의 1위가 다름을 명시적으로 검증
        expect(result.averageVector[0].quizId).not.toBe(
          result.individualSearch[0].quizId,
        );
      });
    });

    describe('두 방식이 동일한 케이스', () => {
      it('모든 키워드를 맞혔으면 두 방식 모두 동일한 임베딩 기반 결과를 반환한다', async () => {
        const feedback = makeAiFeedback([
          { keyword: '교착상태', isIncluded: true },
          { keyword: '비선점', isIncluded: true },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        mainQuizRepository.findSimilarQuizzes.mockResolvedValue([
          makeQuizWithScore(77, 0.8),
        ] as never);

        const result = await service.compareRecommendationMethods(10);

        expect(result.fKeywords).toEqual([]);
        expect(result.averageVector[0].quizId).toBe(77);
        expect(result.individualSearch[0].quizId).toBe(77);
        // 두 방식 1위 동일
        expect(result.averageVector[0].quizId).toBe(
          result.individualSearch[0].quizId,
        );
        // 임베딩 기반이므로 findEmbeddingsByKeywords 미호출
        expect(
          quizKeywordRepository.findEmbeddingsByKeywords,
        ).not.toHaveBeenCalled();
      });
    });

    describe('엣지 케이스', () => {
      it('aiFeedback이 null이면 fKeywords·averageVector·individualSearch 모두 빈 배열이다', async () => {
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(null) as never,
        );

        const result = await service.compareRecommendationMethods(10);

        expect(result.fKeywords).toEqual([]);
        expect(result.averageVector).toEqual([]);
        expect(result.individualSearch).toEqual([]);
      });

      it('missed 키워드가 DB에 없으면 fKeywords는 채워지고 두 결과는 빈 배열이다', async () => {
        const feedback = makeAiFeedback([
          { keyword: '없는키워드', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue(
          [] as never,
        );

        const result = await service.compareRecommendationMethods(10);

        expect(result.fKeywords).toEqual(['없는키워드']);
        expect(result.averageVector).toEqual([]);
        expect(result.individualSearch).toEqual([]);
      });
    });

    describe('검증 포인트', () => {
      it('fKeywords에는 isIncluded=false인 키워드만 포함된다', async () => {
        const feedback = makeAiFeedback([
          { keyword: '교착상태', isIncluded: false },
          { keyword: '비선점', isIncluded: true },
          { keyword: '순환대기', isIncluded: false },
        ]);
        solvedQuizRepository.getById.mockResolvedValue(
          makeSolvedQuiz(feedback) as never,
        );
        quizKeywordRepository.findEmbeddingsByKeywords.mockResolvedValue(
          [] as never,
        );

        const result = await service.compareRecommendationMethods(10);

        expect(result.fKeywords).toEqual(['교착상태', '순환대기']);
        expect(result.fKeywords).not.toContain('비선점');
      });
    });
  });
});
