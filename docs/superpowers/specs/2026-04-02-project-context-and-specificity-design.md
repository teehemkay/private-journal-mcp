# Project Context & Entry Specificity

**Date:** 2026-04-02
**Status:** Design approved

## Problem

Non-project journal entries (feelings, user_context, technical_insights, world_knowledge) are stored in `~/.private-journal/` and contain no record of which project they originated from. Project notes don't have this problem because their storage location (`.private-journal/` inside the project directory) provides implicit context.

Additionally, journal entries — especially feelings — often use vague self-references ("this was satisfying", "genuinely satisfied with this session") without naming the specific task, decision, or event being referenced. A future reader with no conversation context cannot understand what the entry is about.

## Design

### 1. Git Remote Detection

New file `src/git.ts` with a single exported function:

```typescript
async function detectGitRemote(directory: string): Promise<string | null>
```

Behavior:
- Runs `git remote get-url origin` in the given directory using `child_process`
- Parses the result into `owner/repo` form:
  - SSH format: `git@github.com:obra/private-journal.git` -> `obra/private-journal`
  - HTTPS format: `https://github.com/obra/private-journal.git` -> `obra/private-journal`
  - Strips trailing `.git`
- Returns `null` if: not a git repo, no remote configured, or command fails
- Never throws — all failures produce `null`

### 2. Server Startup Integration

`PrivateJournalServer` calls `detectGitRemote` once during startup (in `run()`, before connecting the transport). The project root is derived from `journalPath` by stripping the `.private-journal` suffix.

The detected project identifier is passed to `JournalManager` as an optional constructor parameter.

### 3. Frontmatter Changes

When writing user-global entries (to `userJournalPath`), `JournalManager` includes a `project` field in the YAML frontmatter:

```yaml
---
title: "2:08:09 PM - April 2, 2026"
date: 2026-04-02T12:08:09.517Z
timestamp: 1775131689517
project: obra/private-journal
---
```

Project-local entries (written to `projectJournalPath`) do not include this field — their location already provides the context.

The `project` field is omitted entirely (not set to null) when the git remote could not be detected.

The `project` value is also passed to `generateEmbeddingForEntry` so it can be stored in the `.embedding` sidecar file alongside the entry.

### 4. Embedding Data Changes

`EmbeddingData` in `src/embeddings.ts` gains an optional `project?: string` field. This is populated when generating embeddings for user-global entries, so that search results can surface the project context without re-reading the markdown file.

### 5. Search & Display Changes

When displaying search results and recent entries:
- Results that have a `project` field show it alongside the type: `(user - obra/private-journal)` instead of just `(user)`
- No new filter parameter for project name — can be added later if needed
- Existing `type` filter (`project`, `user`, `both`) continues to work unchanged

### 6. Specificity Nudges in Tool Descriptions

Update the `process_thoughts` tool descriptions in `server.ts` to encourage grounded, specific writing:

**`feelings`:** Add guidance: "Always name what specifically triggered the feeling — the task, conversation, decision, or discovery. 'Frustrated' needs a 'because...' and 'about [specific thing]'. A future reader with no conversation context should understand what you're referring to."

**`user_context`:** Add guidance: "Reference the specific interaction, decision, or moment — not just general patterns."

**`technical_insights` and `world_knowledge`:** Add lighter guidance: "Ground each insight in the specific situation where you learned it."

### 7. CLAUDE.md Journal Guidance

Add a principle to the journal checkpoint section in CLAUDE.md:

> Every journal entry must be self-contained — a future reader with no conversation context should understand what you're referring to. Name the specific task, file, conversation, decision, or event. Never use unanchored references like "this", "the session", or "what happened".

## Files Changed

| File | Change |
|------|--------|
| `src/git.ts` (new) | `detectGitRemote(dir): Promise<string \| null>` utility |
| `src/server.ts` | Call `detectGitRemote` at startup, pass to `JournalManager`; update tool descriptions |
| `src/journal.ts` | Accept `project` param, include in frontmatter for user-global entries |
| `src/types.ts` | Add `project?: string` to relevant interfaces |
| `src/embeddings.ts` | Add `project?: string` to `EmbeddingData` |
| `src/search.ts` | Surface `project` field in search/list results |
| `CLAUDE.md` | Add self-contained entry guidance to journal section |
| `README.md` | Update architecture/features documentation to reflect project context and specificity |
| `tests/` | Cover git URL parsing, frontmatter generation with project field, search result display |

## Out of Scope

- Backfilling project context onto existing entries
- Filtering search results by project name
- Changes to project-local entry format
