## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context, shared with the server: the canonical `GLOSSARY.md` and `docs/adr/` live in the sibling `nando-server` repo (`../nando-server/GLOSSARY.md`, `../nando-server/docs/adr/`). This repo keeps no glossary of its own. See `docs/agents/domain.md`.

## Device

Nando's main phone is the **iPhone 17** (402×874 pt, @3x), running Nando as a Home Screen PWA. Design and check every screen at that size. The `pr-media` skill (`.claude/skills/pr-media/`) captures screens on it for PRs.
