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
