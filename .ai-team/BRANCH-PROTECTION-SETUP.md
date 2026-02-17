# GitHub Branch Protection Setup

To mechanically enforce the PR workflow at the GitHub level, configure branch protection:

## Steps

1. **Navigate to Settings**
   - Go to your repository on GitHub
   - Click "Settings" tab
   - Click "Branches" in the left sidebar

2. **Add Branch Protection Rule**
   - Click "Add rule" or "Add branch protection rule"
   - Branch name pattern: `master` (or `main` if that's your default branch)

3. **Enable These Settings**

   ✅ **Require a pull request before merging**
   - Check this box
   - Set "Required approvals" to: **1**
   - Optional: Check "Dismiss stale pull request approvals when new commits are pushed"
   - Optional: Check "Require review from Code Owners" (after adding CODEOWNERS file)

   ✅ **Require status checks to pass before merging**
   - Check this box if you have CI/CD (tests, build, lint)
   - Select which status checks must pass
   - Optional: Check "Require branches to be up to date before merging"

   ✅ **Require conversation resolution before merging**
   - Check this box to ensure all review comments are addressed

   ✅ **Require linear history** (optional but recommended)
   - Enforces squash or rebase merges (cleaner history)

   ✅ **Include administrators**
   - Check this box — NO exceptions, even for repo admins
   - Ensures everyone follows the same workflow

   ✅ **Restrict who can push to matching branches**
   - Check this box
   - Leave the allowlist EMPTY — no one can push directly
   - Everyone must go through PRs

   ✅ **Do not allow bypassing the above settings**
   - Check this box
   - Ensures the rules are enforced mechanically

4. **Save Changes**
   - Click "Create" or "Save changes"

## Optional: Add CODEOWNERS File

Create `.github/CODEOWNERS` in your repository:

```
# Code review required from Alex for all changes
* @{your-github-username}
```

Replace `{your-github-username}` with Alex's GitHub username (if Alex is a human) or leave it for now if this is Squad-only.

GitHub will automatically request review from code owners on every PR.

## Verification

After setup:

1. Try to push directly to master: `git push origin master`
   - Should fail with "protected branch" error
   
2. Create a test PR:
   ```bash
   git checkout -b test/branch-protection
   echo "test" > test.txt
   git add test.txt
   git commit -m "test: verify branch protection"
   git push -u origin test/branch-protection
   gh pr create --title "Test: Branch Protection" --body "Verifying PR workflow"
   ```
   
3. Try to merge without approval:
   - Should be blocked until review is approved

4. After approval, merge should work:
   ```bash
   gh pr merge {number} --squash --delete-branch
   ```

## Current Status

🔲 Branch protection not yet configured (manual GitHub setup required)  
✅ Team workflow documented  
✅ Alex Kamal assigned as Code Reviewer  
✅ Code Review ceremony configured  
✅ Routing updated  

**Next step:** Repository administrator should configure GitHub branch protection following the steps above.
