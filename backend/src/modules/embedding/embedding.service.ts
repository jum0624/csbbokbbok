import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmbeddingService {
  private genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.genai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
      config: { outputDimensionality: 768 },
    });
    return response.embeddings[0].values;
  }
}
