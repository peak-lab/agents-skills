# Operations: agent-qa skill deployment

Each validated merge to `main` updates the skills installed on agent-qa for the GlitchTip autofix
account (`pushrank-autofix`). The [deploy workflow](../.github/workflows/deploy-agent-qa.yml)
pushes the revision to `/var/www/agents-skills`. Its `post-receive` hook runs
[`sync-skills`](../scripts/agent-qa/sync-skills) as that account. The hook applies
[synchronization](skill-sync.md) to `~/.agents/skills` and `~/.claude/skills` with `--all-existing`.

- Only skills already installed there, and their declared dependencies, are updated.
- A skill edited on the machine since its last sync is a conflict. The sync refuses that target and
  the deploy fails. Promote the edit through review or restore the target, then rerun the workflow.
- Backups stay next to each target; the ten most recent are kept.
- The machine needs Node 24 and no installed packages.

## One-time setup

1. Generate a key pair: `ssh-keygen -t ed25519 -N '' -C agents-skills-deploy -f deploy`.
2. Copy the checkout to agent-qa, then run as root:
   `scripts/agent-qa/install-deploy-user --key deploy.pub`. Rerunning it is safe.
3. Create the `agent-qa` environment in the repository and store the private key as its
   `AGENT_QA_DEPLOY_SSH_KEY` secret. Delete both local key files.
4. Run the workflow once from the Actions tab and check its `skill-sync: done` receipt.

The deploy key can run the pushed `skill-sync.ts` as the autofix account, and nothing beyond it.
