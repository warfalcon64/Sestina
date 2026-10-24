// Run with: node --test scripts/peer-review.test.mjs (Node 18+, nothing to install)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPack,
  estimateTokens,
  extractJson,
  fileDecision,
  foldChunk,
  keyFromFileText,
  looksBinary,
  normalizeReview,
  parseArgs,
  readStream,
  reasoningNote,
  requestBody,
  sseData
} from './peer-review.mjs'

/** The keys of `expected` match in `actual`; anything else in `actual` is ignored. */
function assertSubset(actual, expected) {
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, `key "${key}"`)
}

/** Run `fn` inside a fresh git repo with no commits, then clean up whatever happens. */
function inFreshRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'peer-review-test-'))
  const cwd = process.cwd()
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' })
    process.chdir(dir)
    fn(dir)
  } finally {
    process.chdir(cwd)
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('extractJson', () => {
  it('reads plain JSON, fenced JSON and JSON buried in prose', () => {
    assert.deepEqual(extractJson('{"summary":"ok","findings":[]}'), { summary: 'ok', findings: [] })
    assert.deepEqual(extractJson('```json\n{"summary":"ok"}\n```'), { summary: 'ok' })
    assert.deepEqual(extractJson('Here you go:\n{"summary":"ok"}\nHope that helps.'), { summary: 'ok' })
  })

  it('returns null rather than throwing on junk', () => {
    assert.equal(extractJson('no json here'), null)
    assert.equal(extractJson(''), null)
    assert.equal(extractJson(undefined), null)
  })
})

describe('normalizeReview', () => {
  it('sorts worst first, fills defaults and drops empty findings', () => {
    const r = normalizeReview({
      summary: '  two problems  ',
      findings: [
        { file: 'a.ts', severity: 'low', claim: 'small' },
        { file: 'b.ts', line: 12, severity: 'high', claim: 'big', scenario: 'on retry', confidence: 2 },
        { claim: '' },
        'nonsense'
      ]
    })
    assert.equal(r.summary, 'two problems')
    assert.deepEqual(
      r.findings.map((f) => f.severity),
      ['high', 'low']
    )
    assertSubset(r.findings[0], { file: 'b.ts', line: 12, confidence: 1 })
    assert.equal(r.findings[1].line, null)
  })

  it('survives a reply with no findings at all', () => {
    assert.deepEqual(normalizeReview({ summary: 'looks fine' }).findings, [])
    assert.deepEqual(normalizeReview(null), { summary: '', findings: [] })
  })
})

describe('fileDecision', () => {
  it('keeps ordinary source files and explains every skip', () => {
    assert.deepEqual(fileDecision('src/main/index.ts', 4000), { include: true, reason: '' })
    assert.equal(fileDecision('package-lock.json', 4000).reason, 'lockfile')
    assert.equal(fileDecision('go.sum', 4000).reason, 'lockfile')
    assert.equal(fileDecision('app/Gemfile.lock', 4000).reason, 'lockfile')
    assert.equal(fileDecision('docs/shot.png', 4000).reason, 'binary')
    assert.equal(fileDecision('src/gone.ts', null).reason, 'deleted')
    assert.equal(fileDecision('data/settings.json', 10, { ignored: true }).reason, 'git-ignored')
    assert.match(fileDecision('src/big.ts', 200 * 1024, { maxFileKb: 120 }).reason, /over the 120 KB cap/)
    assert.equal(fileDecision('src/big.ts', 200 * 1024, { maxFileKb: 500 }).include, true)
  })
})

describe('cli helpers', () => {
  it('defaults to the working tree and reads every flag', () => {
    assertSubset(parseArgs([]), { base: 'HEAD', dryRun: false, maxFileKb: 120, maxTokens: 400000, unknown: [] })
    assertSubset(
      parseArgs(['--base', 'main', '--model', 'x/y', '--focus', 'undo', '--dry-run', '--max-file-kb', '40', '--max-tokens', '50000']),
      { base: 'main', model: 'x/y', focus: 'undo', dryRun: true, maxFileKb: 40, maxTokens: 50000, unknown: [] }
    )
  })

  it('asks for max reasoning unless --effort names another level', () => {
    assertSubset(parseArgs([]), { effort: 'max' })
    assertSubset(parseArgs(['--effort', 'high']), { effort: 'high', unknown: [] })
    assertSubset(parseArgs(['--effort=low']), { effort: 'low', unknown: [] })
    assertSubset(parseArgs(['--effort', 'maximum']), { effort: 'max', unknown: ['--effort maximum'] })
  })

  it('accepts the --flag=value form', () => {
    assertSubset(parseArgs(['--base=main', '--max-tokens=1000', '--focus=the reducer']), {
      base: 'main',
      maxTokens: 1000,
      focus: 'the reducer',
      unknown: []
    })
  })

  it('reports an unknown flag and a flag with no value instead of dropping it', () => {
    assert.deepEqual(parseArgs(['--bogus']).unknown, ['--bogus'])
    assert.deepEqual(parseArgs(['--dry-run=yes']).unknown, ['--dry-run=yes'])
    assert.deepEqual(parseArgs(['--base']).unknown, ['--base (missing value)'])
    assert.equal(parseArgs(['--base']).base, 'HEAD')
  })

  it('keeps the default when a numeric flag is not a number', () => {
    assertSubset(parseArgs(['--max-tokens', 'lots']), { maxTokens: 400000, unknown: [] })
  })

  it('counts binaries and tokens', () => {
    assert.equal(looksBinary('plain text'), false)
    assert.equal(looksBinary('bad\u0000byte'), true)
    assert.equal(estimateTokens('a'.repeat(400)), 100)
  })
})

describe('keyFromFileText', () => {
  it('reads a bare key or a JSON field, and nothing else', () => {
    assert.equal(keyFromFileText('sk-or-abc\n'), 'sk-or-abc')
    assert.equal(keyFromFileText('{"openrouterApiKey": " sk-or-abc "}'), 'sk-or-abc')
    assert.equal(keyFromFileText('{"other": 1}'), '')
    assert.equal(keyFromFileText('{not json'), '')
    assert.equal(keyFromFileText('two words'), '')
    assert.equal(keyFromFileText(''), '')
  })

  it('reads an OPENROUTER_API_KEY line from a .env-style file', () => {
    assert.equal(keyFromFileText('OPENROUTER_API_KEY = sk-or-abc\n'), 'sk-or-abc')
    assert.equal(keyFromFileText('export OPENROUTER_API_KEY="sk-or-abc"'), 'sk-or-abc')
    assert.equal(keyFromFileText("OPENROUTER_API_KEY='sk-or-abc'"), 'sk-or-abc')
    assert.equal(keyFromFileText('# keys\r\nOTHER_KEY=1\r\nOPENROUTER_API_KEY=sk-or-abc\r\n'), 'sk-or-abc')
    assert.equal(keyFromFileText('OPENROUTER_API_KEY=sk-or-abc # note'), 'sk-or-abc')
    assert.equal(keyFromFileText('OPENROUTER_API_KEY="sk-or-abc" # note'), 'sk-or-abc')
    assert.equal(keyFromFileText('OPENROUTER_API_KEY='), '')
    assert.equal(keyFromFileText('OPENROUTER_API_KEY= # set me'), '')
    assert.equal(keyFromFileText('OPENROUTER_API_KEY="sk-or-abc'), '')
    assert.equal(keyFromFileText('OPENROUTER_API_KEY="sk-or-abc" "sk-or-xyz"'), '')
    assert.equal(keyFromFileText('OTHER=x'), '')
  })
})

describe('buildPack', () => {
  it('reviews everything in a repo with no commits yet', () => {
    inFreshRepo((dir) => {
      writeFileSync(join(dir, 'a.txt'), 'hello\n')
      writeFileSync(join(dir, 'staged.txt'), 'added before the first commit\n')
      execFileSync('git', ['add', 'staged.txt'], { stdio: 'ignore' })
      const pack = buildPack({ base: 'HEAD', maxFileKb: 120, focus: '' })
      assert.equal(pack.base, 'the empty tree (no commits yet)')
      assert.deepEqual([...pack.touched].sort(), ['a.txt', 'staged.txt'])
      assert.equal(pack.hasChanges, true)
      assert.equal(pack.fileCount, 2)
      assert.match(pack.text, /\+hello/)
      assert.match(pack.text, /\+added before the first commit/)
      // Each file's text is sent once, as its diff, not again as a pre-existing file.
      assert.equal(pack.text.split('added before the first commit').length - 1, 1)
      assert.doesNotMatch(pack.text, /that already existed/)
    })
  })

  it('leaves a tracked lockfile out of the diff it reports as skipped', () => {
    inFreshRepo((dir) => {
      mkdirSync(join(dir, 'web'))
      writeFileSync(join(dir, 'a.txt'), 'one\n')
      writeFileSync(join(dir, 'package-lock.json'), '{"lockfileVersion": 3}\n')
      writeFileSync(join(dir, 'web', 'yarn.lock'), 'old-nested-lock\n')
      execFileSync('git', ['add', '.'], { stdio: 'ignore' })
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], { stdio: 'ignore' })
      writeFileSync(join(dir, 'a.txt'), 'two\n')
      writeFileSync(join(dir, 'package-lock.json'), '{"lockfileVersion": 3, "changed": "root-lock"}\n')
      writeFileSync(join(dir, 'web', 'yarn.lock'), 'new-nested-lock\n')
      const pack = buildPack({ base: 'HEAD', maxFileKb: 120, focus: '' })
      assert.match(pack.text, /\+two/)
      assert.doesNotMatch(pack.text, /root-lock/)
      assert.doesNotMatch(pack.text, /nested-lock/)
      assert.ok(pack.skipped.includes('package-lock.json (lockfile)'))
      assert.ok(pack.skipped.includes('web/yarn.lock (lockfile)'))
    })
  })

  it('sends a file staged since the last commit once, as its diff', () => {
    inFreshRepo((dir) => {
      writeFileSync(join(dir, 'a.txt'), 'one\n')
      execFileSync('git', ['add', '.'], { stdio: 'ignore' })
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], { stdio: 'ignore' })
      writeFileSync(join(dir, 'staged.txt'), 'staged after the first commit\n')
      writeFileSync(join(dir, 'nul.txt'), 'a\u0000b')
      execFileSync('git', ['add', 'staged.txt', 'nul.txt'], { stdio: 'ignore' })
      const pack = buildPack({ base: 'HEAD', maxFileKb: 120, focus: '' })
      assert.deepEqual([...pack.touched].sort(), ['nul.txt', 'staged.txt'])
      assert.deepEqual(pack.skipped, ['nul.txt (binary)'])
      assert.equal(pack.fileCount, 1)
      assert.equal(pack.text.split('staged after the first commit').length - 1, 1)
      assert.doesNotMatch(pack.text, /that already existed/)
    })
  })

  it('keeps an oversized file out of the diff unless the diff itself fits', () => {
    inFreshRepo((dir) => {
      const big = (tag) => `${tag}\n${'x'.repeat(80)}\n`.repeat(40)
      writeFileSync(join(dir, 'small-edit.txt'), big('keep'))
      writeFileSync(join(dir, 'rewritten.txt'), big('old'))
      execFileSync('git', ['add', '.'], { stdio: 'ignore' })
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base'], { stdio: 'ignore' })
      writeFileSync(join(dir, 'small-edit.txt'), `one-line-edit\n${big('keep')}`)
      writeFileSync(join(dir, 'rewritten.txt'), big('rewritten-line'))
      writeFileSync(join(dir, 'staged-big.txt'), big('staged-big-line'))
      execFileSync('git', ['add', 'staged-big.txt'], { stdio: 'ignore' })
      const pack = buildPack({ base: 'HEAD', maxFileKb: 1, focus: '' })
      assert.match(pack.text, /\+one-line-edit/)
      assert.doesNotMatch(pack.text, /rewritten-line/)
      assert.doesNotMatch(pack.text, /staged-big-line/)
      assert.ok(pack.skipped.some((s) => s.startsWith('small-edit.txt (') && s.endsWith('its diff is included)')))
      assert.ok(pack.skipped.some((s) => s.startsWith('rewritten.txt (') && s.endsWith('its diff is left out too)')))
      assert.ok(pack.skipped.some((s) => s.startsWith('staged-big.txt (') && s.endsWith('its diff is left out too)')))
      assert.equal(pack.skipped.length, 3)
      assert.equal(pack.fileCount, 0)
    })
  })

  it('still refuses a base that does not exist', () => {
    inFreshRepo(() => {
      assert.throws(() => buildPack({ base: 'no-such-branch', maxFileKb: 120, focus: '' }), /Unknown base "no-such-branch"/)
    })
  })
})

