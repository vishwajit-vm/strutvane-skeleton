// GET /: the first page of a fresh app. Replace it with your own, or let the React UI take over.
import { config, type HttpContext } from '@strutvane/framework'

export class WelcomeController {
  __invoke(ctx: HttpContext): Response {
    const name = escapeHtml(String(config('app.name')))
    return ctx.html(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title></head>` +
        `<body><h1>${name}</h1><p>Your Strutvane app is running.</p>` +
        '<p>API health: <a href="/api/v1/health">/api/v1/health</a></p></body></html>',
    )
  }
}

/** Escape text for HTML: the app name comes from .env, so it is never trusted as markup. */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
