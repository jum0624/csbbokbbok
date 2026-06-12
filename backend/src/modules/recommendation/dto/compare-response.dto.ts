export class AverageVectorResultDto {
  quizId: number;
  title: string;
  category: string;
  similarity: number;
}

export class IndividualSearchResultDto {
  quizId: number;
  title: string;
  category: string;
  avgSimilarity: number;
  matchCount: number;
}

export class CompareResponseDto {
  fKeywords: string[];
  averageVector: AverageVectorResultDto[];
  individualSearch: IndividualSearchResultDto[];
}
