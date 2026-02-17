# Development Workflow

## Overview

All code changes MUST go through the PR-based workflow. No direct commits to `master`/`main`.

## Standard Workflow

### 1. Create Feature Branch

```bash
# From master/main, create a new branch
git checkout master
git pull
git checkout -b feature/{issue-number}-{brief-description}

# Examples:
# git checkout -b feature/42-diplomacy-ui
# git checkout -b fix/38-auth-timeout
```

**Branch naming conventions:**
- `feature/{issue-number}-{description}` — for new features
- `fix/{issue-number}-{description}` — for bug fixes
- `refactor/{issue-number}-{description}` — for refactoring
- `test/{issue-number}-{description}` — for test additions

### 2. Do Your Work

- Make your changes in the feature branch
- Commit frequently with clear messages
- Follow conventional commit format: `type(scope): description`
  - `feat(diplomacy): add alliance offer UI`
  - `fix(auth): handle session timeout gracefully`
  - `test(simulation): add tick processing edge cases`
  - `refactor(api): extract validation logic to helpers`

### 3. Push and Open PR

```bash
# Push your branch
git push -u origin feature/{issue-number}-{description}

# Open PR via GitHub CLI
gh pr create --title "Brief description" --body "Closes #{issue-number}

## What Changed
- List your changes

## Why
- Explain the reasoning

## Testing
- How you tested this
"

# Or open PR via GitHub web UI
```

**PR Description Template:**

```markdown
Closes #{issue-number}

## What Changed
- Bullet list of changes made

## Why
- Why these changes were necessary
- What problem they solve

## Testing
- How you tested the changes
- Manual testing steps
- Automated tests added

## Notes
- Any special considerations
- Breaking changes (if any)
- Migration notes (if any)
```

### 4. Code Review

- **Alex** will automatically review your PR
- The Code Review ceremony triggers when the PR opens
- Alex checks:
  - Code quality and maintainability
  - Correctness and edge cases
  - Security issues
  - Test coverage
  - Architecture alignment
  - Convention adherence

**Possible outcomes:**

1. **✅ APPROVED** — Your PR is ready to merge
   - Alex will approve the PR
   - You (or Alex) can merge it
   - Branch will be deleted after merge

2. **🔄 CHANGES REQUESTED** — Issues must be fixed
   - Alex will list specific issues
   - **Important**: If Alex rejects your PR, you are locked out per Reviewer Rejection Protocol
   - A different agent will be assigned to fix the issues
   - This ensures fresh eyes catch what you missed

3. **💬 COMMENTED** — Non-blocking suggestions
   - You can address them or explain why not
   - PR can still be approved

### 5. Merge

Once approved:

```bash
# Via GitHub CLI
gh pr merge {number} --squash --delete-branch

# Or use GitHub web UI
# Click "Squash and merge" button
# Confirm branch deletion
```

**Merge options:**
- **Squash and merge** (default) — Clean history, one commit per PR
- **Rebase and merge** — Linear history, preserves individual commits
- **Merge commit** — Preserves full branch history (use sparingly)

## Special Cases

### Hot Fixes

Even urgent fixes MUST go through PR review:

```bash
git checkout master
git pull
git checkout -b hotfix/critical-bug-description
# Make minimal fix
git push -u origin hotfix/critical-bug-description
gh pr create --title "HOTFIX: Brief description" --body "Critical fix for {issue}"
```

Alex will prioritize review of PRs marked as hotfix.

### Updating Your PR

If you need to add more changes after opening the PR:

```bash
# Make more changes in your feature branch
git add .
git commit -m "address review feedback"
git push

# PR updates automatically
# Alex will review the new changes
```

### Handling Merge Conflicts

If master has moved ahead:

```bash
git checkout master
git pull
git checkout feature/{your-branch}
git merge master
# Resolve conflicts
git add .
git commit -m "merge master and resolve conflicts"
git push
```

## Branch Protection (To Be Configured)

Repository administrators should configure GitHub branch protection for `master`/`main`:

1. Go to Settings → Branches → Add rule
2. Branch name pattern: `master` (or `main`)
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require review from Code Owners (add Alex)
   - ✅ Require status checks to pass (CI/tests)
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators (no exceptions)
   - ✅ Restrict who can push (no one can push directly)

This mechanically enforces the PR workflow at the GitHub level.

## Reviewer Rejection Protocol

When Alex rejects (requests changes on) a PR:

1. **Original author is locked out** — you may NOT revise your own rejected work
2. **Alex will specify who should fix it:**
   - "Route the revision to {DifferentAgent}"
   - "Escalate to a specialist in {domain}"
3. **A different agent makes the fixes** in the same branch
4. **Fresh perspective catches what the original author missed**
5. **Alex reviews the revision** — if approved, PR merges

This ensures quality by preventing authors from rubber-stamping their own work.

## Why This Workflow?

**Quality**: Every change gets a thorough review before merging  
**Security**: Dedicated security review on all changes  
**Consistency**: Enforces project conventions and patterns  
**Knowledge Sharing**: Reviews spread understanding across the team  
**Safety**: Easy to identify and revert problematic changes  
**Documentation**: Clear history of what changed and why  

## Questions?

Ask **Holden** (Lead) for workflow questions  
Ask **Alex** (Code Reviewer) for review process questions  
Ask **Squad** (Coordinator) to route questions appropriately
