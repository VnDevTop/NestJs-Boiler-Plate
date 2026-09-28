/**
 * Commit messages follow Conventional Commits, enforced by the commit-msg hook
 * so the history stays readable and CHANGELOG entries can be generated from it.
 *
 * The existing history uses `feat:` and `chore:` with a lowercase imperative
 * subject, so headerCase and subjectCase are pinned to keep that style instead of
 * letting each message set its own.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [0],
  },
};
