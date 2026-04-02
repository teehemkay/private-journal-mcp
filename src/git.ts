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

  // SSH colon format: git@host:path.git (not ssh:// URL schemes)
  const sshColonMatch = !trimmed.includes('://') && trimmed.match(/^[^@]+@[^:]+:(.+?)(?:\.git)?$/);
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
