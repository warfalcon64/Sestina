#!/usr/bin/env node
/**
 * Handoff hook: keep docs/handoff.md and the current workflow phase in Claude's context, and nudge Claude once when a
 * turn ends without writing the handoff.
 *
 * A development tool, deliberately outside whatever the repo builds: Node 18+ and nothing else (no package.json, no
 * install, no build step), so it can be copied into a repo in any language. Claude Code runs it with the hook's JSON
 * on stdin; the project is CLAUDE_PROJECT_DIR, else the input's `cwd`.
 *
 *   node scripts/handoff-hook.mjs session-start   print the handoff's notes when it has any, then docs/workflow/README.md,
 *                                                 project.md and the current phase's file (01 + 02 when no change is in
 *                                                 progress); stdout joins Claude's context
 *   node scripts/handoff-hook.mjs prompt          record a hash of the handoff; when its phase moved since this session
 *                                                 last saw one, print the new phase's file (01 + 02 after the notes go)
 *   node scripts/handoff-hook.mjs post-tool       after ExitPlanMode before phase 3, print 03; after another tool, print the phase file
 *                                                 when the handoff's phase moved (never 01 + 02, never git)
 *   node scripts/handoff-hook.mjs stop            nudge once when the handoff is unchanged since the prompt while a
 *                                                 change is in progress (notes in the file, or a dirty git tree)
 *
 * The phase is `phase <n>` in the last `## ` heading of the handoff that names one; notes that name none leave it
 * unknown, and no phase file goes in. Phases 1 and 2 happen in plan mode, which cannot
 * write the handoff, so a change starts with 01 and 02 together. Each session's record, .claude/handoff/<session_id>.json,
 * holds `hash` (the handoff at the last prompt) and `phase` (the phase last put in context; null is the 01 + 02 start,
 * and no key means nothing yet).
 *
 * Wired in .claude/settings.json under hooks.SessionStart (no matcher, so startup, resume, clear and compact all fire),
 * hooks.UserPromptSubmit, hooks.PostToolUse (matcher Edit|Write|MultiEdit|Bash|ExitPlanMode) and hooks.Stop, each a
 * command hook running this script with its event. `.claude/handoff/` holds per-session records and is gitignored.
 *
 * Stop never loops: when Claude Code reports `stop_hook_active` (Claude is already continuing because of a Stop hook),
 * the turn is allowed to end. The nudge goes out as context rather than a block (a block shows as a hook error), and
 * asks for a one-line reply when there is nothing to keep, since an empty reply makes Claude Code ask again. Plan mode
 * is allowed too, since it cannot write the file. Any failure exits 0 silently, so a broken hook never wedges a turn.
 * Hook facts (input fields, the output shapes) are from code.claude.com/docs/en/hooks and a real `claude -p` run.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HANDOFF = join('docs', 'handoff.md')
const RECORD_DIR = join('.claude', 'handoff')
const WORKFLOW = join('docs', 'workflow')
const MISSING = 'missing'

export const NO_CHANGE_LEAD = "No change is in progress. Any change, Next up's included, starts at phase 1:"
export const PLAN_APPROVED_LEAD = 'The plan is approved: phase 3 (implement).'
export const WORKFLOW_LEAD = 'Every change walks the six phases in docs/workflow/:'

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

/** The phase (1–6) named by the handoff's last `## ` heading that names one, or null when none does. */
export function phaseOf(text) {
  const headings = (text ?? '').match(/^## .*$/gm) ?? []
  for (const heading of headings.reverse()) {
    const match = /\bphase\s+([1-6])\b/i.exec(heading)
    if (match) return Number(match[1])
  }
  return null
}

/** The workflow files a phase puts in context: 01 and 02 together at the start (null), else that phase's own. */
export function phaseFiles(phase) {
  return phase === null || phase === undefined ? [1, 2] : [phase]
}

/** The lead line above a phase's files. */
export function phaseLead(phase) {
  return phase === null || phase === undefined ? NO_CHANGE_LEAD : `The change in progress is at phase ${phase}; its workflow file follows:`
}

/** Injected text: the lead line, then each file's text (missing ones skipped), or '' when no file had text. */
export function contextText(lead, texts) {
  const present = texts.filter((text) => typeof text === 'string' && text.trim() !== '').map((text) => text.trimEnd())
  return present.length ? `${lead}\n\n${present.join('\n\n')}\n` : ''
}

/** Whether `phase` is news to a session whose record is `record` (a record without a `phase` key has seen nothing). */
export function phaseMoved(record, phase) {
  return !record || !Object.prototype.hasOwnProperty.call(record, 'phase') || record.phase !== phase
}

/** What PostToolUse prints: the text as context. */
export function postToolOutput(text) {
  return { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }
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

/** The session's record, or null when there is none or it is unreadable. */
function readRecord(path) {
  try {
    const record = JSON.parse(readFileSync(path, 'utf8'))
    return record && typeof record === 'object' ? record : null
  } catch {
    return null
  }
}

/** Merge `fields` into the session's record, keeping whatever else it holds. */
function writeRecord(path, record, fields) {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify({ ...(record ?? {}), ...fields }) + '\n')
}

/** The text of the workflow file starting `0<n>-`, or null when there is none. */
function phaseFileText(dir, n) {
  try {
    const name = readdirSync(join(dir, WORKFLOW)).find((file) => file.startsWith(`0${n}-`))
    return name ? readFileSync(join(dir, WORKFLOW, name), 'utf8') : null
  } catch {
    return null
  }
}

function phaseText(dir, phase, lead = phaseLead(phase)) {
  return contextText(lead, phaseFiles(phase).map((n) => phaseFileText(dir, n)))
}

function run(event, input) {
  const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd
  if (!dir) return
  const text = readText(join(dir, HANDOFF))
  const phase = phaseOf(text)
  // Notes that name no phase leave it unknown: no phase file then, rather than the no-change 01 + 02.
  const known = phase !== null || notesOf(text ?? '') === ''
  const name = recordName(input.session_id)
  const recordPath = name ? join(dir, RECORD_DIR, name) : null
  const record = recordPath ? readRecord(recordPath) : null
  if (event === 'session-start') {
    const workflow = [join(dir, WORKFLOW, 'README.md'), join(dir, WORKFLOW, 'project.md')].map((path) => {
      try {
        return readText(path)
      } catch {
        return null
      }
    })
    const parts = [sessionStartText(text ?? ''), contextText(WORKFLOW_LEAD, workflow), known ? phaseText(dir, phase) : '']
    process.stdout.write(parts.filter(Boolean).join('\n'))
    if (recordPath && known) writeRecord(recordPath, record, { phase })
    return
  }
  if (!recordPath) return
  if (event === 'prompt') {
    // Plain stdout from UserPromptSubmit joins Claude's context.
    const moved = known && phaseMoved(record, phase)
    if (moved) process.stdout.write(phaseText(dir, phase))
    writeRecord(recordPath, record, moved ? { hash: hashOf(text), phase } : { hash: hashOf(text) })
    return
  }
  if (event === 'post-tool') {
    let added = ''
    if (input.tool_name === 'ExitPlanMode') {
      // A plan approved mid-change (plan mode entered at a later phase) leaves the phase where the handoff has it.
      if (phase === null || phase < 3) {
        added = phaseText(dir, 3, PLAN_APPROVED_LEAD)
        writeRecord(recordPath, record, { phase: 3 })
      }
    } else if (phase !== null && phaseMoved(record, phase)) {
      // Only a named phase goes in here: 01 + 02 after every tool call of a session with no change would be noise, and
      // a handoff not yet rewritten after ExitPlanMode must not undo the 03 just given. The next prompt covers the rest.
      added = phaseText(dir, phase)
      writeRecord(recordPath, record, { phase })
    }
    if (added) process.stdout.write(JSON.stringify(postToolOutput(added)) + '\n')
    return
  }
  if (event === 'stop') {
    const hasNotes = notesOf(text ?? '') !== ''
    const decision = decideStop({
      stopHookActive: input.stop_hook_active === true,
      permissionMode: input.permission_mode,
      recorded: record?.hash ?? null,
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
