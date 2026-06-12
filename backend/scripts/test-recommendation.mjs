const BASE_URL = 'http://localhost:8080/api';

const TEST_CASES = [
  // 네트워크
  { solvedQuizId: 109, label: '[네트워크] 웹 브라우저 접속 흐름 (DNS만 맞힘)' },
  { solvedQuizId: 111, label: '[네트워크] 웹 브라우저 접속 흐름 (DNS, 렌더링 맞힘)' },
  { solvedQuizId: 112, label: '[네트워크] 웹 브라우저 접속 흐름 (전부 miss)' },
  // 운영체제
  { solvedQuizId: 116, label: '[운영체제] 프로세스와 스레드 차이 (컨텍스트 스위칭, 자원 공유 miss)' },
  { solvedQuizId: 117, label: '[운영체제] 세마포어의 개념과 활용 (P/V연산, 카운팅, 대기 miss)' },
  { solvedQuizId: 118, label: '[운영체제] 교착상태 (상호배제, 비선점, 순환대기, 은행원알고리즘 miss)' },
  { solvedQuizId: 119, label: '[운영체제] CPU 스케줄링 (전부 맞힘 → 임베딩 기반 추천)' },
  // 데이터베이스
  { solvedQuizId: 120, label: '[데이터베이스] 트랜잭션과 ACID (격리성, 지속성 miss)' },
  { solvedQuizId: 121, label: '[데이터베이스] 트랜잭션 격리 수준 (READ UNCOMMITTED, REPEATABLE READ miss)' },
  { solvedQuizId: 122, label: '[데이터베이스] 인덱스 원리 (전부 맞힘 → 임베딩 기반 추천)' },
];

async function fetchRecommendations(solvedQuizId) {
  const res = await fetch(`${BASE_URL}/recommendation/quizzes?solvedQuizId=${solvedQuizId}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

async function run() {
  console.log('='.repeat(80));
  console.log('추천 문제 유사도 검증 테스트');
  console.log('='.repeat(80));

  for (const tc of TEST_CASES) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`케이스: ${tc.label}`);
    console.log(`solvedQuizId: ${tc.solvedQuizId}`);

    try {
      const results = await fetchRecommendations(tc.solvedQuizId);

      if (!results || results.length === 0) {
        console.log('  추천 결과: 없음');
        continue;
      }

      console.log(`\n  추천 문제 (${results.length}개):`);
      results.forEach((q, i) => {
        const score = (q.similarityScore * 100).toFixed(2);
        console.log(`  ${i + 1}. [${q.category}] ${q.title}`);
        console.log(`     유사도: ${score}%  난이도: ${q.difficultyLevel}`);
      });
    } catch (e) {
      console.log(`  오류: ${e.message}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('테스트 완료');
  console.log('='.repeat(80));
}

run();
