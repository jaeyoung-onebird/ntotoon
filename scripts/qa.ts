/**
 * QA 자동 평가 + 개선 스크립트
 *
 * 사용법:
 *   npx tsx scripts/qa.ts                    # 최신 프로젝트 평가
 *   npx tsx scripts/qa.ts <project-id>       # 특정 프로젝트 평가
 *   npx tsx scripts/qa.ts --improve          # 평가 + 자동 개선 루프
 *   npx tsx scripts/qa.ts <project-id> --improve
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { evaluateWebtoon } from '../src/lib/qa/evaluator';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const doImprove = args.includes('--improve');
  const projectId = args.find(a => !a.startsWith('--'));

  // 프로젝트 찾기
  let project;
  if (projectId) {
    project = await prisma.project.findUnique({ where: { id: projectId } });
  } else {
    project = await prisma.project.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!project) {
    console.error('완료된 프로젝트가 없습니다.');
    process.exit(1);
  }

  // 최신 에피소드 찾기
  const episode = await prisma.episode.findFirst({
    where: { projectId: project.id },
    orderBy: { number: 'desc' },
  });
  if (!episode) { console.error('에피소드 없음'); process.exit(1); }

  console.log(`\n=== QA 평가: "${project.title}" (${project.id}) ===\n`);

  // 평가
  console.log('평가 중...');
  const score = await evaluateWebtoon(project.id, episode.id);

  console.log('\n📊 평가 결과:');
  console.log(`  전체 점수:       ${formatScore(score.overall)}`);
  console.log(`  캐릭터 일관성:   ${formatScore(score.characterConsistency)}`);
  console.log(`  아트 스타일:     ${formatScore(score.artStyle)}`);
  console.log(`  텍스트 없음:     ${formatScore(score.noTextInImages)}`);
  console.log(`  말풍선:          ${formatScore(score.speechBubbles)}`);
  console.log(`  스토리 흐름:     ${formatScore(score.storyFlow)}`);
  console.log(`  배경 퀄리티:     ${formatScore(score.backgroundQuality)}`);

  if (score.issues.length > 0) {
    console.log('\n❌ 문제점:');
    score.issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }

  if (score.suggestions.length > 0) {
    console.log('\n💡 개선 제안:');
    score.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }

  if (doImprove && score.overall < 9) {
    console.log('\n🔄 자동 개선은 아직 CLI에서 미구현 (API로 실행해주세요)');
    // TODO: auto-improve 루프 연결
  }

  console.log('\n');
  await prisma.$disconnect();
}

function formatScore(n: number): string {
  const bar = '█'.repeat(n) + '░'.repeat(10 - n);
  const color = n >= 8 ? '\x1b[32m' : n >= 5 ? '\x1b[33m' : '\x1b[31m';
  return `${color}${bar} ${n}/10\x1b[0m`;
}

main().catch(console.error);
