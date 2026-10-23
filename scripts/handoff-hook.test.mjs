// Run with: node --test scripts/handoff-hook.test.mjs (Node 18+, nothing to install)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decideStop, hashOf, notesOf, recordName, sessionStartText, stopOutput } from './handoff-hook.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'handoff-hook.mjs')
const HEADER = '# Handoff\n\nNotes on the change in progress. Keep them short.\n\nNow: nothing.\n'
const NOTE = '## Add export, phase 3 (implement), from abc1234\n- chose Word over PDF first\n'

/** Run `fn` inside a fresh git repo with a .gitignore and a committed header-only handoff, then clean up. */
function inFreshRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'handoff-hook-test-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
    git('init', '-q')
    writeFileSync(join(dir, '.gitignore'), '.claude/handoff/\n')
    mkdirSync(join(dir, 'docs'))
    writeFileSync(join(dir, 'docs', 'handoff.md'), HEADER)
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Run the hook for `event` with `input` (an object, or a raw string) in `dir`; returns its stdout. */
function hook(dir, event, input) {
  const text = typeof input === 'string' ? input : JSON.stringify({ session_id: 's1', cwd: dir, ...input })
  return execFileSync('node', [SCRIPT, event], { input: text, env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8' })
}

const handoff = (dir) => join(dir, 'docs', 'handoff.md')

describe('notesOf', () => {
  it('returns everything from the first ## line on', () => {
    assert.equal(notesOf(HEADER + '\n' + NOTE), NOTE.trimEnd())
  })

  it('returns empty for a header-only file, no text, or ## not at a line start', () => {
    assert.equal(notesOf(HEADER), '')
    assert.equal(notesOf(''), '')
    assert.equal(notesOf(undefined), '')
    assert.equal(notesOf('# Handoff\nsee the ## below\n### deeper\n'), '')
  })
})

describe('sessionStartText', () => {
  it('leads with one line, then the notes', () => {
    const out = sessionStartText(HEADER + NOTE)
    assert.match(out.split('\n')[0], /change is in progress.*docs\/handoff\.md/)
    assert.ok(out.includes(NOTE.trimEnd()))
    assert.ok(!out.includes('# Handoff'))
  })

  it('is empty without notes', () => {
    assert.equal(sessionStartText(HEADER), '')
  })
})

describe('hashOf and recordName', () => {
  it('hashes contents and marks a missing file', () => {
    assert.equal(hashOf('a'), hashOf('a'))
    assert.notEqual(hashOf('a'), hashOf('b'))
    assert.equal(hashOf(null), 'missing')
  })

  it('keeps a session id from leaving the folder', () => {
    assert.equal(recordName('abc-123_x'), 'abc-123_x.json')
    assert.equal(recordName('../../etc/passwd'), '______etc_passwd.json')
    assert.equal(recordName(undefined), '')
  })
})

describe('decideStop', () => {
  const base = { stopHookActive: false, permissionMode: 'default', recorded: 'h', current: 'h', hasNotes: true, dirty: false }

  it('blocks an unchanged handoff while a change is in progress', () => {
    assert.equal(decideStop(base).block, true)
    assert.equal(decideStop({ ...base, hasNotes: false, dirty: true }).block, true)
  })

  it('allows on the loop guard, plan mode, no record, a write, or no change in progress', () => {
    assert.equal(decideStop({ ...base, stopHookActive: true }).block, false)
    assert.equal(decideStop({ ...base, permissionMode: 'plan' }).block, false)
    assert.equal(decideStop({ ...base, recorded: null }).block, false)
    assert.equal(decideStop({ ...base, current: 'other' }).block, false)
    assert.equal(decideStop({ ...base, hasNotes: false, dirty: false }).block, false)
    assert.equal(decideStop({ ...base, recorded: 'missing', current: 'missing', dirty: true }).block, false)
  })
})

describe('the script', () => {
  it('session-start prints the notes, and nothing for a header-only file', () => {
    inFreshRepo((dir) => {
      assert.equal(hook(dir, 'session-start', { source: 'startup' }), '')
      appendFileSync(handoff(dir), NOTE)
      const out = hook(dir, 'session-start', { source: 'compact' })
      assert.ok(out.includes(NOTE.trimEnd()))
      assert.ok(!out.includes('# Handoff'))
    })
  })

  it('blocks a stop after a prompt with no edit while notes are present', () => {
    inFreshRepo((dir) => {
      appendFileSync(handoff(dir), NOTE)
      assert.equal(hook(dir, 'prompt', { prompt: 'go' }), '')
      assert.deepEqual(JSON.parse(hook(dir, 'stop', {})), stopOutput())
    })
  })

  it('allows a stop when the handoff was edited this turn', () => {
    inFreshRepo((dir) => {
      appendFileSync(handoff(dir), NOTE)
      hook(dir, 'prompt', {})
      appendFileSync(handoff(dir), '- found the bug\n')
      assert.equal(hook(dir, 'stop', {}), '')
    })
  })

  it('allows on stop_hook_active and in plan mode', () => {
    inFreshRepo((dir) => {
      appendFileSync(handoff(dir), NOTE)
      hook(dir, 'prompt', {})
      assert.equal(hook(dir, 'stop', { stop_hook_active: true }), '')
      assert.equal(hook(dir, 'stop', { permission_mode: 'plan' }), '')
    })
  })

  it('allows a header-only handoff on a clean tree, and blocks it on a dirty one', () => {
    inFreshRepo((dir) => {
      hook(dir, 'prompt', {})
      assert.equal(hook(dir, 'stop', {}), '')
      writeFileSync(join(dir, 'work.txt'), 'x')
      assert.deepEqual(JSON.parse(hook(dir, 'stop', {})), stopOutput())
    })
  })

  it('does not count its own records as work, even where .gitignore misses them', () => {
    inFreshRepo((dir) => {
      writeFileSync(join(dir, '.gitignore'), '')
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'unignore'], { cwd: dir, stdio: 'ignore' })
      hook(dir, 'prompt', {})
      assert.equal(hook(dir, 'stop', {}), '')
    })
  })

  it('allows a header-only handoff outside a git repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'handoff-hook-test-'))
    try {
      mkdirSync(join(dir, 'docs'))
      writeFileSync(handoff(dir), HEADER)
      hook(dir, 'prompt', {})
      assert.equal(hook(dir, 'stop', {}), '')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('allows when there is no record for the session', () => {
    inFreshRepo((dir) => {
      appendFileSync(handoff(dir), NOTE)
      hook(dir, 'prompt', { session_id: 'other' })
      assert.equal(hook(dir, 'stop', {}), '')
    })
  })

  it('exits 0 with no output on garbage stdin or an unknown event', () => {
    inFreshRepo((dir) => {
      appendFileSync(handoff(dir), NOTE)
      for (const event of ['session-start', 'prompt', 'stop']) assert.equal(hook(dir, event, 'not json {'), '')
      assert.equal(hook(dir, 'nonsense', {}), '')
    })
  })
})
