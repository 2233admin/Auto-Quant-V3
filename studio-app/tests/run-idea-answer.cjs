// Use the already-installed Vite toolchain; no test dependency or package script needed.
const { createRequire } = require('node:module')
const { buildSync } = createRequire(require.resolve('vite/package.json'))('esbuild')
const { mkdirSync, mkdtempSync, readdirSync, rmSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
mkdirSync(resolve(__dirname, '../../.tmp'), { recursive: true })
const dir = mkdtempSync(resolve(__dirname, '../../.tmp/idea-answer-tests-'))
try {
  // Every *.test.tsx beside this runner is bundled and run in one node --test invocation.
  const entries = readdirSync(__dirname).filter((name) => name.endsWith('.test.tsx')).sort()
  const outs = entries.map((name) => {
    const out = join(dir, name.replace(/\.tsx$/, '.cjs'))
    buildSync({ entryPoints: [join(__dirname, name)], outfile: out, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'warning' })
    return out
  })
  const result = spawnSync(process.execPath, ['--test', ...outs], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
