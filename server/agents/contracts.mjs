export function createAgentWarning({ code, severity = 'info', message, source }) {
  return {
    code,
    severity,
    message,
    source,
  };
}

export function deriveReviewStatus(warnings = []) {
  if (warnings.some((warning) => warning.severity === 'error')) {
    return 'blocked';
  }

  if (warnings.some((warning) => warning.severity === 'warning')) {
    return 'needs-review';
  }

  return 'ok';
}

export function mergeAgentWarnings(...groups) {
  const deduped = new Map();

  groups.flat().filter(Boolean).forEach((warning) => {
    const key = `${warning.source}:${warning.code}:${warning.message}`;
    if (!deduped.has(key)) {
      deduped.set(key, warning);
    }
  });

  return [...deduped.values()];
}
