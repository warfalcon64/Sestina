// Run with: node --test scripts/bootstrap.test.mjs (Node 18+, nothing to install)
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { VERBATIM, appendIgnores, chainsHandoffHook, gitignoreAdditions, joinHandoff, looseNotes, mergeSettings, mergeableSettings, parseArgs, splitIndex } from './bootstrap.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'bootstrap.mjs')
const KIT = join(dirname(SCRIPT), '..')
const kitText = (rel) => readFileSync(join(KIT, rel), 'utf8')
const HEADER = '# Handoff\n\nRules.\n\nNotes go below.\n'
const NOTE = '## Add export, phase 3 (implement), from abc1234\n- chose Word over PDF first\n'
const hook = (command) => ({ hooks: [{ type: 'command', command }] })

/** Run the script with `args`; returns its exit status and stdout lines. */
function runScript(...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  return { status: result.status, lines: result.stdout.split('\n').filter(Boolean), stderr: result.stderr }
}

/** The report lines that name a path (the closing note left out). */
const pathLines = (lines) => lines.filter((line) => !/^(Now |Read |Nothing written)/.test(line))

/** Run `fn` with a fresh temp dir, then clean up. */
function inTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'bootstrap-test-'))
  try {
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true })
  writeFileSync(join(dir, rel), text)
}

describe('joinHandoff', () => {
  it('keeps the kit header and drops the kit notes when the repo has none', () => {
    assert.equal(joinHandoff(`${HEADER}\n${NOTE}`, null), HEADER)
    assert.equal(joinHandoff(HEADER, '# Old header\n'), HEADER)
  })
  it('puts the repo notes under the kit header', () => {
    assert.equal(joinHandoff(`${HEADER}\n## Kit work, phase 2\n- x\n`, `# Old\n\n${NOTE}\n\n`), `${HEADER}\n${NOTE}`)
  })
})

describe('looseNotes', () => {
  it('finds any text between the header and the first heading, and only there', () => {
    assert.equal(looseNotes(`${HEADER}- decided X\n`), true)
    assert.equal(looseNotes(`${HEADER}Waiting on the owner.\n\n${NOTE}`), true)
    assert.equal(looseNotes(`${HEADER}\n${NOTE}- more\nNow: testing\n`), false)
    assert.equal(looseNotes(HEADER.replace(/\n/g, '\r\n')), false)
  })
  it('finds a header that does not end with the marker line, but not a missing one', () => {
    assert.equal(looseNotes(`# Old header\n\n${NOTE}`), true)
    assert.equal(looseNotes(NOTE), false)
    assert.equal(looseNotes('\n'), false)
  })
  it('passes the kit header, so a reworded last line fails here first', () => {
    assert.equal(looseNotes(joinHandoff(kitText('docs/handoff.md'), null)), false)
  })
})

describe('splitIndex', () => {
  it('splits at the first table line', () => {
    assert.deepEqual(splitIndex('# ADRs\n\nProse.\n\n| # | D |\n|---|---|\n| 0001 | x |\n'), { prose: '# ADRs\n\nProse.\n\n', table: '| # | D |\n|---|---|\n| 0001 | x |\n' })
  })
  it('keeps a table header written without a space after the pipe', () => {
    assert.equal(splitIndex('Prose.\n\n|#|D|\n|---|---|\n| 0001 | x |\n').table, '|#|D|\n|---|---|\n| 0001 | x |\n')
  })
  it('reports no table', () => {
    assert.equal(splitIndex('# ADRs\n\nNo rows yet.\n').table, null)
  })
})

