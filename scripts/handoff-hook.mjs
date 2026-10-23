#!/usr/bin/env node
/**
 * Handoff hook: keep docs/handoff.md in Claude's context, and nudge Claude once when a turn ends without writing it.
 *
 * A development tool, deliberately outside whatever the repo builds: Node 18+ and nothing else (no package.json, no
 * install, no build step), so it can be copied into a repo in any language. Claude Code runs it with the hook's JSON
 * on stdin; the project is CLAUDE_PROJECT_DIR, else the input's `cwd`.
 *
 *   node scripts/handoff-hook.mjs session-start   when the handoff has notes, print them (stdout joins Claude's context)
 *   node scripts/handoff-hook.mjs prompt          record a hash of the handoff in .claude/handoff/<session_id>.json
 *   node scripts/handoff-hook.mjs stop            block once when the handoff is unchanged since the prompt while a
 *                                                 change is in progress (notes in the file, or a dirty git tree)
 *
 * Wired in .claude/settings.json under hooks.SessionStart (no matcher, so startup, resume, clear and compact all fire),
 * hooks.UserPromptSubmit and hooks.Stop, each a command hook running this script with its event. `.claude/handoff/`
 * holds per-session records and is gitignored.
 *
 * Stop never loops: when Claude Code reports `stop_hook_active` (Claude is already continuing because of a Stop hook),
 * the turn is allowed to end. The nudge goes out as context rather than a block (a block shows as a hook error), and
 * asks for a one-line reply when there is nothing to keep, since an empty reply makes Claude Code ask again. Plan mode
 * is allowed too, since it cannot write the file. Any failure exits 0 silently, so a broken hook never wedges a turn.
 * Hook facts (input fields, the output shapes) are from code.claude.com/docs/en/hooks and a real `claude -p` run.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HANDOFF = join('docs', 'handoff.md')
const RECORD_DIR = join('.claude', 'handoff')
const MISSING = 'missing'

export const STOP_REASON =
  'docs/handoff.md was not written this turn. If this turn decided, found or built something worth keeping, add it there ' +
  'as its header says, and update its `Now:` line. If nothing is worth keeping, reply with only: Handoff: nothing to add.'

// ---------- pure helpers (exported for tests) ----------

/** The notes in a handoff: everything from the first `## ` line on, or '' when there are none. */
export function notesOf(text) {
  const match = /^## /m.exec(text ?? '')
  return match ? text.slice(match.index).trimEnd() : ''
}

/** What session-start prints: a lead line and the notes, or '' when there are none. */
export function sessionStartText(text) {
  const notes = notesOf(text)
  if (!notes) return ''
  return `A change is in progress; these notes from docs/handoff.md come first.\n\n${notes}\n`
}

/** The handoff's fingerprint: a sha256 of its contents, or a fixed marker when there is no file. */
export function hashOf(text) {
  return text === null ? MISSING : createHash('sha256').update(text).digest('hex')
}

/** A session id made safe to use as a file name, or '' when there is none. */
export function recordName(sessionId) {
  const safe = String(sessionId ?? '').replace(/[^A-Za-z0-9_-]/g, '_')
  return safe ? `${safe}.json` : ''
}

/**
 * Whether Stop should block. `recorded` is the hash taken at the prompt (null when there is no record), `current` the
 * hash now, `hasNotes` whether the handoff has notes, `dirty` whether git shows uncommitted work (false when git fails).
 */
export function decideStop({ stopHookActive, permissionMode, recorded, current, hasNotes, dirty }) {
  if (stopHookActive) return { block: false, why: 'loop guard' }
  if (permissionMode === 'plan') return { block: false, why: 'plan mode' }
  if (recorded === null || recorded === undefined) return { block: false, why: 'no record' }
  if (recorded !== current) return { block: false, why: 'written this turn' }
  if (current === MISSING) return { block: false, why: 'no handoff file' }
  if (!hasNotes && !dirty) return { block: false, why: 'no change in progress' }
  return { block: true, why: 'not written' }
}

/** What a blocking Stop prints: the reason as context, which continues the turn once. */
export function stopOutput() {
  return { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: STOP_REASON } }
}

// ---------- IO ----------

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

function isDirty(dir) {
  try {
    // The hook's own records never count, even where .gitignore misses them.
    return execFileSync('git', ['status', '--porcelain', '--', '.', ':(exclude).claude/handoff'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() !== ''
  } catch {
    return false
  }
}

function readRecord(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8')).hash ?? null
  } catch {
    return null
  }
}

function run(event, input) {
  const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd
  if (!dir) return
  const text = readText(join(dir, HANDOFF))
  if (event === 'session-start') {
    process.stdout.write(sessionStartText(text ?? ''))
    return
  }
  const name = recordName(input.session_id)
  if (!name) return
  const recordPath = join(dir, RECORD_DIR, name)
  if (event === 'prompt') {
    mkdirSync(join(dir, RECORD_DIR), { recursive: true })
    writeFileSync(recordPath, JSON.stringify({ hash: hashOf(text) }) + '\n')
    return
  }
  if (event === 'stop') {
    const hasNotes = notesOf(text ?? '') !== ''
    const decision = decideStop({
      stopHookActive: input.stop_hook_active === true,
      permissionMode: input.permission_mode,
      recorded: readRecord(recordPath),
      current: hashOf(text),
      hasNotes,
      // Only ask git when the answer matters.
      dirty: hasNotes ? true : isDirty(dir)
    })
    // Context, not a block: a block is shown as a hook error, and the turn continues the same way.
    if (decision.block) process.stdout.write(JSON.stringify(stopOutput()) + '\n')
  }
}

function main() {
  const event = process.argv[2]
  let input
  try {
    input = JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return
  }
  if (!input || typeof input !== 'object') return
  run(event, input)
}

// Only run when invoked directly, so the helpers above can be imported by tests. Never fail a turn.
if (process.argv[1] && process.argv[1].endsWith('handoff-hook.mjs')) {
  try {
    main()
  } catch {
    // Silent by design: a broken hook must not block or wedge Claude.
  }
  process.exitCode = 0
}
