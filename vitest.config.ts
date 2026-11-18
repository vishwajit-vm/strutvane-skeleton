import { configDefaults, defineConfig, type ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // The template's own tests run inside a rendered app (integration test), never here.
    exclude: [...configDefaults.exclude, 'template/**', '.work/**'],
    environment: 'node',
    passWithNoTests: false,
    allowOnly: false,
    restoreMocks: true,
    unstubEnvs: true,
    // Generous so the gate stays green on a loaded machine (the 648-combination renders; the
    // integration suite sets its own, longer timeout).
    testTimeout: 120_000,
  },
})

export default config
