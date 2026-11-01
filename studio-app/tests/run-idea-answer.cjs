// Use the already-installed Vite toolchain; no test dependency or package script needed.
const { createRequire } = require('node:module')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const { mkdirSync, mkdtempSync, rmSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
mkdirSync(resolve(__dirname, '../../.tmp'), { recursive: true })
const dir = mkdtempSync(resolve(__dirname, '../../.tmp/idea-answer-tests-'))
try {
  const out = join(dir, 'tests.cjs')
  buildSync({ entryPoints: [join(__dirname, 'idea-answer.test.tsx')], outfile: out, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'warning' })
  const result = spawnSync(process.execPath, ['--test', out], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
