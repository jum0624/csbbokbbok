'use client';

import { useRouter } from 'next/navigation';
import { RecommendedQuiz } from '@/app/feedback/types/feedback';
import { QuizInfoBadge } from '@/components/QuizInfoBadge';

export default function RecommendedQuizzes({ quizzes }: { quizzes: RecommendedQuiz[] }) {
  const router = useRouter();

  if (!quizzes || quizzes.length === 0) return null;

  return (
    <section className="w-full">
      <div className="mx-auto w-full max-w-[980px] rounded-2xl bg-white px-8 py-8 mb-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-gray-100">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl">
            📚
          </div>
          <h2 className="text-lg font-bold tracking-tight text-(--color-accent-navy)">
            이런 문제도 풀어보세요
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-4">
          {quizzes.map((quiz) => (
            <li
              key={quiz.mainQuizId}
              onClick={() => router.push(`/main-quiz/${quiz.mainQuizId}`)}
              className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 transition-all duration-300 hover:border-blue-100 hover:bg-slate-50/50 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.1)] cursor-pointer"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-md font-semibold text-slate-800 group-hover:text-blue-700 transition-colors duration-200 leading-snug">
                    {quiz.title}
                  </p>
                  <QuizInfoBadge
                    quizCategoryName={quiz.category}
                    difficultyLevel={quiz.difficultyLevel as '상' | '중' | '하'}
                    size="sm"
                  />
                </div>
                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                  {quiz.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
