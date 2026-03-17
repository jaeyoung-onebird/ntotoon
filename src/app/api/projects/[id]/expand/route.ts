import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/projects/[id]/expand — AI로 소설 텍스트에 살 붙이기
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // 프로젝트에서 캐릭터 + 이전 에피소드 가져오기
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        characters: true,
        episodes: {
          orderBy: { number: 'desc' },
          take: 2,
          include: {
            panels: {
              orderBy: { orderIndex: 'desc' },
              take: 3,
              select: { sceneDescription: true },
            },
          },
        },
      },
    });

    // 캐릭터 컨텍스트
    const charContext = project?.characters?.length
      ? `\n\n기존 등장인물:\n${project.characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}`
      : '';

    // 이전 에피소드 컨텍스트
    let prevContext = '';
    if (project?.episodes?.length) {
      const recentEps = project.episodes.reverse(); // 오래된 순으로
      prevContext = '\n\n이전 에피소드 내용:\n' + recentEps.map(ep => {
        const lastScenes = ep.panels.reverse().map(p => p.sceneDescription).join(' → ');
        return `[${ep.number}화] ${ep.summary || ''}${lastScenes ? `\n  마지막 장면: ${lastScenes}` : ''}`;
      }).join('\n');
    }

    const isShort = text.trim().length < 300;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `당신은 웹툰 원작 소설을 집필하는 전문 작가입니다.
작가가 제공한 텍스트가 아무리 짧거나 허술해도, 반드시 웹툰 한 화 분량(20컷 이상을 만들 수 있는 분량)의 완성된 소설 텍스트를 만들어냅니다.
- 입력이 한 문장이어도 OK — 장르/상황을 파악해 자연스럽게 확장
- 인물 묘사가 없으면 역할에 맞게 추론해서 추가
- 대화가 없으면 자연스러운 대화 창작
- 시각적 묘사(표정, 행동, 배경, 날씨, 조명)를 풍부하게 추가
- 웹툰 특유의 극적 연출(침묵 컷, 클로즈업 순간, 리액션)을 고려한 장면 배치
- 원래 스토리 의도는 절대 변경하지 않음
- 마지막 장면은 반드시 다음 화가 궁금해지도록 클리프행어로 마무리 (충격적 반전, 예상치 못한 등장, 미해결 긴장감 등)
- 출력은 소설 텍스트만. 제목, 설명, 메타 정보 없이.`,
      messages: [{
        role: 'user',
        content: `${charContext}${prevContext}

${isShort ? '⚠️ 입력 텍스트가 매우 짧습니다. 스토리 의도를 유지하면서 웹툰 한 화 분량으로 대폭 확장해주세요.' : '아래 텍스트를 웹툰에 맞게 더 풍부하게 살을 붙여주세요.'}

원본:
${text}`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response');

    return NextResponse.json({ expandedText: content.text });
  } catch (error) {
    console.error('Failed to expand text:', error);
    return NextResponse.json({ error: 'Failed to expand text' }, { status: 500 });
  }
}
