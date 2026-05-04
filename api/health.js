import { getSecurityEnrichmentCacheStats } from '../server/securityEnrichment.mjs';
import { sendJson } from './_utils/http.js';

export default function handler(request, response) {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  sendJson(response, 200, {
    ok: true,
    securityEnrichment: getSecurityEnrichmentCacheStats(),
  });
}
