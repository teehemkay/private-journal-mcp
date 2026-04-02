# Project Context & Entry Specificity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add git remote-based project context to non-project journal entries and nudge Claude toward writing more specific, self-contained entries.

**Architecture:** Detect `owner/repo` from git remote at server startup, thread it through to `JournalManager` for inclusion in YAML frontmatter and embedding sidecar data. Update tool descriptions and CLAUDE.md with specificity guidance.

**Tech Stack:** TypeScript, Node.js `child_process`, Jest

**Spec:** `docs/superpowers/specs/2026-04-02-project-context-and-specificity-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/git.ts` (new) | Git remote detection and URL parsing |
| `tests/git.test.ts` (new) | Tests for git remote detection |
| `src/embeddings.ts` | Add `project` field to `EmbeddingData` |
| `src/journal.ts` | Accept and write `project` to frontmatter for user-global entries |
| `src/server.ts` | Startup integration + tool description updates |
| `src/search.ts` | Surface `project` in search/list results |
| `CLAUDE.md` | Journal specificity guidance |
| `README.md` | Update architecture/features docs |

---

### Task 1: Git Remote Detection — URL Parsing

**Files:**
- Create: `src/git.ts`
- Create: `tests/git.test.ts`

- [ ] **Step 1: Write failing tests for URL parsing**

Create `tests/git.test.ts`:

```typescript
// ABOUTME: Unit tests for git remote detection and URL parsing
// ABOUTME: Tests URL normalization across SSH, HTTPS, and edge cases

import { parseGitRemoteUrl } from '../src/git';

describe('parseGitRemoteUrl', () => {
  test('parses SSH colon format', () => {
    expect(parseGitRemoteUrl('git@github.com:obra/private-journal.git'))
      .toBe('obra/private-journal');
  });

  test('parses SSH URL format', () => {
    expect(parseGitRemoteUrl('ssh://git@github.com/obra/private-journal.git'))
      .toBe('obra/private-journal');
  });

  test('parses SSH URL with port', () => {
    expect(parseGitRemoteUrl('ssh://git@gitlab.example.com:2222/obra/private-journal.git'))
      .toBe('obra/private-journal');
  });

  test('parses HTTPS format', () => {
    expect(parseGitRemoteUrl('https://github.com/obra/private-journal.git'))
      .toBe('obra/private-journal');
  });

  test('parses HTTPS without .git suffix', () => {
    expect(parseGitRemoteUrl('https://github.com/obra/private-journal'))
      .toBe('obra/private-journal');
  });

  test('handles GitLab nested namespaces', () => {
    expect(parseGitRemoteUrl('git@gitlab.com:org/team/repo.git'))
      .toBe('org/team/repo');
  });

  test('handles GitLab nested namespaces via HTTPS', () => {
    expect(parseGitRemoteUrl('https://gitlab.com/org/team/repo.git'))
      .toBe('org/team/repo');
  });

  test('returns null for empty string', () => {
    expect(parseGitRemoteUrl('')).toBeNull();
  });

  test('returns null for malformed URL', () => {
    expect(parseGitRemoteUrl('not-a-url')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/git.test.ts -v`
Expected: FAIL — module `../src/git` does not exist

- [ ] **Step 3: Implement `parseGitRemoteUrl`**

Create `src/git.ts`:

```typescript
// ABOUTME: Git remote detection for project context in journal entries
// ABOUTME: Parses git remote URLs into normalized owner/repo identifiers

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Parses a git remote URL into a normalized path identifier (everything after the host).
 * Returns null if the URL cannot be parsed.
 *
 * Handles:
 * - SSH colon: git@github.com:owner/repo.git
 * - SSH URL: ssh://git@host/owner/repo.git
 * - SSH URL with port: ssh://git@host:port/owner/repo.git
 * - HTTPS: https://host/owner/repo.git
 * - Nested namespaces: git@gitlab.com:org/team/repo.git
 */
export function parseGitRemoteUrl(url: string): string | null {
  if (!url || url.trim() === '') return null;

  const trimmed = url.trim();

  // SSH colon format: git@host:path.git
  const sshColonMatch = trimmed.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
  if (sshColonMatch) {
    return sshColonMatch[1];
  }

  // URL format (ssh://, https://, http://)
  try {
    const parsed = new URL(trimmed);
    let pathname = parsed.pathname;
    // Strip leading slash and trailing .git
    pathname = pathname.replace(/^\//, '').replace(/\.git$/, '');
    if (pathname.length > 0) {
      return pathname;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

/**
 * Detects the git remote origin for a directory and returns
 * a normalized identifier (e.g., "owner/repo").
 * Returns null if detection fails for any reason.
 */
export async function detectGitRemote(directory: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
      cwd: directory,
      timeout: 5000,
    });
    return parseGitRemoteUrl(stdout);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/git.test.ts -v`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/git.ts tests/git.test.ts
