import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { SolvedQuizRepository } from 'src/datasources/repositories/tb-solved-quiz.repository';
import { QuizKeywordRepository } from 'src/datasources/repositories/tb-quiz-keyword.repository';
import { MainQuizRepository } from 'src/datasources/repositories/tb-main-quiz.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolvedQuiz } from 'src/datasources/entities/tb-solved-quiz.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SolvedQuiz])],
  providers: [
    RecommendationService,
    SolvedQuizRepository,
    QuizKeywordRepository,
    MainQuizRepository,
  ],
  controllers: [RecommendationController],
})
export class RecommendationModule {}
