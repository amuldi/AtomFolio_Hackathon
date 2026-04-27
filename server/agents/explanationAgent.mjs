import { deriveReviewStatus } from './contracts.mjs';

export async function runExplanationAgent({ parserDiagnostics, schemaReview, qualityReview }) {
  const warnings = [...(schemaReview?.warnings ?? []), ...(qualityReview?.warnings ?? [])];
  const dateLabel = parserDiagnostics?.mappedColumns?.buyDate?.label;
  const returnLabel = parserDiagnostics?.mappedColumns?.return?.label;
  const identityLabel =
    parserDiagnostics?.mappedColumns?.stockName?.label ??
    parserDiagnostics?.mappedColumns?.stockCode?.label ??
    '';
  const parts = [
    identityLabel ? `핵심 식별 컬럼은 ${identityLabel}로 해석했습니다.` : '핵심 식별 컬럼은 재검토가 필요합니다.',
    dateLabel ? `날짜는 ${dateLabel} 열을 사용합니다.` : '날짜 열은 확정되지 않았습니다.',
    returnLabel ? `수익률은 ${returnLabel} 열을 사용합니다.` : '수익률 열은 확정되지 않았습니다.',
  ];

  if (warnings.length) {
    parts.push(`검토 포인트 ${warnings.length}건이 있습니다.`);
  }

  return {
    agent: 'explanation',
    status: deriveReviewStatus(warnings),
    summary: parts.join(' '),
    warnings: [],
  };
}
