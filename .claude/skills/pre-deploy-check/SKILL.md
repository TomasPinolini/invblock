---
name: pre-deploy-check
description: Run comprehensive pre-deployment checks including build, lint, secret scanning, env var validation, and security audit. Use before deploying to production or creating a PR.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash
---

# Pre-Deploy Check

Run all checks to verify the project is ready for deployment.

## Step 1: Build Check

Run the Next.js build to catch TypeScript and compilation errors:

```bash
npm run build
```

If it fails, fix all errors before continuing.

## Step 2: Lint Check

```bash
npm run lint
```

Fix any linting errors.

## Step 3: Secret Scanning

Search for accidentally committed secrets. Flag ANY of these:

```
# Check for hardcoded API keys, tokens, passwords
grep -r "sk-ant-" src/          # Anthropic API keys
grep -r "re_" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules  # Resend keys
grep -r "apiSecret" src/ | grep -v "types\|interface\|\.d\.ts"  # Binance secrets in code
grep -r "password" src/ | grep -v "types\|interface\|\.d\.ts\|placeholder\|label"
```

Also check these files should NEVER be committed:
- `.env.local` — must be in `.gitignore`
- `docs/secrets.txt` — must be in `.gitignore`
- Any `*.pem`, `*.key`, `*.cert` files

## Step 4: Environment Variable Validation

Verify all required env vars are documented. Check `.env.local` exists and has:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — set and starts with `https://`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — set and non-empty
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — set (server-only, never in NEXT_PUBLIC_*)
- [ ] `DATABASE_URL` — set and contains `postgresql://` or `postgres://`
- [ ] `ANTHROPIC_API_KEY` — set (for insights feature)

**IMPORTANT**: Only check that vars EXIST. NEVER log or display their values.

## Step 5: Security Quick Scan

Check critical security patterns:

### Auth coverage
Search for any API route missing auth:
```
# Every route.ts in src/app/api/ should call getAuthUser()
```
Flag any route.ts that doesn't import from `@/lib/auth`.

### Trading safety
Check `src/app/api/iol/trade/route.ts`:
- Does it validate action, mercado, simbolo, cantidad, precio?
- Does it have rate limiting?
- Does it log trade attempts?

### Credential handling
Check that no route logs credential values:
```
# Should NOT find console.log with token/credentials/apiKey/apiSecret
```

## Step 6: Known Issues Check

Verify the status of known bugs from the audit:

1. **Query key bug**: Check if `src/hooks/useIOLTrade.ts` still has `["portfolio"]`
   instead of `["iol-portfolio"]` on the invalidation line
2. **Hardcoded rate**: Check if `MOCK_USD_ARS_RATE` is still used in components
3. **Empty next.config**: Check if `next.config.ts` still has no configuration
4. **Unused ErrorBoundary**: Check if ErrorBoundary is imported anywhere

## Step 7: Git Status

```bash
git status
git diff --stat
```

Verify:
- No unintended files staged
- No `.env` files staged
- No `secrets.txt` staged
- Commit messages are descriptive

## Output Report

Summarize findings as:

```
PRE-DEPLOY CHECK RESULTS
========================

BUILD:      ✅ PASS / ❌ FAIL (details)
LINT:       ✅ PASS / ❌ FAIL (details)
SECRETS:    ✅ CLEAN / ❌ FOUND (list files)
ENV VARS:   ✅ ALL SET / ❌ MISSING (list vars)
SECURITY:   ✅ PASS / ⚠️ WARNINGS (list)
KNOWN BUGS: ✅ FIXED / ⚠️ REMAINING (list)
GIT:        ✅ CLEAN / ⚠️ UNCOMMITTED (list)

VERDICT: READY TO DEPLOY / NEEDS FIXES
```
