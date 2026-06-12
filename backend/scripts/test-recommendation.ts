import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '.env') });

const BASE_URL = 'http://localhost:8080/api';

interface IncludedKeyword {
  keyword: string;
  isIncluded: boolean;
}
interface AiFeedback {
  includedKeywords: IncludedKeyword[];
}
interface RecommendResult {
  mainQuizId: number;
  title: string;
  category: string;
  difficultyLevel: string;
  similarityScore: number;
}

const TEST_CASES = [
  // 네트워크
  { solvedQuizId: 109, label: '[네트워크] 웹 브라우저 접속 흐름 (DNS만 맞힘)' },
  {
    solvedQuizId: 111,
    label: '[네트워크] 웹 브라우저 접속 흐름 (DNS, 렌더링 맞힘)',
  },
  { solvedQuizId: 112, label: '[네트워크] 웹 브라우저 접속 흐름 (전부 miss)' },
  // 운영체제
  {
    solvedQuizId: 116,
    label:
      '[운영체제] 프로세스와 스레드 차이 (컨텍스트 스위칭, 자원 공유 miss)',
  },
  {
    solvedQuizId: 117,
    label: '[운영체제] 세마포어의 개념과 활용 (P/V연산, 카운팅, 대기 miss)',
  },
  {
    solvedQuizId: 118,
    label:
      '[운영체제] 교착상태 (상호배제, 비선점, 순환대기, 은행원알고리즘 miss)',
  },
  {
    solvedQuizId: 119,
    label: '[운영체제] CPU 스케줄링 (전부 맞힘 → 임베딩 기반 추천)',
  },
  // 데이터베이스
  {
    solvedQuizId: 120,
    label: '[데이터베이스] 트랜잭션과 ACID (격리성, 지속성 miss)',
  },
  {
    solvedQuizId: 121,
    label:
      '[데이터베이스] 트랜잭션 격리 수준 (READ UNCOMMITTED, REPEATABLE READ miss)',
  },
  {
    solvedQuizId: 122,
    label: '[데이터베이스] 인덱스 원리 (전부 맞힘 → 임베딩 기반 추천)',
  },
];

async function getMissedKeywords(
  ds: DataSource,
  solvedQuizId: number,
): Promise<{ all: string[]; missed: string[] }> {
  const row = await ds.query(
    `SELECT ai_feedback FROM tb_solved_quiz WHERE solved_quiz_id = $1`,
    [solvedQuizId],
  );
  if (!row[0]?.ai_feedback) return { all: [], missed: [] };

  const feedback = row[0].ai_feedback as AiFeedback;
  const all = feedback.includedKeywords.map((k) => k.keyword);
  const missed = feedback.includedKeywords
    .filter((k) => !k.isIncluded)
    .map((k) => k.keyword);
  return { all, missed };
}

async function fetchRecommendations(
  solvedQuizId: number,
): Promise<RecommendResult[]> {
  const res = await fetch(
    `${BASE_URL}/recommendation/quizzes?solvedQuizId=${solvedQuizId}`,
  );
  const json = await res.json();
  // 래퍼 없이 배열로 반환하는 경우 처리
  if (Array.isArray(json)) return json as RecommendResult[];
  if (json.success) return json.data as RecommendResult[];
  throw new Error(json.message ?? 'unknown error');
}

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();

  console.log('='.repeat(90));
  console.log(
    '추천 문제 검증 테스트 — OS / 네트워크 / DB 카테고리 10개 케이스',
  );
  console.log('='.repeat(90));

  for (const tc of TEST_CASES) {
    console.log(`\n${'─'.repeat(90)}`);
    console.log(`케이스  : ${tc.label}`);
    console.log(`solvedQuizId: ${tc.solvedQuizId}`);

    const { all, missed } = await getMissedKeywords(ds, tc.solvedQuizId);

    if (all.length === 0) {
      console.log(
        '  ⚠  aiFeedback 없음 (해당 solvedQuizId가 DB에 없거나 피드백 미생성)',
      );
      continue;
    }

    const included = all.filter((k) => !missed.includes(k));
    console.log(
      `F 키워드(miss) : ${missed.length > 0 ? missed.join(', ') : '없음 (전부 맞힘)'}`,
    );
    console.log(
      `O 키워드(hit)  : ${included.length > 0 ? included.join(', ') : '없음'}`,
    );

    let results: RecommendResult[];
    try {
      results = await fetchRecommendations(tc.solvedQuizId);
    } catch (e: any) {
      console.log(`  ✗ API 오류: ${e.message}`);
      continue;
    }

    if (!results || results.length === 0) {
      console.log('  추천 결과: 없음');
      continue;
    }

    console.log(`\n  추천 문제 (${results.length}개):`);
    results.forEach((q, i) => {
      const score = (q.similarityScore * 100).toFixed(2);
      console.log(`  ${i + 1}. [${q.category ?? '?'}] ${q.title}`);
      console.log(`     유사도: ${score}%  난이도: ${q.difficultyLevel}`);
    });
  }

  console.log(`\n${'='.repeat(90)}`);
  console.log('테스트 완료');
  console.log('='.repeat(90));

  await ds.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
