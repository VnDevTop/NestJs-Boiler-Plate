# Documentation

Guides for running this boilerplate. Everything here is configuration or
deployment; the code itself is documented where it lives, and the repository
README covers what the template contains.

## Guides

| Guide                                             | Covers                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Production hardening](production.md)             | rate limiting, headers, CORS, request ids, logging, health, shutdown, env validation, migrations, Docker, CI |
| [Optional integrations](optional-integrations.md) | how a feature can exist in the code without its package on disk, and how to enable one                       |

## Where the rest of the writing lives

These stay in the repository root rather than here, because they are about this
project rather than about running it. GitHub renders them on their own pages:

| File                                                                                     | About                                          |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [README](https://github.com/VnDevTop/NestJs-BoilerPlate/blob/main/README.md)             | what the template contains and how to start it |
| [PLAN](https://github.com/VnDevTop/NestJs-BoilerPlate/blob/main/PLAN.md)                 | the phase-by-phase build plan and its status   |
| [ROADMAP](https://github.com/VnDevTop/NestJs-BoilerPlate/blob/main/ROADMAP.md)           | what comes after the current phases            |
| [CONTRIBUTING](https://github.com/VnDevTop/NestJs-BoilerPlate/blob/main/CONTRIBUTING.md) | how to propose a change                        |
| [SECURITY](https://github.com/VnDevTop/NestJs-BoilerPlate/blob/main/SECURITY.md)         | how to report a vulnerability                  |
| [CHANGELOG](https://github.com/VnDevTop/NestJs-BoilerPlate/blob/main/CHANGELOG.md)       | released changes                               |

## Configuration reference

There is no separate reference page: `.env.example` is the reference. Every
variable in it carries a comment saying what it does, what it defaults to, and
what breaks if it is set wrong, and the app refuses to start on a value that
fails validation rather than falling back to a default nobody chose.

## A note on how this site is built

It is not. GitHub serves this folder directly and renders the markdown, so there
is no build step and nothing to keep in sync with a generator. Two consequences
worth knowing:

- **Do not add a `.nojekyll` file.** That file tells GitHub to skip Jekyll and
  serve every file exactly as it is on disk, which means the markdown arrives as
  plain text instead of a rendered page. The docs only work because Jekyll is
  doing the rendering.
- **Avoid Liquid delimiters.** Jekyll scans every file for its own template
  delimiters and tries to evaluate anything it finds. Nothing here uses them, and
  a snippet that did would break the page it appears on — including this
  sentence, which is why it names them in words instead of writing them out.
