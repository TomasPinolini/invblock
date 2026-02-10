---
name: security-review
description: Audit a file or directory for security issues including auth checks, credential handling, input validation, rate limiting, and financial safety. Use when reviewing code that handles auth, trading, or sensitive data.
user-invocable: true
disable-model-invocation: false
argument-hint: [file-or-directory-path]
allowed-tools: Read, Grep, Glob
---

# Security Review

Review for security issues: `$ARGUMENTS`

If no path is provided, review the entire `src/app/api/` directory.

## Audit Checklist

For each file, check ALL of the following:

### 1. Authentication
- [ ] `getAuthUser()` is called at the START of every handler
- [ ] Returns 401 if user is null
- [ ] No handler skips auth (even GET endpoints)

### 2. Authorization
- [ ] All database queries filter by `user.id`
- [ ] No user can access another user's data
- [ ] Asset ownership verified before modifications (check assetId belongs to user)

### 3. Input Validation
- [ ] POST/PATCH/PUT bodies validated with Zod schema
- [ ] Query parameters validated (type, range, allowed values)
- [ ] No `parseInt()` without `isNaN()` check
- [ ] File uploads check: MIME type, file size, magic bytes

### 4. Credential Security
- [ ] No credentials (tokens, API keys, passwords) are logged via `console.log/error`
- [ ] Credentials from DB are parsed with try/catch (JSON.parse can throw)
- [ ] Token refresh pattern present for IOL routes
- [ ] No hardcoded secrets in source code

### 5. Financial Safety (Trading Endpoints)
- [ ] Trade amounts validated: positive, finite, reasonable range
- [ ] Required fields are truly required (no dangerous defaults)
- [ ] Trade actions explicitly validated ("buy" | "sell" only)
- [ ] Order cancellation validates operation number exists
- [ ] All trade attempts should be logged (audit trail)

### 6. Error Handling
- [ ] All async code wrapped in try/catch
- [ ] Error responses don't leak internal details (stack traces, SQL, etc.)
- [ ] Console.error includes route name prefix: `[RouteName] Error:`
- [ ] Errors return proper HTTP status codes

### 7. Data Exposure
- [ ] No raw API responses returned (remove `raw:` fields in production)
- [ ] Response only includes data the user needs
- [ ] No internal IDs or system info leaked

### 8. Rate Limiting
- [ ] Trading endpoints have rate limits
- [ ] Quote/data endpoints have rate limits
- [ ] File upload endpoints have rate limits

## Known Vulnerabilities in This Project

Flag these if found in the reviewed code:

1. **Plaintext credentials**: `user_connections.credentials` stores tokens as JSON without encryption
2. **MOCK_USD_ARS_RATE = 1250**: Hardcoded exchange rate used for real calculations
3. **Query key bug**: `useIOLTrade` invalidates `["portfolio"]` instead of `["iol-portfolio"]`
4. **No file size limits**: `/api/insights/analyze` accepts unlimited PDF uploads
5. **Silent sync failures**: `useAutoSync` has `.catch(() => {})` swallowing errors
6. **Missing staleTime**: `usePriceAlerts` hook has no staleTime (defaults to 0)

## Output Format

For each issue found, report:

```
[SEVERITY] Issue Title
  File: path/to/file.ts:LINE
  Problem: What's wrong
  Fix: How to fix it
```

Severity levels:
- **CRITICAL**: Security vulnerability, data exposure, financial risk
- **HIGH**: Missing auth, missing validation, credential handling
- **MEDIUM**: Error handling gaps, missing logging
- **LOW**: Code quality, best practices
