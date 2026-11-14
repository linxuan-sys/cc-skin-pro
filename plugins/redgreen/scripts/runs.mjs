// The parser's own reading of the vitest fixture, for scripts/demo.py to draw. Node 22.6+ (type stripping).
const { parse } = await import(new URL('../hooks/parse.ts', import.meta.url))
const { vitest } = await import(new URL('../tests/fixtures.ts', import.meta.url))

process.stdout.write(JSON.stringify(parse(vitest, 'vitest')))
