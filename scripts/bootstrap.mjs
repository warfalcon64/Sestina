#!/usr/bin/env node
/**
 * Bootstrap: copy the documentation system into a repo, or re-copy it into one that already runs it.
 *
 * Kit-only and never copied: it reads the kit it sits in and writes into the repo it is given. Node 18+ and nothing
 * else (no package.json, no install, no build step).
 *
 *   node <kit>/scripts/bootstrap.mjs <repo>              set up or re-copy
 *   node <kit>/scripts/bootstrap.mjs <repo> --dry-run    print what it would do, write nothing
 *   node <kit>/scripts/bootstrap.mjs <repo> --no-node    skip the scripts, .claude/settings.json and their ignores
 *
 * One idempotent sync, so the same command serves a first setup and every re-copy:
 * - the verbatim files (VERBATIM below) are overwritten when their bytes differ;
 * - docs/handoff.md takes the kit's header (everything before the first `## `) and keeps the repo's own notes, or is
 *   handed back when the text above that heading does not end with the header's last line;
 * - docs/adr/README.md takes the kit's prose (everything before the table) and keeps the repo's own table;
 * - .claude/settings.json gets the kit's handoff-hook groups in place of the repo's, keeping every other hook and key;
 * - .gitignore gets whichever of the kit's entries it lacks;
 * - the fill-in files under template/ are copied only on a first setup (no docs/workflow/project.md yet), and never
 *   over a file the repo already has.
 * Each path prints one line: created, updated, unchanged, kept, absent (a fill-in file a re-copy does not add), or
 * merge by hand with the reason. A file is written only when its bytes change, so a second run writes nothing.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notesOf } from './handoff-hook.mjs'

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE = 'template'
const HANDOFF = 'docs/handoff.md'
const ADR_INDEX = 'docs/adr/README.md'
const SETTINGS = '.claude/settings.json'
const GITIGNORE = '.gitignore'
const PROJECT = 'docs/workflow/project.md'
/** The hook's file name as a whole name, so a repo's own `my-handoff-hook.mjs` is not taken for it. */
const HOOK_NAME = /(^|[\s"'/])handoff-hook\.mjs/

/** Files copied byte for byte. `node` marks the ones --no-node skips. */
export const VERBATIM = [
  { path: 'docs/workflow/README.md' },
  { path: 'docs/workflow/01-brainstorm.md' },
  { path: 'docs/workflow/02-plan.md' },
  { path: 'docs/workflow/03-implement.md' },
  { path: 'docs/workflow/04-peer-review.md' },
  { path: 'docs/workflow/05-harden.md' },
  { path: 'docs/workflow/06-merge-prep.md' },
  { path: 'scripts/peer-review.mjs', node: true },
  { path: 'scripts/peer-review.test.mjs', node: true },
  { path: 'scripts/handoff-hook.mjs', node: true },
  { path: 'scripts/handoff-hook.test.mjs', node: true },
  { path: 'scripts/doc-check.mjs', node: true },
  { path: 'scripts/doc-check.test.mjs', node: true }
]

/** .gitignore entries the system needs. `node` marks the ones --no-node skips. */
export const IGNORES = [
  { entry: '.peer-review/', node: true },
  { entry: '.claude/handoff/', node: true },
  { entry: '.env' }
]

// ---------- pure helpers (exported for tests) ----------

/** A handoff with the kit's header and the repo's notes; the header alone when the repo has none (or no file). */
export function joinHandoff(kitText, repoText) {
  const kitNotes = notesOf(kitText)
  const header = (kitNotes ? kitText.slice(0, kitText.indexOf(kitNotes)) : kitText).trimEnd()
  const notes = notesOf(repoText ?? '')
  return notes ? `${header}\n\n${notes}\n` : `${header}\n`
}

/** The line every version of the handoff header has ended with. */
export const HEADER_END = /^Notes go below/

/**
 * Whether a handoff has text joinHandoff would drop: anything between the header's last line and the first `## `, or
 * a header that does not end with that line, which the sync cannot tell apart from notes. Nothing at all is fine.
 */
export function looseNotes(text) {
  const match = /^## /m.exec(text)
  const above = (match ? text.slice(0, match.index) : text).trimEnd()
  return above !== '' && !HEADER_END.test(above.split('\n').at(-1))
}

/** An ADR index split at its first line starting `|`: the prose before it and the table from it, or null for none. */
export function splitIndex(text) {
  const match = /^\|/m.exec(text)
  return match ? { prose: text.slice(0, match.index), table: text.slice(match.index) } : { prose: text, table: null }
}

/** Whether a settings hook runs the handoff hook. */
function isHandoffHook(hook) {
  return typeof hook?.command === 'string' && HOOK_NAME.test(hook.command)
}

/** Whether parsed settings have the shape mergeSettings handles: an object whose `hooks`, if any, map to arrays. */
export function mergeableSettings(settings) {
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  return isObject(settings) && (settings.hooks === undefined || (isObject(settings.hooks) && Object.values(settings.hooks).every(Array.isArray)))
}

/** A command that runs the handoff hook and nothing else: `node <path>/handoff-hook.mjs <event>`, path maybe quoted. */
const BARE_HOOK = /^node\s+("([^"]*\/)?handoff-hook\.mjs"|(\S*\/)?handoff-hook\.mjs)\s+[a-z-]+\s*$/

/**
 * Whether a settings object names the handoff hook in a command that does more than run it (`... && ./notify.sh`, a
 * node flag). mergeSettings would drop the whole command, and a shell line cannot be split safely, so the sync hands
 * such a file back.
 */
export function chainsHandoffHook(settings) {
  return Object.values(settings.hooks ?? {}).some((groups) =>
    Array.isArray(groups) && groups.some((group) => Array.isArray(group?.hooks) && group.hooks.some((hook) => isHandoffHook(hook) && !BARE_HOOK.test(hook.command)))
  )
}

/**
 * The repo's settings with, for each event the kit hooks, the repo's handoff-hook commands dropped (and a group left
 * empty by that) and the kit's groups appended. Every other hook and key is kept. `changed` is false when the result
 * equals the input.
 */
export function mergeSettings(repo, kit) {
  const merged = { ...repo, hooks: { ...(repo.hooks ?? {}) } }
  for (const [event, groups] of Object.entries(kit.hooks ?? {})) {
    const own = []
    for (const group of Array.isArray(merged.hooks[event]) ? merged.hooks[event] : []) {
      if (!Array.isArray(group?.hooks) || !group.hooks.some(isHandoffHook)) own.push(group)
      else {
        const rest = group.hooks.filter((hook) => !isHandoffHook(hook))
        if (rest.length) own.push({ ...group, hooks: rest })
      }
    }
    merged.hooks[event] = [...own, ...groups]
  }
  return { settings: merged, changed: JSON.stringify(merged) !== JSON.stringify(repo) }
}

/**
 * The entries a .gitignore lacks, matching each line without surrounding whitespace or a leading `/`. A line without a
 * trailing `/` covers files and directories alike, so it covers `<entry>/`; one with it covers directories only.
 */
export function gitignoreAdditions(text, entries) {
  const have = new Set((text ?? '').split('\n').map((line) => line.trim().replace(/^\/+/, '')))
  return entries.filter((entry) => !have.has(entry) && !(entry.endsWith('/') && have.has(entry.slice(0, -1))))
}

/** A .gitignore with `additions` appended, one per line. */
export function appendIgnores(text, additions) {
  const base = text ?? ''
  return base + (base && !base.endsWith('\n') ? '\n' : '') + additions.map((entry) => `${entry}\n`).join('')
}

export const USAGE = 'usage: node <kit>/scripts/bootstrap.mjs <repo> [--dry-run] [--no-node]'

/** The repo is the one positional argument. Anything unrecognised, and a second positional, lands in `unknown`. */
export function parseArgs(argv) {
  const out = { target: '', dryRun: false, node: true, unknown: [] }
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--no-node') out.node = false
    else if (arg === '--help' || arg === '-h') out.help = true
    else if (arg.startsWith('-') || out.target) out.unknown.push(arg)
    else out.target = arg
  }
  return out
}

