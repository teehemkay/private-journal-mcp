// ABOUTME: Unit tests for git remote detection and URL parsing
// ABOUTME: Tests URL normalization across SSH, HTTPS, and edge cases

import { parseGitRemoteUrl, detectGitRemote } from '../src/git';
import * as path from 'path';
import * as os from 'os';

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

describe('detectGitRemote', () => {
  test('detects remote for a real git repo (this repo)', async () => {
    const result = await detectGitRemote(process.cwd());
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
