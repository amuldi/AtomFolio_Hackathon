import {
  enrichSecurityIdentifiers,
  enrichSecurityItems,
} from '../../server/securityEnrichment.mjs';
import { readJsonBody, sendJson } from '../_utils/http.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const force = Boolean(body.force);

    if (Array.isArray(body.items)) {
      const payload = await enrichSecurityItems(body.items, { force });
      sendJson(response, 200, payload);
      return;
    }

    if (Array.isArray(body.identifiers)) {
      const payload = await enrichSecurityIdentifiers(body.identifiers, { force });
      sendJson(response, 200, payload);
      return;
    }

    sendJson(response, 400, {
      error: 'Provide an items array or identifiers array.',
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Security enrichment failed.',
    });
  }
}
