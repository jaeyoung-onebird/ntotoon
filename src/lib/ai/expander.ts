import { GoogleGenAI } from '@google/genai';

const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

export async function expandText(
  text: string,
  characters: Array<{ name: string; description: string }>,
  prevEpisodes: Array<{ number: number; summary: string | null }>
): Promise<string> {
  const charContext = characters.length
    ? `\n기존 등장인물:\n${characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}`
    : '';

  const prevContext = prevEpisodes.length
    ? `\n이전 에피소드:\n${prevEpisodes.map(e => `${e.number}화: ${e.summary || ''}`).join('\n')}`
    : '';

  const systemPrompt = `당신은 웹툰 원작 소설을 집필하는 전문 작가입니다.
작가가 제공한 텍스트가 아무리 짧거나 허술해도, 반드시 웹툰 한 화 분량(18컷을 만들 수 있는 분량)의 완성된 소설 텍스트를 만들어냅니다.
⚠️ 중요: 반드시 2000자 이내로 작성하세요. 핵심 장면 위주로 압축하되 재미와 몰입감은 유지합니다.
- 입력이 한 문장이어도 OK — 장르/상황을 파악해 자연스럽게 확장
- 인물 묘사가 없으면 역할에 맞게 추론해서 추가
- 대화가 없으면 자연스러운 대화 창작
- 시각적 묘사(표정, 행동, 배경, 날씨, 조명)를 풍부하게 추가
- 웹툰 특유의 극적 연출(침묵 컷, 클로즈업 순간, 리액션)을 고려한 장면 배치
- 원래 스토리 의도는 절대 변경하지 않음
- 출력은 소설 텍스트만. 제목, 설명, 메타 정보 없이.`;

  const response = await gemini.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: [{ text: `${charContext}${prevContext}\n\n⚠️ 입력 텍스트가 매우 짧습니다. 스토리 의도를 유지하면서 웹툰 한 화 분량으로 대폭 확장해주세요.\n\n원본:\n${text}` }],
    config: { systemInstruction: systemPrompt, maxOutputTokens: 8192 },
  });

  const result = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result) return text;
  return result;
}
