---
name: github-story-workflow
description: Create and manage GitHub Issues as project work items for this repository. Use when the user asks to create a story, bug, task, or work item; add an issue to the GitHub Project board; leave an item with no Status yet; accept a story into To-Do; move a project item between To-Do, In Progress, Blocked, and Done; close, reopen, or delete a GitHub issue tied to the project workflow.
---

# GitHub Story Workflow

Use this skill for repo-specific GitHub issue and project-board management.

## Repo Context

- Repository: `beccapowellstuff/Chord-Supporting-Helper-Application`
- GitHub Project title: `Chord Supporting Helper Application`
- Project number: `1`
- Project id: `PVT_kwHODkAtNc4BSzha`
- Status field id: `PVTSSF_lAHODkAtNc4BSzhazhAO2jM`

Status options:

- `To-Do`: `f75ad846`
- `In Progress`: `3c2780ca`
- `Blocked`: `e8c952cb`
- `Done`: `b257f64d`

## Important Environment Note

Use the full GitHub CLI path because `gh` may not be on `PATH` in this workspace:

`C:\Program Files\GitHub CLI\gh.exe`

When network access is needed, request escalated execution and use the full executable path.

## Default Meanings

- `Create a new story`: create a GitHub Issue, add it to Project `1`, then clear the Status field so it stays in no-status state until accepted.
- `Create a new bug`: create a GitHub Issue, add it to Project `1`, then clear Status unless the user explicitly wants another state.
- `Create a new task` or `work item`: same default flow as story.
- `Accept this` or `accept issue #N`: move the project item to `To-Do`.
- `Start this`: move the project item to `In Progress`.
- `Block this`: move the project item to `Blocked`.
- `Mark this done`: move the project item to `Done`.
- `Close this`: close the GitHub issue. Do not assume this also means delete it.
- `Delete this`: permanently delete the GitHub issue. Treat as destructive and confirm clearly unless the user directly asked for deletion.

## Issue Creation Workflow

For a new story, bug, task, or work item:

1. Create the issue with GitHub CLI.
2. Add the issue URL to Project `1`.
3. Clear the project `Status` field so it is in no-status state unless the user asked for an explicit status.
4. Report back with the issue number and URL.

If the user gives only a short title such as `Create a new story: fix Toolbar UI`, use that as the title and create a short default body rather than blocking on extra questions.

Default body template:

```md
Auto-created from Codex workflow.

Initial note:
- <repeat the user's request in one sentence>
```

## Project Item Update Workflow

To change a project status for an existing issue:

1. Find the issue URL or number.
2. Ensure the issue is on Project `1`. If not, add it first.
3. Find the project item ID for that issue.
4. Update the `Status` field with `gh project item-edit`.

To return an item to no-status:

1. Find the project item ID.
2. Clear the `Status` field with `gh project item-edit --clear`.

## Useful Command Shapes

Create issue:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' issue create --repo 'beccapowellstuff/Chord-Supporting-Helper-Application' --title '<title>' --body '<body>'
```

Add issue to project:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' project item-add 1 --owner beccapowellstuff --url '<issue-url>' --format json
```

Clear status:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' project item-edit --id '<item-id>' --project-id 'PVT_kwHODkAtNc4BSzha' --field-id 'PVTSSF_lAHODkAtNc4BSzhazhAO2jM' --clear
```

Set `To-Do`:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' project item-edit --id '<item-id>' --project-id 'PVT_kwHODkAtNc4BSzha' --field-id 'PVTSSF_lAHODkAtNc4BSzhazhAO2jM' --single-select-option-id 'f75ad846'
```

Set `In Progress`:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' project item-edit --id '<item-id>' --project-id 'PVT_kwHODkAtNc4BSzha' --field-id 'PVTSSF_lAHODkAtNc4BSzhazhAO2jM' --single-select-option-id '3c2780ca'
```

Set `Blocked`:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' project item-edit --id '<item-id>' --project-id 'PVT_kwHODkAtNc4BSzha' --field-id 'PVTSSF_lAHODkAtNc4BSzhazhAO2jM' --single-select-option-id 'e8c952cb'
```

Set `Done`:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' project item-edit --id '<item-id>' --project-id 'PVT_kwHODkAtNc4BSzha' --field-id 'PVTSSF_lAHODkAtNc4BSzhazhAO2jM' --single-select-option-id 'b257f64d'
```

List project items to find the matching item id:

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' project item-list 1 --owner beccapowellstuff --format json
```

## Response Style

- Be explicit about what you changed: issue created, item added, status cleared, status moved, issue closed, or issue deleted.
- Include the issue number and URL after creation.
- If the user uses repo workflow language like `story`, `accepted`, or `not accepted yet`, translate that into the project actions above without needing extra explanation.