describe('mergeSettings', () => {
  const kit = { hooks: { Stop: [hook('node "${CLAUDE_PROJECT_DIR}/scripts/handoff-hook.mjs" stop')] } }
  it('adds an absent group', () => {
    const { settings, changed } = mergeSettings({ model: 'x' }, kit)
    assert.ok(changed)
    assert.deepEqual(settings, { model: 'x', hooks: kit.hooks })
  })
  it('replaces a stale handoff-hook group and keeps a foreign hook', () => {
    const foreign = hook('npm run lint')
    const { settings, changed } = mergeSettings({ hooks: { Stop: [hook('node scripts/handoff-hook.mjs stop'), foreign], PreToolUse: [foreign] } }, kit)
    assert.ok(changed)
    assert.deepEqual(settings.hooks, { Stop: [foreign, ...kit.hooks.Stop], PreToolUse: [foreign] })
  })
  it('keeps a repo hook whose name only ends in handoff-hook.mjs', () => {
    const own = hook('node scripts/my-handoff-hook.mjs stop')
    const { settings } = mergeSettings({ hooks: { Stop: [own] } }, kit)
    assert.deepEqual(settings.hooks.Stop, [own, ...kit.hooks.Stop])
  })
  it('keeps a foreign command that shares a group with the handoff hook', () => {
    const notify = { type: 'command', command: './scripts/notify.sh' }
    const mixed = { matcher: 'x', hooks: [{ type: 'command', command: 'node scripts/handoff-hook.mjs stop' }, notify] }
    const { settings } = mergeSettings({ hooks: { Stop: [mixed] } }, kit)
    assert.deepEqual(settings.hooks.Stop, [{ matcher: 'x', hooks: [notify] }, ...kit.hooks.Stop])
  })
  it('reports no change when the groups are already there', () => {
    const { settings, changed } = mergeSettings(JSON.parse(JSON.stringify(kit)), kit)
    assert.equal(changed, false)
    assert.deepEqual(settings, kit)
  })
})

describe('mergeableSettings', () => {
  it('takes an object whose hooks map events to arrays, or that has no hooks', () => {
    assert.equal(mergeableSettings(JSON.parse(kitText('.claude/settings.json'))), true)
    assert.equal(mergeableSettings({ model: 'x' }), true)
  })
  it('refuses anything else', () => {
    for (const bad of [null, [], 'x', { hooks: [] }, { hooks: null }, { hooks: { Stop: 'echo paused' } }]) assert.equal(mergeableSettings(bad), false, JSON.stringify(bad))
  })
})

describe('chainsHandoffHook', () => {
  it('passes the bare hook, quoted or not, and the kit settings', () => {
    assert.equal(chainsHandoffHook({ hooks: { Stop: [hook('node scripts/handoff-hook.mjs stop')] } }), false)
    assert.equal(chainsHandoffHook({ hooks: { Stop: [hook('node "/a dir/scripts/handoff-hook.mjs" session-start')] } }), false)
    assert.equal(chainsHandoffHook(JSON.parse(kitText('.claude/settings.json'))), false)
    assert.equal(chainsHandoffHook({ model: 'x' }), false)
  })
  it('finds the hook chained with other work', () => {
    assert.equal(chainsHandoffHook({ hooks: { Stop: [hook('node scripts/handoff-hook.mjs stop && ./notify.sh')] } }), true)
  })
})

describe('gitignoreAdditions', () => {
  it('matches without whitespace or slashes', () => {
    assert.deepEqual(gitignoreAdditions(' /.peer-review \n.claude/handoff\n', ['.peer-review/', '.claude/handoff/', '.env']), ['.env'])
    assert.deepEqual(gitignoreAdditions(null, ['.env']), ['.env'])
  })
  it('does not take a directory-only line for a file entry', () => {
    assert.deepEqual(gitignoreAdditions('.env/\n.peer-review/\n', ['.peer-review/', '.env']), ['.env'])
  })
  it('appends on a line of its own', () => {
    assert.equal(appendIgnores('node_modules', ['.env']), 'node_modules\n.env\n')
    assert.equal(appendIgnores(null, ['.env', '.peer-review/']), '.env\n.peer-review/\n')
  })
})

