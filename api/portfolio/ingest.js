import { ingestPortfolioText } from '../../server/portfolioIngestion.mjs';
import { readJsonBody, sendJson } from '../_utils/http.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const fileName = String(body.fileName ?? '').trim() || 'portfolio.csv';
    const text = String(body.text ?? '');

    if (!text.trim()) {
      sendJson(response, 400, { error: 'Upload text is empty.' });
      return;
    }

    const payload = await ingestPortfolioText(fileName, text);
    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Portfolio ingestion failed.',
    });
  }
}
