// The React UI entry. @strutvane/ui draws the admin (sidebar, lists, forms, detail pages) from the
// resource manifest the API publishes; the design package gives it its look. Your own pages go in
// `routes` below, and your brand colour, font and radius go in theme.css.
//
// The design is the one named in config/ui.ts; `node strut design:use <name>` updates both.
import * as designs from '{{DESIGN_PACKAGE}}'
import { type RouteDefinition, StrutvaneApp } from '@strutvane/ui/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'

/** Pages of your own, next to the generated ones: { path, title, element }. */
const routes: RouteDefinition[] = []

// A fixed key: bundlers resolve it at build time, so the design's unused exports are still dropped.
// biome-ignore lint/performance/noDynamicNamespaceImportAccess: literal key, resolved statically
const design = designs['{{DESIGN}}']

// The API base (VITE_API_URL, default /api/v1). Auth answers under it (/api/v1/auth) and the
// resource manifest comes from this site's /.well-known/strutvane.json.
const apiUrl = import.meta.env['VITE_API_URL'] ?? '/api/v1'

const container = document.getElementById('root')
if (container === null) throw new Error('resources/ui/index.html needs <div id="root"></div>')

createRoot(container).render(
  <StrictMode>
    <StrutvaneApp
      apiUrl={apiUrl}
      appName="{{APP_NAME}}"
      design={design}
      routes={routes}
      // @strut:if teams is false
      // Teams are off: the UI never asks the API for workspaces.
      tenancy={false}
      // @strut:endif
    />
  </StrictMode>,
)