describe('parseArgs', () => {
  it('takes one repo and the two flags, and keeps the rest as unknown', () => {
    assert.deepEqual(parseArgs(['r', '--dry-run', '--no-node']), { target: 'r', dryRun: true, node: false, unknown: [] })
    assert.deepEqual(parseArgs(['r', 's', '--force']).unknown, ['s', '--force'])
  })
})

describe('VERBATIM', () => {
  const listed = new Set(VERBATIM.map(({ path }) => path))
  it('names only files the kit has', () => {
    for (const path of listed) assert.ok(existsSync(join(KIT, path)), path)
  })
  it('lists every phase file and every script but bootstrap', () => {
    const phases = readdirSync(join(KIT, 'docs', 'workflow')).filter((name) => /^0.*\.md$/.test(name)).map((name) => `docs/workflow/${name}`)
    const scripts = readdirSync(join(KIT, 'scripts')).filter((name) => name.endsWith('.mjs') && !name.startsWith('bootstrap.')).map((name) => `scripts/${name}`)
    for (const path of ['docs/workflow/README.md', ...phases, ...scripts]) assert.ok(listed.has(path), `${path} is not in VERBATIM`)
  })
  it('never lists bootstrap itself, which is the kit\'s own tool', () => {
    for (const path of listed) assert.ok(!path.startsWith('scripts/bootstrap.'), path)
  })
  it('flags the scripts, and only them, as Node', () => {
    for (const { path, node } of VERBATIM) assert.equal(Boolean(node), path.startsWith('scripts/'), path)
  })
})

