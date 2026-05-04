import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingBatchService } from './embedding-batch.service';
import { EmbeddingService } from './embedding.service';
import { MainQuizRepository } from 'src/datasources/repositories/tb-main-quiz.repository';
import { QuizKeywordRepository } from 'src/datasources/repositories/tb-quiz-keyword.repository';

const mockQuizzes = [
  {
    mainQuizId: 1,
    title: '운영체제 스케줄링',
    content: '라운드 로빈과 우선순위 스케줄링의 차이를 설명하시오',
    embedding: null,
    keywords: [{ keyword: '라운드로빈' }, { keyword: '기아현상' }],
  },
  {
    mainQuizId: 2,
    title: 'TCP와 UDP 차이',
    content: 'TCP와 UDP의 차이점을 설명하시오',
    embedding: null,
    keywords: [{ keyword: 'TCP' }, { keyword: 'UDP' }],
  },
];

const mockKeywords = [
  {
    quizKeywordId: 1,
    keyword: '라운드로빈',
    description: '순서대로 CPU를 할당하는 스케줄링 알고리즘',
    embedding: null,
  },
];

describe('EmbeddingBatchService', () => {
  let service: EmbeddingBatchService;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let mainQuizRepository: jest.Mocked<MainQuizRepository>;
  let quizKeywordRepository: jest.Mocked<QuizKeywordRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingBatchService,
        {
          provide: EmbeddingService,
          useValue: {
            generateEmbedding: jest.fn(),
          },
        },
        {
          provide: MainQuizRepository,
          useValue: {
            findAllWithoutEmbedding: jest.fn(),
            updateEmbedding: jest.fn(),
          },
        },
        {
          provide: QuizKeywordRepository,
          useValue: {
            findAllWithoutEmbedding: jest.fn(),
            updateEmbedding: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmbeddingBatchService>(EmbeddingBatchService);
    embeddingService = module.get(EmbeddingService);
    mainQuizRepository = module.get(MainQuizRepository);
    quizKeywordRepository = module.get(QuizKeywordRepository);
  });

  describe('embedAllQuizzes', () => {
    it('각 문제에 대해 임베딩을 생성하고 저장한다', async () => {
      const fakeVector = new Array(768).fill(0.1);
      mainQuizRepository.findAllWithoutEmbedding.mockResolvedValue(
        mockQuizzes as never,
      );
      embeddingService.generateEmbedding.mockResolvedValue(fakeVector);

      await service.embedAllQuizzes();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        '운영체제 스케줄링\n라운드 로빈과 우선순위 스케줄링의 차이를 설명하시오\n키워드: 라운드로빈, 기아현상',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mainQuizRepository.updateEmbedding).toHaveBeenCalledTimes(2);
    });

    it('특정 문제 임베딩 실패해도 나머지는 계속 진행한다', async () => {
      mainQuizRepository.findAllWithoutEmbedding.mockResolvedValue(
        mockQuizzes as never,
      );
      embeddingService.generateEmbedding
        .mockRejectedValueOnce(new Error('API 오류'))
        .mockResolvedValueOnce(new Array(768).fill(0.1));

      await service.embedAllQuizzes();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(embeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mainQuizRepository.updateEmbedding).toHaveBeenCalledTimes(1);
    });
  });

  describe('embedAllKeywords', () => {
    it('각 키워드에 대해 임베딩을 생성하고 저장한다', async () => {
      const fakeVector = new Array(768).fill(0.1);
      quizKeywordRepository.findAllWithoutEmbedding.mockResolvedValue(
        mockKeywords as never,
      );
      embeddingService.generateEmbedding.mockResolvedValue(fakeVector);

      await service.embedAllKeywords();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        '라운드로빈: 순서대로 CPU를 할당하는 스케줄링 알고리즘',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(quizKeywordRepository.updateEmbedding).toHaveBeenCalledTimes(1);
    });
  });
});
