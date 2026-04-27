import { mergeAgentWarnings, deriveReviewStatus } from './contracts.mjs';
import { runExplanationAgent } from './explanationAgent.mjs';
import { runQualityGuardAgent } from './qualityGuard.mjs';
import { runSchemaMapperAgent } from './schemaMapper.mjs';

export async function orchestratePortfolioReview({
  fileName,
  parserDiagnostics,
  timelineItems,
  items,
}) {
  const [schemaReview, qualityReview] = await Promise.all([
    runSchemaMapperAgent(parserDiagnostics),
    runQualityGuardAgent({
      parserDiagnostics,
      timelineItems,
      items,
    }),
  ]);
  const explanation = await runExplanationAgent({
    parserDiagnostics,
    schemaReview,
    qualityReview,
  });
  const warnings = mergeAgentWarnings(
    parserDiagnostics?.warnings ?? [],
    schemaReview?.warnings ?? [],
    qualityReview?.warnings ?? [],
  );

  return {
    mode: 'deterministic-subagents',
    fileName,
    status: deriveReviewStatus(warnings),
    summary: explanation.summary,
    warnings,
    agents: [schemaReview, qualityReview, explanation],
  };
}
