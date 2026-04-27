import {
  collapsePortfolioItemsForDisplay,
  parsePortfolioTextDetailed,
} from '../src/lib/portfolioIngestionCore.js';
import { enrichSecurityItems } from './securityEnrichment.mjs';
import { orchestratePortfolioReview } from './agents/orchestrator.mjs';

export async function ingestPortfolioText(fileName, text) {
  const { items: parsedItems, diagnostics: parserDiagnostics } = parsePortfolioTextDetailed(text);
  const securityEnrichment = await enrichSecurityItems(parsedItems);
  const timelineItems = securityEnrichment.items;
  const items = collapsePortfolioItemsForDisplay(timelineItems);
  const agentReview = await orchestratePortfolioReview({
    fileName,
    parserDiagnostics,
    parsedItems,
    timelineItems,
    items,
    securityEnrichment,
  });

  return {
    fileName,
    itemCount: timelineItems.length,
    securityCount: items.length,
    items,
    timelineItems,
    parserDiagnostics,
    agentReview,
    securityEnrichment: {
      requestedCount: securityEnrichment.requestedCount,
      cacheHits: securityEnrichment.cacheHits,
      enrichedCount: securityEnrichment.enrichedCount,
      source: securityEnrichment.source,
    },
  };
}
