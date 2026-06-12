

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

async function fetchCompare(solvedQuizId) {
  const res = await fetch(
    `${BASE_URL}/recommendation/compare?solvedQuizId=${solvedQuizId}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

/** quizId 집합 기준으로 두 결과의 겹침 여부를 표시 */
function overlapTag(quizId, otherIds) {
  return otherIds.has(quizId) ? '◆' : '◇';
}

function printResults(label, items, otherIds, scoreKey) {
  if (items.length === 0) {
    console.log(`  ${label}: 결과 없음`);
    return;
  }
  console.log(`  ${label}:`);
  items.forEach((q, i) => {
    const score = (q[scoreKey] * 100).toFixed(2);
    const extra =
      scoreKey === 'avgSimilarity' ? `  match:${q.matchCount}` : '';
    const tag = overlapTag(q.quizId, otherIds);
    console.log(`  ${i + 1}. ${tag} [${q.category ?? '?'}] ${q.title}`);
    console.log(`       유사도: ${score}%${extra}`);
  });
}

async function run() {
  console.log('='.repeat(90));
  console.log('추천 방식 비교 테스트  ◆=두 방식 공통  ◇=해당 방식에만 등장');
  console.log('='.repeat(90));

  const summary = [];

  for (const tc of TEST_CASES) {
    console.log(`\n${'─'.repeat(90)}`);
    console.log(`케이스      : ${tc.label}`);
    console.log(`solvedQuizId: ${tc.solvedQuizId}`);

    let data;
    try {
      data = await fetchCompare(tc.solvedQuizId);
    } catch (e) {
      console.log(`  오류: ${e.message}`);
      continue;
    }

    if (!data.fKeywords && !data.averageVector) {
      console.log('  aiFeedback 없음 (해당 solvedQuizId 미존재 또는 피드백 미생성)');
      continue;
    }

    const fKeywords = data.fKeywords ?? [];
    const avgItems = data.averageVector ?? [];
    const indItems = data.individualSearch ?? [];

    console.log(
      `F 키워드    : ${fKeywords.length > 0 ? fKeywords.join(', ') : '없음 (전부 맞힘)'}`,
    );

    const avgIds = new Set(avgItems.map((q) => q.quizId));
    const indIds = new Set(indItems.map((q) => q.quizId));

    console.log('');
    printResults('평균 벡터', avgItems, indIds, 'similarity');
    console.log('');
    printResults('개별 검색', indItems, avgIds, 'avgSimilarity');

    const commonCount = [...avgIds].filter((id) => indIds.has(id)).length;
    summary.push({
      label: tc.label,
      fCount: fKeywords.length,
      avgTop1: avgItems[0]?.title ?? '-',
      indTop1: indItems[0]?.title ?? '-',
      sameTop1: avgItems[0]?.quizId === indItems[0]?.quizId,
      commonCount,
    });
  }

  // 전체 요약
  console.log(`\n${'='.repeat(90)}`);
  console.log('요약');
  console.log('='.repeat(90));
  console.log(
    `${'케이스'.padEnd(52)} ${'F수'.padStart(3)}  ${'공통'.padStart(4)}  ${'1위 일치'}`,
  );
  console.log('─'.repeat(90));
  for (const s of summary) {
    const label = s.label.length > 50 ? s.label.slice(0, 49) + '…' : s.label;
    console.log(
      `${label.padEnd(52)} ${String(s.fCount).padStart(3)}  ${String(s.commonCount).padStart(4)}  ${s.sameTop1 ? '✓' : '✗'}`,
    );
  }
  console.log('='.repeat(90));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
