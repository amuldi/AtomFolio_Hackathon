import { createAgentWarning, deriveReviewStatus } from './contracts.mjs';

function extractDateValue(item) {
  for (const field of item?.fields ?? []) {
    const label = String(field?.label ?? '').trim();
    if (/(날짜|일자|date|day|tradedate|recorddate|valuedate|snapshotdate|buydate)/i.test(label)) {
      return String(field?.value ?? '').trim();
    }
  }

  return '';
}

function normalizeLabel(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.\-/%()[\]]+/g, '');
}

function looksGenericLabel(value) {
  return /^(미국|한국|국내|해외|글로벌|선진국|신흥국|기술|반도체|금융|에너지|바이오|헬스|소재|성장주|가치주|고위험|중위험|저위험|주식|채권|현금|etf|fund|bond|cash|growth|value|technology|energy|financials?)$/.test(
    normalizeLabel(value),
  );
}

function metadataCoverage(items) {
  if (!items.length) {
    return 0;
  }

  const filledCount = items.reduce((count, item) => {
    return count + ['region', 'sector', 'style', 'risk', 'assetClass'].filter((key) => String(item?.[key] ?? '').trim()).length;
  }, 0);

  return filledCount / (items.length * 5);
}

export async function runQualityGuardAgent({ parserDiagnostics, timelineItems, items }) {
  const warnings = [];
  const timelineDateCount = new Set(timelineItems.map(extractDateValue).filter(Boolean)).size;
  const genericLabelCount = items.filter((item) => looksGenericLabel(item?.label)).length;
  const coverage = metadataCoverage(items);

  if (timelineItems.length >= 12 && timelineDateCount <= 1) {
    warnings.push(
      createAgentWarning({
        code: 'timeline-collapsed',
        severity: 'warning',
        message: '입력 행 수에 비해 날짜 종류가 너무 적어 시계열 파싱이 잘못됐을 수 있습니다.',
        source: 'quality-guard',
      }),
    );
  }

  if (items.length && genericLabelCount / items.length >= 0.25) {
    warnings.push(
      createAgentWarning({
        code: 'generic-labels',
        severity: 'warning',
        message: '표시 라벨 중 일부가 종목명보다 메타값처럼 보입니다.',
        source: 'quality-guard',
      }),
    );
  }

  if (items.length && coverage < 0.28) {
    warnings.push(
      createAgentWarning({
        code: 'low-metadata-coverage',
        severity: 'info',
        message: '자동 보강 후에도 메타데이터 충실도가 낮아 그룹 분석이 약할 수 있습니다.',
        source: 'quality-guard',
      }),
    );
  }

  if ((parserDiagnostics?.parsedItemCount ?? 0) > 0 && items.length === 0) {
    warnings.push(
      createAgentWarning({
        code: 'display-collapse-empty',
        severity: 'error',
        message: '파싱된 행은 있지만 표시용 종목이 비어 있습니다.',
        source: 'quality-guard',
      }),
    );
  }

  return {
    agent: 'quality-guard',
    status: deriveReviewStatus(warnings),
    summary: `timelineDates:${timelineDateCount}, metadataCoverage:${Math.round(coverage * 100)}%`,
    warnings,
  };
}
