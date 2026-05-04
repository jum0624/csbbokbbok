export class RecommendResponseDto {
  mainQuizId: number;
  title: string;
  content: string;
  difficultyLevel: string;
  category: string;

  static from(quiz: any): RecommendResponseDto {
    const dto = new RecommendResponseDto();
    dto.mainQuizId = quiz.mainQuizId;
    dto.title = quiz.title;
    dto.content = quiz.content;
    dto.difficultyLevel = quiz.difficultyLevel;
    dto.category = quiz.quizCategory?.name;
    return dto;
  }
}
