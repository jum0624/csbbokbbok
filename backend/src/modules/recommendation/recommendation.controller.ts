import { Controller, Get, Query } from '@nestjs/common';
import { RecommendationService } from 'src/modules/recommendation/recommendation.service';
import { Public } from 'src/modules/auth/decorator/public.decorator';
import { RecommendResponseDto } from 'src/modules/recommendation/dto/recommend-response.dto';

@Public()
@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('quizzes')
  async getRecommendedQuizzes(
    @Query('solvedQuizId') solvedQuizId: string,
  ): Promise<RecommendResponseDto[]> {
    return this.recommendationService.getRecommendedQuizzes(
      Number(solvedQuizId),
    );
  }
}
