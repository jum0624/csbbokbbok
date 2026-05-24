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
});
