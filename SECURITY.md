# Security Policy

## Supported versions

This is a small hobby project. Security fixes land on `master` and ship with the next release. Only the latest released version is supported.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately via GitHub's [private vulnerability reporting](https://github.com/sqarrt/0n35h07/security/advisories/new), or by email to **sqarrt1337@gmail.com**. Include:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- affected version / commit.

You can expect an initial acknowledgement within a few days. Please give a reasonable window to fix the issue before any public disclosure.

## Scope notes

OneShot is a peer-to-peer (WebRTC) game with **no central game server** — the host authoritatively simulates each match. Things worth keeping in mind:

- **Host authority.** Hit detection and combat are computed only by the host; the client is never trusted for hits. Client-trust regressions are in scope.
- **TURN credentials are not secret.** Front-end WebRTC TURN credentials (`VITE_TURN_*`) are, by design, visible to any player in DevTools — env only keeps them out of the repository. Reporting that they are "exposed in the browser" is expected behaviour, not a vulnerability. Rotating leaked relay credentials is the operator's responsibility.
- **No secrets in the repo.** Credentials must come from env / CI variables. If you find a committed secret, please report it privately so it can be rotated.

Thanks for helping keep the project and its players safe.
