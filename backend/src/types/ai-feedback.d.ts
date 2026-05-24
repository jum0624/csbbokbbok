export interface IncludedKeyword {
  keyword: string;
  isIncluded: boolean;
}

export interface AiFeedback {
  includedKeywords: IncludedKeyword[];
  keywordsFeedback: string;
  followUpQuestions: string[];
  complementsFeedback: { title: string; content: string }[];
}
