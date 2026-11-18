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

const container = document.getElementById('root')
if (container === null) throw new Error('resources/ui/index.html needs <div id="root"></div>')

createRoot(container).render(
  <StrictMode>
    <StrutvaneApp apiUrl="/api" appName="{{APP_NAME}}" design={design} routes={routes} />
  </StrictMode>,
)
