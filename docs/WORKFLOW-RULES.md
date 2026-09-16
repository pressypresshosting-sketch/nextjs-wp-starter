# Rules for this workflow

Standing rules for an agent running the prompt chain in
[`prompt-workflow.md`](prompt-workflow.md). Every prompt references this file.

`AGENTS.md` at the repository root describes *this codebase*. This file
describes *running the chain*, and applies whatever codebase you end up with.

## Environment

- Establish which directory is the deliverable before the first write, and say
  which you chose. Do not assume it is the one you were started in.
- Check for a nested copy of the repository before creating files, not after: an
  archive that unpacks as `project-main/project-main/` has a real root and a
  decoy, and the human often has not noticed either. The giveaway is the same
  manifest, lockfile or config appearing at two depths. If you find one, say so,
  work in exactly one of them, and treat the other as read-only.
- Respect WORKFLOW_HOST_RATE_LIMIT in `.env`. Batch checks; never loop over URLs
  against a production host. Many shared hosts run fail2ban, which bans by IP
  and takes out SSH *and* HTTPS together — you lose the deploy channel and the
  site check in the same instant, and only the human can lift it.
- If WORKFLOW_HOST_RATE_LIMIT is empty, assume it is strict: serialise requests, keep
  a live sweep under ten URLs, and pause between SSH sessions. Probing cheaply
  costs you a few seconds; getting banned costs the human an unban.

## Verification

- A step is done when typecheck, lint, tests **and a production build** all
  pass. Not three of the four. Framework-level constraints — illegal route
  nesting, unroutable patterns, server/client boundary violations — surface only
  in the build, and they surface as failures, not warnings.
- Never trust a check you have not seen fail. When you add one, prove it catches
  the thing it is for before moving on.
- Before editing a script, confirm something checks it. If the type checker and
  linter both exclude it — which is common for `scripts/` — add a syntax gate
  first (`node --check`, or bringing the directory into the linter). Code that
  performs the deploy is the worst code to leave unchecked.
- Re-read the checks earlier steps wrote before trusting them. A check written
  against a shape you have since changed will keep passing or keep failing for
  the wrong reason.

## Changes

- When a requirement appears to forbid an existing capability, find out why the
  capability exists before removing it. Prefer making it safe over deleting it.
  Removing a feature is an easy way to satisfy a safety requirement and a hard
  thing for the human to notice until they need the feature.
- When you change a shape — a URL structure, a cache-tag vocabulary, an env key,
  a route name — grep for every artifact that encodes it and change them
  together. That includes deploy scripts, CMS-side PHP, smoke tests, fixtures
  and documentation, not just application code.
- Sequence work by dependency, not by convenience. Before running a step, state
  what breaks if it runs before the one preceding it.

## Tools

- Write source through the file-editing tools, not shell heredocs. Heredocs eat
  backslashes and will write literal NUL and control bytes into your regexes,
  producing a file that looks right in a diff and fails at runtime.
- After generating a file programmatically, read back the part you generated.
- Prefer a single deliberate command over a loop when the target is a live
  service.

## Secrets

- Generated config that carries a secret is gitignored and never committed.
- A secret belongs in the untracked generated file, never hand-written into the
  tracked template that reads it.
- If you find a secret in a tracked file, stop and say so before doing anything
  else.
- Never paste passwords, tokens or revalidation secrets into a prompt, a
  decision record, or any tracked document.

## Reporting

- Record blockers you cannot fix yourself as blockers, with the exact command
  that fixes each and who must run it. Do not work around a CMS-side problem
  and leave it unrecorded.
- When implementation proves a decision wrong, update the decision record and
  say so in its corrections section. That section is the most useful artifact
  the chain produces.
