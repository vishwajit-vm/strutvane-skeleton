// Browser routes. In a full app the React UI (resources/ui) is served next to these: by Vite in
// `node strut dev`, from the built files in production.
import { defineRoutes } from '@strutvane/framework'
import { WelcomeController } from '../app/http/controllers/welcome.controller.ts'

export default defineRoutes((router) => [router.get('/', WelcomeController).name('welcome')])