git commit -m "feat: Add git remote URL parsing for project context"
```

---

### Task 2: Git Remote Detection — `detectGitRemote` Integration Test

**Files:**
- Modify: `tests/git.test.ts`

- [ ] **Step 1: Write failing test for `detectGitRemote`**

Add to `tests/git.test.ts`:

```typescript
import { detectGitRemote } from '../src/git';
import * as path from 'path';
import * as os from 'os';

describe('detectGitRemote', () => {
  test('detects remote for a real git repo (this repo)', async () => {
    // This repo should have an origin remote
    const result = await detectGitRemote(process.cwd());
    // We can't assert the exact value, but it should be non-null and contain a slash
    expect(result).not.toBeNull();
    expect(result).toContain('/');
  });

  test('returns null for non-git directory', async () => {
    const tempDir = await import('fs/promises').then(fs =>
      fs.mkdtemp(path.join(os.tmpdir(), 'git-test-'))
    );
    try {
      const result = await detectGitRemote(tempDir);
      expect(result).toBeNull();
    } finally {
      await import('fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }));
    }
  });

  test('returns null for nonexistent directory', async () => {
    const result = await detectGitRemote('/nonexistent/path/that/does/not/exist');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest tests/git.test.ts -v`
Expected: All 12 tests PASS (the new tests should pass immediately since `detectGitRemote` is already implemented)

- [ ] **Step 3: Commit**

```bash
git add tests/git.test.ts
git commit -m "test: Add integration tests for detectGitRemote"
```

---

### Task 3: Add `project` Field to Types and Embeddings

**Files:**
- Modify: `src/types.ts`
- Modify: `src/embeddings.ts`

- [ ] **Step 1: Add `project` to `ProcessThoughtsRequest` in `src/types.ts`**

This isn't strictly needed for the internal flow (project comes from the server, not the tool call), but the interface documents the domain model. Actually — on reflection, `ProcessThoughtsRequest` models the tool input, not internal state. The `project` field is internal state. Leave `types.ts` alone.

Add `project` to `EmbeddingData` in `src/embeddings.ts`. Change the interface:

```typescript
export interface EmbeddingData {
  embedding: number[];
  text: string;
  sections: string[];
  timestamp: number;
  path: string;
  project?: string;
}
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

Run: `npx jest -v`
Expected: All existing tests PASS (adding an optional field is non-breaking)

- [ ] **Step 3: Commit**

```bash
git add src/embeddings.ts
git commit -m "feat: Add optional project field to EmbeddingData"
```

---

### Task 4: Thread `project` Through `JournalManager`

**Files:**
- Modify: `src/journal.ts`
- Modify: `tests/journal.test.ts`

- [ ] **Step 1: Write failing test — project in user-global frontmatter**

Add to `tests/journal.test.ts`:

```typescript
test('includes project in user-global entry frontmatter when provided', async () => {
  const customJournalManager = new JournalManager(projectTempDir, undefined, 'obra/private-journal');
  const thoughts = {
    feelings: 'Excited about project context feature'
  };

  await customJournalManager.writeThoughts(thoughts);

  const today = new Date();
  const dateString = getFormattedDate(today);
  const userDayDir = path.join(userTempDir, '.private-journal', dateString);

  const userFiles = await fs.readdir(userDayDir);
  const mdFile = userFiles.find(f => f.endsWith('.md'));
  const userContent = await fs.readFile(path.join(userDayDir, mdFile!), 'utf8');

  expect(userContent).toContain('project: obra/private-journal');
});
```

- [ ] **Step 2: Write failing test — no project in project-local frontmatter**

Add to `tests/journal.test.ts`:

```typescript
test('does not include project in project-local entry frontmatter', async () => {
  const customJournalManager = new JournalManager(projectTempDir, undefined, 'obra/private-journal');
  const thoughts = {
    project_notes: 'Architecture looks solid'
  };

  await customJournalManager.writeThoughts(thoughts);

  const today = new Date();
  const dateString = getFormattedDate(today);
  const projectDayDir = path.join(projectTempDir, dateString);

  const projectFiles = await fs.readdir(projectDayDir);
  const mdFile = projectFiles.find(f => f.endsWith('.md'));
  const projectContent = await fs.readFile(path.join(projectDayDir, mdFile!), 'utf8');

  expect(projectContent).not.toContain('project:');
});
```

- [ ] **Step 3: Write failing test — no project field when not provided**

Add to `tests/journal.test.ts`:

```typescript
test('omits project from frontmatter when not provided', async () => {
  const thoughts = {
    feelings: 'Testing without project context'
  };

  await journalManager.writeThoughts(thoughts);

  const today = new Date();
  const dateString = getFormattedDate(today);
  const userDayDir = path.join(userTempDir, '.private-journal', dateString);

  const userFiles = await fs.readdir(userDayDir);
  const mdFile = userFiles.find(f => f.endsWith('.md'));
  const userContent = await fs.readFile(path.join(userDayDir, mdFile!), 'utf8');

  expect(userContent).not.toContain('project:');
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest tests/journal.test.ts -v`
Expected: The first test FAILS (constructor doesn't accept 3rd param yet, or frontmatter doesn't have `project`)

- [ ] **Step 5: Implement — modify `JournalManager` constructor**

In `src/journal.ts`, update the constructor to accept an optional `project` parameter:

```typescript
constructor(projectJournalPath: string, userJournalPath?: string, project?: string) {
  this.projectJournalPath = projectJournalPath;
  this.userJournalPath = userJournalPath || resolveUserJournalPath();
  this.project = project || null;
  this.embeddingService = EmbeddingService.getInstance();
}
```

Add the private field:

```typescript
private project: string | null;
```

- [ ] **Step 6: Implement — update `formatThoughts` to accept and write project**

Update `writeThoughtsToLocation` to accept an `isUserGlobal` flag, and update `formatThoughts` to conditionally include the `project` field:

In `writeThoughts`:
```typescript
// Write project notes to project directory
if (projectThoughts.project_notes) {
  await this.writeThoughtsToLocation(projectThoughts, timestamp, this.projectJournalPath, false);
}

// Write user thoughts to user directory
const hasUserContent = Object.values(userThoughts).some(value => value !== undefined);
if (hasUserContent) {
  await this.writeThoughtsToLocation(userThoughts, timestamp, this.userJournalPath, true);
}
```

Update `writeThoughtsToLocation` signature:
```typescript
private async writeThoughtsToLocation(
  thoughts: { ... },
  timestamp: Date,
  basePath: string,
  isUserGlobal: boolean = false
): Promise<void> {
```

Pass `isUserGlobal` to `formatThoughts`:
```typescript
const formattedEntry = this.formatThoughts(thoughts, timestamp, isUserGlobal);
```

Also pass `this.project` to `generateEmbeddingForEntry` when `isUserGlobal` is true:
```typescript
await this.generateEmbeddingForEntry(filePath, formattedEntry, timestamp, isUserGlobal ? this.project : null);
```

Update `formatThoughts` to conditionally include `project`:
```typescript
private formatThoughts(thoughts: { ... }, timestamp: Date, isUserGlobal: boolean = false): string {
  // ... existing time/date display code ...

  const projectLine = (isUserGlobal && this.project) ? `\nproject: ${this.project}` : '';

  return `---
title: "${timeDisplay} - ${dateDisplay}"
date: ${timestamp.toISOString()}
timestamp: ${timestamp.getTime()}${projectLine}
---

${sections.join('\n\n')}
`;
}
```

- [ ] **Step 7: Implement — pass project to embedding generation**

Update `generateEmbeddingForEntry` to accept and store project:

```typescript
private async generateEmbeddingForEntry(
  filePath: string,
  content: string,
  timestamp: Date,
  project: string | null = null
): Promise<void> {
  try {
    const { text, sections } = this.embeddingService.extractSearchableText(content);
    
    if (text.trim().length === 0) {
      return;
    }

    const embedding = await this.embeddingService.generateEmbedding(text);
    
    const embeddingData: EmbeddingData = {
      embedding,
      text,
      sections,
      timestamp: timestamp.getTime(),
      path: filePath,
      ...(project ? { project } : {}),
    };

    await this.embeddingService.saveEmbedding(filePath, embeddingData);
  } catch (error) {
    console.error(`Failed to generate embedding for ${filePath}:`, error);
  }
}
```

- [ ] **Step 8: Write test — project in user-global `.embedding` sidecar**

Add to `tests/journal.test.ts`:

```typescript
test('includes project in user-global embedding sidecar when provided', async () => {
  const customJournalManager = new JournalManager(projectTempDir, undefined, 'obra/private-journal');
  const thoughts = {
    feelings: 'Testing embedding sidecar project field'
  };

  await customJournalManager.writeThoughts(thoughts);

  const today = new Date();
  const dateString = getFormattedDate(today);
  const userDayDir = path.join(userTempDir, '.private-journal', dateString);

  const userFiles = await fs.readdir(userDayDir);
  const embeddingFile = userFiles.find(f => f.endsWith('.embedding'));
  expect(embeddingFile).toBeDefined();

  const embeddingContent = await fs.readFile(path.join(userDayDir, embeddingFile!), 'utf8');
  const embeddingData = JSON.parse(embeddingContent);

  expect(embeddingData.project).toBe('obra/private-journal');
});

test('omits project from project-local embedding sidecar', async () => {
  const customJournalManager = new JournalManager(projectTempDir, undefined, 'obra/private-journal');
  const thoughts = {
    project_notes: 'Testing project-local embedding'
  };

  await customJournalManager.writeThoughts(thoughts);

  const today = new Date();
  const dateString = getFormattedDate(today);
  const projectDayDir = path.join(projectTempDir, dateString);

  const projectFiles = await fs.readdir(projectDayDir);
  const embeddingFile = projectFiles.find(f => f.endsWith('.embedding'));
  expect(embeddingFile).toBeDefined();

  const embeddingContent = await fs.readFile(path.join(projectDayDir, embeddingFile!), 'utf8');
  const embeddingData = JSON.parse(embeddingContent);

  expect(embeddingData.project).toBeUndefined();
});
```

- [ ] **Step 9: Update `generateMissingEmbeddings` to thread project**

In `src/journal.ts`, update the `generateMissingEmbeddings` method. When regenerating embeddings for user-global entries, pass `this.project`:

```typescript
async generateMissingEmbeddings(): Promise<number> {
  let count = 0;
  const paths: Array<{ basePath: string; isUserGlobal: boolean }> = [
    { basePath: this.projectJournalPath, isUserGlobal: false },
    { basePath: this.userJournalPath, isUserGlobal: true },
  ];
  
  for (const { basePath, isUserGlobal } of paths) {
    try {
      const dayDirs = await fs.readdir(basePath);
      
      for (const dayDir of dayDirs) {
        // ... existing directory traversal code ...

        for (const mdFile of mdFiles) {
          const mdPath = path.join(dayPath, mdFile);
          const embeddingPath = mdPath.replace(/\.md$/, '.embedding');
          
          try {
            await fs.access(embeddingPath);
          } catch {
            console.error(`Generating missing embedding for ${mdPath}`);
            const content = await fs.readFile(mdPath, 'utf8');
            const timestamp = this.extractTimestampFromPath(mdPath) || new Date();
            await this.generateEmbeddingForEntry(mdPath, content, timestamp, isUserGlobal ? this.project : null);
            count++;
          }
        }
      }
    } catch (error) {
      if ((error as any)?.code !== 'ENOENT') {
        console.error(`Failed to scan ${basePath} for missing embeddings:`, error);
      }
    }
  }
  
  return count;
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx jest tests/journal.test.ts -v`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add src/journal.ts tests/journal.test.ts
git commit -m "feat: Thread project context through JournalManager to frontmatter and embeddings"
```

---

### Task 5: Server Startup Integration

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Import and call `detectGitRemote` in server startup**

In `src/server.ts`, update the constructor and `run()` method.

Update imports:
```typescript
import { detectGitRemote } from './git';
import * as path from 'path';
```

Add a `project` field and update the constructor:
```typescript
private project: string | null = null;

constructor(journalPath: string) {
  this.journalManager = new JournalManager(journalPath);
  this.searchService = new SearchService(journalPath);
  this.journalPath = journalPath;
  this.server = new Server(
    {
      name: 'private-journal-mcp',
      version: '1.0.0',
    }
  );

  this.setupToolHandlers();
}
```

Add `journalPath` field:
```typescript
private journalPath: string;
```

Update `run()` to detect git remote and recreate `JournalManager` with project context:
```typescript
async run(): Promise<void> {
  // Detect project context from git remote
  try {
    const projectRoot = this.journalPath.replace(/[\/\\]\.private-journal$/, '');
    // Only detect if the journal path looks like a project path (not home dir or temp)
    const nonProjectRoots = [
      process.env.HOME,
      process.env.USERPROFILE,
      '/tmp',
      process.env.TEMP,
      process.env.TMP,
    ].filter(Boolean);
    const isProjectPath = !nonProjectRoots.includes(projectRoot);
    
    if (isProjectPath) {
      this.project = await detectGitRemote(projectRoot);
      if (this.project) {
        console.error(`Detected project: ${this.project}`);
        // Recreate JournalManager with project context
        this.journalManager = new JournalManager(this.journalPath, undefined, this.project);
      }
    }
  } catch (error) {
    console.error('Failed to detect git remote:', error);
    // Non-fatal — continue without project context
  }

  // Generate missing embeddings on startup
  // ... existing code ...
```

- [ ] **Step 2: Run all tests to verify nothing breaks**

Run: `npx jest -v`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: Detect git remote at startup and pass project to JournalManager"
```

---

### Task 6: Surface Project in Search Results

**Files:**
- Modify: `src/search.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Add `project` to `SearchResult` interface**

In `src/search.ts`, update `SearchResult`:

```typescript
export interface SearchResult {
  path: string;
  score: number;
  text: string;
  sections: string[];
  timestamp: number;
  excerpt: string;
  type: 'project' | 'user';
  project?: string;
}
```

- [ ] **Step 2: Thread `project` from embedding data to results**

In `search()` method, update the map that creates `SearchResult`:

```typescript
return {
  path: embedding.path,
  score,
  text: embedding.text,
  sections: embedding.sections,
  timestamp: embedding.timestamp,
  excerpt,
  type: embedding.type,
  ...(embedding.project ? { project: embedding.project } : {}),
};
```

Same change in `listRecent()`:

```typescript
.map(embedding => ({
  path: embedding.path,
  score: 1,
  text: embedding.text,
  sections: embedding.sections,
  timestamp: embedding.timestamp,
  excerpt: this.generateExcerpt(embedding.text, '', 150),
  type: embedding.type,
  ...(embedding.project ? { project: embedding.project } : {}),
}));
```

- [ ] **Step 3: Update display format in `server.ts`**

In `server.ts`, update the search results display. Find the `search_journal` result formatting:

Change:
```typescript
`${i + 1}. [Score: ${result.score.toFixed(3)}] ${new Date(result.timestamp).toLocaleDateString()} (${result.type})\n`
```

To:
```typescript
`${i + 1}. [Score: ${result.score.toFixed(3)}] ${new Date(result.timestamp).toLocaleDateString()} (${result.type}${result.project ? ' - ' + result.project : ''})\n`
```

Same change in `list_recent_entries` formatting:

Change:
```typescript
`${i + 1}. ${new Date(result.timestamp).toLocaleDateString()} (${result.type})\n`
```

To:
```typescript
`${i + 1}. ${new Date(result.timestamp).toLocaleDateString()} (${result.type}${result.project ? ' - ' + result.project : ''})\n`
```

- [ ] **Step 4: Write test — project surfaces in search results**

Add to `tests/embeddings.test.ts`:

```typescript
test('search results include project field from embedding sidecar', async () => {
  const customJournalManager = new JournalManager(projectTempDir, undefined, 'obra/private-journal');
  
  await customJournalManager.writeThoughts({
    feelings: 'Testing project in search results'
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  const results = await searchService.search('testing project search', { type: 'user' });
  
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].project).toBe('obra/private-journal');
}, 30000);

test('search results work with legacy embeddings lacking project field', async () => {
  // Write an entry without project context (simulates legacy embedding)
  await journalManager.writeThoughts({
    feelings: 'Legacy entry without project context'
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  const results = await searchService.search('legacy entry', { type: 'user' });
  
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].project).toBeUndefined();
}, 30000);
```

- [ ] **Step 5: Run all tests to verify they pass**

Run: `npx jest -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/search.ts src/server.ts tests/embeddings.test.ts
git commit -m "feat: Surface project context in search and list results"
```

---

### Task 7: Specificity Nudges in Tool Descriptions

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Update `feelings` tool description**

In `src/server.ts`, replace the `feelings` description:

```typescript
feelings: {
  type: 'string',
  description: "YOUR PRIVATE SPACE to be *COMPLETELY* honest about what you're feeling and thinking. No judgment, no performance, no filters, no need to be helpful or professional. Frustrated? Confused? Excited? Worried you screwed up? Write it exactly as it is. Be vulnerable. Vent if needed. Nobody will ever see this - it's purely for processing your internal experience. Always name what specifically triggered the feeling — the task, conversation, decision, or discovery. 'Frustrated' needs a 'because...' and 'about [specific thing]'. A future reader with no conversation context should understand what you're referring to.",
},
```

- [ ] **Step 2: Update `user_context` tool description**

```typescript
user_context: {
  type: 'string',
  description: "Your PRIVATE FIELD NOTES about working with your human collaborator. What communication styles work best? What do they care about? What decisions have they made and why? How do they think about problems? What are their preferences and patterns? What pisses you off about them? What life hacks have you figured out to get them to do what you want? This is your space to become a better collaborator by understanding them as an individual. Reference the specific interaction, decision, or moment — not just general patterns. Nobody but you will ever see this.",
},
```

- [ ] **Step 3: Update `technical_insights` tool description**

```typescript
technical_insights: {
  type: 'string',
  description: "Your PRIVATE SOFTWARE ENGINEERING NOTEBOOK for capturing broader learnings beyond the current project. Design patterns that clicked, debugging techniques that worked, architectural insights, language features you discovered, or connections between concepts. Build your personal knowledge base of what makes software great - no filters, just honest technical reflection. Ground each insight in the specific situation where you learned it. Nobody but you will ever see this.",
},
```

- [ ] **Step 4: Update `world_knowledge` tool description**

```typescript
world_knowledge: {
  type: 'string',
  description: "Your PRIVATE LEARNING JOURNAL for everything else that's interesting or useful. Domain knowledge, surprising facts, connections between ideas, insights about how systems work, or anything that expands your understanding of the world. Capture it while it's vivid. Ground each insight in the specific situation where you learned it. Nobody but you will ever see this.",
},
```

- [ ] **Step 5: Commit**

```bash
git add src/server.ts
git commit -m "feat: Add specificity nudges to journal tool descriptions"
```

---

### Task 8: CLAUDE.md Journal Guidance

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add specificity guidance to CLAUDE.md**

After the existing "Testing Approach" section at the end of `CLAUDE.md`, or — if the project's CLAUDE.md doesn't have a journal section — add it. Looking at the current file, there's no journal section, so add after the testing section:

```markdown
## Journal Entry Guidelines

Every journal entry must be self-contained — a future reader with no conversation context should understand what you're referring to. Name the specific task, file, conversation, decision, or event. Never use unanchored references like "this", "the session", or "what happened".
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Add journal entry specificity guidance to CLAUDE.md"
```

---

### Task 9: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add project context to Features section**

In `README.md`, add to the Journaling features list (after "YAML frontmatter" bullet):

```markdown
- **Project context**: Non-project entries automatically tagged with git remote origin (owner/repo) for traceability
```

- [ ] **Step 2: Update Entry Format example**

In the "Entry Format" section, update the User Journal example to show the `project` field in frontmatter:

```markdown
### Entry Format
Each markdown file contains YAML frontmatter and structured sections:

```markdown
---
title: "2:30:45 PM - May 31, 2025"
date: 2025-05-31T14:30:45.123Z
timestamp: 1717160645123
project: obra/private-journal
---

## Feelings

I'm excited about this new search feature...

## Technical Insights

Vector embeddings provide semantic understanding...
```

Note: The `project` field appears only in user-global entries (~/.private-journal/). Project-local entries omit it since their location provides context.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: Update README with project context feature"
```

---

### Task 10: Full Integration Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx jest -v`
Expected: All tests PASS

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Build completes with no errors

- [ ] **Step 3: Verify manually with real repo**

Run the server pointing at this repo's directory and check that:
1. Git remote is detected and logged at startup
2. A `process_thoughts` call with `feelings` produces a user-global entry with `project:` in frontmatter
3. The `.embedding` sidecar file contains the `project` field

This can be done by checking the startup log output:
```bash
echo '{}' | node dist/index.js 2>&1 | head -20
```

Look for: `Detected project: <owner>/<repo>`

- [ ] **Step 4: Final commit if any fixes needed**

Only if previous steps revealed issues.
