import { collapsePortfolioItemsForDisplay as collapsePortfolioItemsForDisplayShared } from '../lib/portfolioIngestionCore.js';

export function createPortfolioEntry(fileName, items, entryId) {
  const displayItems = collapsePortfolioItemsForDisplayShared(items);

  return {
    id:
      entryId ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    fileName,
    items: displayItems,
    timelineItems: items,
    parserDiagnostics: null,
    agentReview: null,
    ingestSource: 'client-local',
  };
}

export function createPortfolioEntryFromPayload(payload, entryId) {
  const timelineItems = Array.isArray(payload?.timelineItems) ? payload.timelineItems : [];
  const displayItems = Array.isArray(payload?.items)
    ? payload.items
    : collapsePortfolioItemsForDisplayShared(timelineItems);

  return {
    id:
      entryId ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`),
    fileName: payload?.fileName || 'portfolio.csv',
    items: displayItems,
    timelineItems,
    parserDiagnostics: payload?.parserDiagnostics ?? null,
    agentReview: payload?.agentReview ?? null,
    ingestSource: payload?.ingestSource ?? 'server',
  };
}

export function buildLocalPortfolioPayload(fileName, localItems, parserDiagnostics, overrides = {}) {
  const displayItems = collapsePortfolioItemsForDisplayShared(localItems);

  return {
    fileName,
    itemCount: localItems.length,
    securityCount: displayItems.length,
    items: displayItems,
    timelineItems: localItems,
    parserDiagnostics,
    agentReview: null,
    ingestSource: 'client-local',
    ...overrides,
  };
}

export function reviewStatusLabel(text, status) {
  if (status === 'blocked') {
    return text.reviewStatusBlocked;
  }

  if (status === 'needs-review') {
    return text.reviewStatusNeedsReview;
  }

  return text.reviewStatusOk;
}

export function resolveEntryReviewStatus(entry) {
  if (!entry) {
    return 'ok';
  }

  if (
    entry.ingestSource === 'client-local-fallback' ||
    entry.ingestSource === 'server-with-local-timeline'
  ) {
    return entry.agentReview?.status === 'blocked' ? 'blocked' : 'needs-review';
  }

  return entry.agentReview?.status ?? entry.parserDiagnostics?.reviewStatus ?? 'ok';
}

export function buildUploadReviewPreview(entry) {
  if (!entry) {
    return null;
  }

  const status = resolveEntryReviewStatus(entry);
  if (status === 'ok') {
    return null;
  }

  const summary = String(entry.agentReview?.summary ?? '').trim();
  const warnings = (entry.agentReview?.warnings ?? entry.parserDiagnostics?.warnings ?? [])
    .filter((warning) => String(warning?.message ?? '').trim())
    .slice(0, 3);

  if (!summary && !warnings.length) {
    return null;
  }

  return {
    status,
    summary,
    warnings,
  };
}