// ---------- IO ----------

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/** Every file under `dir` but Finder's, as paths relative to it with `/` separators. */
function walk(dir, prefix = '') {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).filter((entry) => entry.name !== '.DS_Store').flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory() ? walk(dir, rel) : [rel]
  })
}

/** Sync the kit into `repo`, pushing one report line per path onto `lines` as it goes. */
function sync(repo, opts, lines) {
  const say = (status, path) => lines.push(`${status.padEnd(9)} ${path}`)
  const handBack = (why) => lines.push(`merge by hand: ${why}`)
  /** Write `content` to `rel` in the repo when its bytes differ, and say what happened. */
  const put = (rel, content) => {
    const path = join(repo, rel)
    const next = Buffer.from(content)
    const exists = existsSync(path)
    if (exists && readFileSync(path).equals(next)) return say('unchanged', rel)
    if (!opts.dryRun) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, next)
    }
    say(`${opts.dryRun ? 'would ' : ''}${exists ? (opts.dryRun ? 'update' : 'updated') : opts.dryRun ? 'create' : 'created'}`, rel)
  }
  // Judged before anything is written, so this run's own files do not count.
  const firstSetup = !existsSync(join(repo, PROJECT))

  for (const { path, node } of VERBATIM) if (opts.node || !node) put(path, readFileSync(join(KIT, path)))

  const repoHandoff = readText(join(repo, HANDOFF))
  if (repoHandoff !== null && looseNotes(repoHandoff)) handBack(`${HANDOFF}: the text above its first \`## \` does not end with the header's last line`)
  else put(HANDOFF, joinHandoff(readFileSync(join(KIT, HANDOFF), 'utf8'), repoHandoff))

  const kitIndex = readFileSync(join(KIT, ADR_INDEX), 'utf8')
  const repoIndex = readText(join(repo, ADR_INDEX))
  if (repoIndex === null) put(ADR_INDEX, kitIndex)
  else {
    const { table } = splitIndex(repoIndex)
    if (table === null) handBack(`${ADR_INDEX} has no table`)
    else put(ADR_INDEX, splitIndex(kitIndex).prose + table)
  }

  if (opts.node) {
    const kitSettings = readFileSync(join(KIT, SETTINGS), 'utf8')
    const repoSettings = readText(join(repo, SETTINGS))
    if (repoSettings === null) put(SETTINGS, kitSettings)
    else {
      let parsed = null
      try {
        parsed = JSON.parse(repoSettings)
      } catch {}
      if (!mergeableSettings(parsed)) {
        handBack(`${SETTINGS} is not a settings object with hooks as arrays`)
      } else if (chainsHandoffHook(parsed)) {
        handBack(`${SETTINGS} names the handoff hook in a command that does more than run it`)
      } else {
        const { settings, changed } = mergeSettings(parsed, JSON.parse(kitSettings))
        if (changed) put(SETTINGS, JSON.stringify(settings, null, 2) + '\n')
        else say('unchanged', SETTINGS)
      }
    }
  }

  const ignore = readText(join(repo, GITIGNORE))
  const additions = gitignoreAdditions(ignore, IGNORES.filter(({ node }) => opts.node || !node).map(({ entry }) => entry))
  if (additions.length) put(GITIGNORE, appendIgnores(ignore, additions))
  else say('unchanged', GITIGNORE)

  // project.md goes last, so a first setup that fails partway is still a first setup when it is run again; and there a
  // file that already matches its template (written by the failed run) is unchanged, not handed back.
  for (const rel of walk(join(KIT, TEMPLATE)).sort((a, b) => (a === PROJECT) - (b === PROJECT))) {
    // A re-copy never adds one: the repo may have deferred the map or deleted 0001-template.md on purpose.
    if (!firstSetup) say(existsSync(join(repo, rel)) ? 'kept' : 'absent', rel)
    else {
      const content = readFileSync(join(KIT, TEMPLATE, rel))
      if (existsSync(join(repo, rel)) && !readFileSync(join(repo, rel)).equals(content)) handBack(`${rel} exists and differs from ${TEMPLATE}/${rel}`)
      else put(rel, content)
    }
  }

  lines.push(
    '',
    opts.dryRun
      ? 'Nothing written: this was a dry run.'
      : firstSetup
      ? "Now fill in, in BOOTSTRAP §3's order."
      : `Read \`git diff\` in ${repo}. The fill-in files were kept, so docs/workflow/project.md and CLAUDE.md can still lag template/: compare them by hand.`
  )
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(USAGE)
    return
  }
  if (opts.unknown.length || !opts.target) {
    if (opts.unknown.length) console.error(`unknown argument: ${opts.unknown.join(', ')}`)
    console.error(USAGE)
    process.exitCode = 1
    return
  }
  const target = resolve(opts.target)
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    console.error(`no such directory: ${target}`)
    process.exitCode = 1
    return
  }
  const repo = realpathSync(target)
  const kit = realpathSync(KIT)
  if (repo === kit || repo.startsWith(kit + sep)) {
    console.error('the target is the kit itself or inside it: give the repo to copy into')
    process.exitCode = 1
    return
  }
  // On a failure partway, still say what was already written before the error.
  const lines = []
  try {
    sync(repo, opts, lines)
  } catch (err) {
    console.log(lines.join('\n'))
    console.error(`stopped: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
    return
  }
  console.log(lines.join('\n'))
}

// Only run when invoked directly, so the helpers above can be imported by tests.
if (process.argv[1] && process.argv[1].endsWith('bootstrap.mjs')) {
  main()
}