describe('bootstrap.mjs end to end', () => {
  it('sets up an empty dir, then a second run changes nothing', () => {
    inTempDir((dir) => {
      const first = runScript(dir)
      assert.equal(first.status, 0, first.stderr)
      assert.ok(pathLines(first.lines).every((line) => line.startsWith('created ')), first.lines.join('\n'))
      assert.ok(first.lines.includes("Now fill in, in BOOTSTRAP §3's order."))
      for (const { path } of VERBATIM) assert.equal(readFileSync(join(dir, path), 'utf8'), kitText(path), path)
      assert.equal(readFileSync(join(dir, 'docs/handoff.md'), 'utf8'), joinHandoff(kitText('docs/handoff.md'), null))
      assert.ok(!readFileSync(join(dir, 'docs/handoff.md'), 'utf8').includes('\n## '))
      assert.equal(readFileSync(join(dir, 'docs/adr/README.md'), 'utf8'), kitText('docs/adr/README.md'))
      assert.equal(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), kitText('.claude/settings.json'))
      assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), '.peer-review/\n.claude/handoff/\n.env\n')
      assert.equal(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), kitText('template/CLAUDE.md'))
      assert.equal(readFileSync(join(dir, 'docs/workflow/project.md'), 'utf8'), kitText('template/docs/workflow/project.md'))

      const second = runScript(dir)
      assert.equal(second.status, 0, second.stderr)
      assert.ok(pathLines(second.lines).every((line) => /^(unchanged|kept) /.test(line)), second.lines.join('\n'))
      assert.ok(second.lines.some((line) => line.startsWith('Read `git diff`')))
    })
  })

  it('re-copies into a repo that runs the system, keeping what it filled in', () => {
    inTempDir((dir) => {
      const foreign = hook('npm run lint')
      write(dir, 'docs/workflow/project.md', '# Project\nOurs.\n')
      write(dir, 'CLAUDE.md', '# Our repo\n')
      write(dir, 'docs/handoff.md', `# Old header\n\nNotes go below, old wording.\n\n${NOTE}`)
      write(dir, 'docs/adr/README.md', '# Old prose\n\n| # | Decision |\n|---|---|\n| 0001 | Ours |\n')
      write(dir, '.claude/settings.json', JSON.stringify({ model: 'x', hooks: { Stop: [hook('node scripts/handoff-hook.mjs stop'), foreign], PreToolUse: [foreign] } }))
      write(dir, 'docs/workflow/03-implement.md', '# Stale\n')
      write(dir, '.gitignore', 'node_modules/\n/.env\n')

      const result = runScript(dir)
      assert.equal(result.status, 0, result.stderr)
      assert.ok(result.lines.includes('updated   docs/workflow/03-implement.md'), result.lines.join('\n'))
      assert.ok(result.lines.includes('kept      CLAUDE.md'))
      assert.ok(result.lines.includes('absent    docs/architecture.md'))
      assert.equal(readFileSync(join(dir, 'docs/workflow/03-implement.md'), 'utf8'), kitText('docs/workflow/03-implement.md'))
      assert.equal(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), '# Our repo\n')
      assert.equal(readFileSync(join(dir, 'docs/workflow/project.md'), 'utf8'), '# Project\nOurs.\n')
      assert.equal(readFileSync(join(dir, 'docs/handoff.md'), 'utf8'), joinHandoff(kitText('docs/handoff.md'), NOTE))
      assert.ok(readFileSync(join(dir, 'docs/handoff.md'), 'utf8').endsWith(NOTE))
      const index = readFileSync(join(dir, 'docs/adr/README.md'), 'utf8')
      assert.equal(index, splitIndex(kitText('docs/adr/README.md')).prose + '| # | Decision |\n|---|---|\n| 0001 | Ours |\n')
      const settings = JSON.parse(readFileSync(join(dir, '.claude/settings.json'), 'utf8'))
      const kitHooks = JSON.parse(kitText('.claude/settings.json')).hooks
      assert.equal(settings.model, 'x')
      assert.deepEqual(settings.hooks.PreToolUse, [foreign])
      assert.deepEqual(settings.hooks.Stop, [foreign, ...kitHooks.Stop])
      assert.deepEqual(settings.hooks.SessionStart, kitHooks.SessionStart)
      assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), 'node_modules/\n/.env\n.peer-review/\n.claude/handoff/\n')
      assert.ok(!existsSync(join(dir, 'docs/architecture.md')))
      assert.ok(!existsSync(join(dir, 'docs/adr/0001-template.md')))

      const again = runScript(dir)
      assert.ok(pathLines(again.lines).every((line) => /^(unchanged|kept|absent) /.test(line)), again.lines.join('\n'))
    })
  })

  it('hands back a handoff with notes above its first heading, untouched', () => {
    inTempDir((dir) => {
      const loose = `${HEADER}\n- decided X\nNow: testing\n\n${NOTE}`
      write(dir, 'docs/workflow/project.md', '# Project\n')
      write(dir, 'docs/handoff.md', loose)
      const result = runScript(dir)
      assert.ok(result.lines.includes("merge by hand: docs/handoff.md: the text above its first `## ` does not end with the header's last line"), result.lines.join('\n'))
      assert.equal(readFileSync(join(dir, 'docs/handoff.md'), 'utf8'), loose)
    })
  })

  it('hands back a fill-in file the repo already has on a first setup, and an index without a table', () => {
    inTempDir((dir) => {
      write(dir, 'CLAUDE.md', '# Our repo\n')
      write(dir, 'docs/adr/README.md', '# ADRs\n\nNone yet.\n')
      const result = runScript(dir)
      assert.equal(result.status, 0, result.stderr)
      assert.ok(result.lines.includes('merge by hand: CLAUDE.md exists and differs from template/CLAUDE.md'), result.lines.join('\n'))
      assert.ok(result.lines.includes('merge by hand: docs/adr/README.md has no table'))
      assert.equal(readFileSync(join(dir, 'CLAUDE.md'), 'utf8'), '# Our repo\n')
      assert.equal(readFileSync(join(dir, 'docs/adr/README.md'), 'utf8'), '# ADRs\n\nNone yet.\n')
    })
  })

  it('reports what it wrote before a write fails, and exits 1', () => {
    inTempDir((dir) => {
      write(dir, 'docs/workflow/01-brainstorm.md/blocker', 'a directory where a file goes\n')
      const result = runScript(dir)
      assert.equal(result.status, 1)
      assert.deepEqual(result.lines, ['created   docs/workflow/README.md'])
      assert.match(result.stderr, /^stopped: /)
    })
  })

  it('finishes a first setup that failed partway when run again', () => {
    inTempDir((dir) => {
      write(dir, 'docs/glossary.md/blocker', 'a directory where a file goes\n')
      assert.equal(runScript(dir).status, 1)
      assert.ok(!existsSync(join(dir, 'docs/workflow/project.md')))
      rmSync(join(dir, 'docs/glossary.md'), { recursive: true })
      const again = runScript(dir)
      assert.equal(again.status, 0, again.stderr)
      assert.ok(!again.lines.some((line) => line.startsWith('merge by hand')), again.lines.join('\n'))
      assert.ok(again.lines.includes('created   docs/glossary.md'))
      assert.ok(again.lines.includes('created   docs/workflow/project.md'))
      assert.ok(again.lines.includes('unchanged CLAUDE.md'))
    })
  })

  it('hands back settings that are not JSON', () => {
    inTempDir((dir) => {
      write(dir, '.claude/settings.json', '{ not json')
      const result = runScript(dir)
      assert.ok(result.lines.includes('merge by hand: .claude/settings.json is not a settings object with hooks as arrays'), result.lines.join('\n'))
      assert.equal(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), '{ not json')
    })
  })

  it('hands back settings that chain the handoff hook with other work, untouched', () => {
    inTempDir((dir) => {
      const chained = JSON.stringify({ hooks: { Stop: [hook('node scripts/handoff-hook.mjs stop && ./notify.sh')] } })
      write(dir, '.claude/settings.json', chained)
      const result = runScript(dir)
      assert.ok(result.lines.includes('merge by hand: .claude/settings.json names the handoff hook in a command that does more than run it'), result.lines.join('\n'))
      assert.equal(readFileSync(join(dir, '.claude/settings.json'), 'utf8'), chained)
    })
  })

  it('writes nothing in a dry run', () => {
    inTempDir((dir) => {
      const result = runScript(dir, '--dry-run')
      assert.equal(result.status, 0, result.stderr)
      assert.ok(pathLines(result.lines).every((line) => line.startsWith('would create ')), result.lines.join('\n'))
      assert.equal(result.lines.at(-1), 'Nothing written: this was a dry run.')
      assert.deepEqual(readdirSync(dir), [])
    })
  })

  it('writes no scripts, settings or their ignores with --no-node', () => {
    inTempDir((dir) => {
      const result = runScript(dir, '--no-node')
      assert.equal(result.status, 0, result.stderr)
      assert.ok(!existsSync(join(dir, 'scripts')))
      assert.ok(!existsSync(join(dir, '.claude')))
      assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), '.env\n')
      assert.ok(existsSync(join(dir, 'docs/workflow/01-brainstorm.md')))
    })
  })

  // The kit cases are dry runs, so a broken refusal cannot write into the kit.
  it('refuses the kit itself, a dir inside it, a link to it, a missing dir and bad arguments', () => {
    assert.equal(runScript(KIT, '--dry-run').status, 1)
    assert.equal(runScript(join(KIT, 'template'), '--dry-run').status, 1)
    inTempDir((dir) => {
      symlinkSync(KIT, join(dir, 'kit'))
      assert.equal(runScript(join(dir, 'kit'), '--dry-run').status, 1)
      assert.equal(runScript(join(dir, 'missing')).status, 1)
      assert.equal(runScript(dir, '--force').status, 1)
      assert.equal(runScript().status, 1)
      assert.deepEqual(readdirSync(dir), ['kit'])
    })
  })
})