describe('reasoning', () => {
  it('asks for the effort in a streamed JSON request', () => {
    assertSubset(requestBody({ model: 'x/y', prompt: 'p', effort: 'high' }), {
      model: 'x/y',
      reasoning: { effort: 'high' },
      response_format: { type: 'json_object' },
      stream: true,
      usage: { include: true }
    })
  })

  it('asks for max when no effort is passed on', () => {
    assertSubset(requestBody({ model: 'x/y', prompt: 'p' }), { reasoning: { effort: 'max' } })
  })

  it('warns when a reviewer asked to reason reports no reasoning tokens, or does not say', () => {
    const usage = (reasoning_tokens) => ({ completion_tokens_details: { reasoning_tokens } })
    assert.match(reasoningNote(usage(0), 'max'), /did not reason.*--effort none/)
    assert.equal(reasoningNote(usage(18882), 'max'), '')
    assert.match(reasoningNote({ completion_tokens: 60 }, 'max'), /did not say/)
    assert.match(reasoningNote(undefined, 'max'), /did not say/)
    assert.equal(reasoningNote(usage(0), 'none'), '')
    assert.equal(reasoningNote(undefined, 'none'), '')
  })
})

describe('streamed reply', () => {
  it('keeps complete data lines and holds back the unfinished one', () => {
    const { data, rest } = sseData(': OPENROUTER PROCESSING\n\ndata: {"a":1}\r\ndata: [DONE]\ndata: {"b"')
    assert.deepEqual(data, ['{"a":1}', '[DONE]'])
    assert.equal(rest, 'data: {"b"')
  })

  it('folds content, reasoning, model and usage', () => {
    let reply = { model: undefined, usage: undefined, content: '', received: 0 }
    reply = foldChunk(reply, { model: 'm', choices: [{ delta: { reasoning: 'hmm' } }] })
    reply = foldChunk(reply, { choices: [{ delta: { content: '{"summary"' } }] })
    reply = foldChunk(reply, { choices: [{ delta: { content: ':"ok"}' } }], usage: { prompt_tokens: 5, cost: 0.1 } })
    assertSubset(reply, { model: 'm', content: '{"summary":"ok"}', received: 19, usage: { prompt_tokens: 5, cost: 0.1 } })
  })

  it('throws on an error sent mid-stream', () => {
    assert.throws(() => foldChunk({ content: '', received: 0 }, { error: { message: 'provider died' } }), /provider died/)
  })

  /** What readStream makes of a body sent as these chunks (strings, or byte arrays to split a character). */
  async function streamed(...chunks) {
    const body = (async function* () {
      for (const chunk of chunks) yield typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
    })()
    const reply = await readStream({ body }, () => assert.fail('aborted'))
    return reply.choices[0].message.content
  }
  const delta = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`

  it('keeps a last data line that no newline follows', async () => {
    assert.equal(await streamed(`${delta('{"a"')}\n\n`, delta(':1}')), '{"a":1}')
  })

  it('keeps a character split across the last two chunks', async () => {
    const bytes = new TextEncoder().encode(delta('é'))
    const cut = bytes.indexOf(0xc3) + 1
    assert.equal(await streamed(bytes.slice(0, cut), bytes.slice(cut)), 'é')
  })

  it('drops a last payload cut mid-line and keeps what came before', async () => {
    assert.equal(await streamed(`${delta('{"a":1}')}\n\n`, 'data: {"usage":{"prom'), '{"a":1}')
  })

  it('skips a last [DONE] that no newline follows', async () => {
    assert.equal(await streamed(`${delta('ok')}\n\n`, 'data: [DONE]'), 'ok')
  })

  it('still throws on an error sent as the last line', async () => {
    await assert.rejects(streamed(`${delta('{"a"')}\n\n`, 'data: {"error":{"message":"provider died"}}'), /provider died/)
  })
})
