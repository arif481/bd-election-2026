import { tavily } from '@tavily/core';

const tvly = tavily({ apiKey: import.meta.env.VITE_TAVILY_API_KEY });

export class TavilyService {
    static async search(query: string, options: Record<string, any> = {}) {
        try {
            const response = await tvly.search(query, {
                includeAnswer: false,
                maxResults: 5,
                searchDepth: "advanced",
                ...options
            });
            return response;
        } catch (error) {
            console.error('[Tavily] Search error:', error);
            return null;
        }
    }
}
