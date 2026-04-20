# Issue #138 Fix - GitHub Issues Created

**Date:** 2026-04-19
**Status:** ✅ Planning Complete - Ready for Team Implementation

## Overview

This document tracks the 6 GitHub issues created from the implementation plan for Issue #138 (Supplement Status Management Fix in PR #154).

## GitHub Issues

### Issue #216: Task 1 - Add Status Helper Functions
- **Link:** https://github.com/PACTA-Team/pacta/issues/216
- **Labels:** bug, enhancement
- **Objective:** Add validateSupplementStatus() and determineSupplementStatus() helpers
- **Files:** internal/handlers/supplements.go
- **Commits:** 1

### Issue #217: Task 2 - Refactor createSupplement Function
- **Link:** https://github.com/PACTA-Team/pacta/issues/217
- **Labels:** bug, enhancement
- **Objective:** Fix Status field being validated but ignored in INSERT
- **Files:** internal/handlers/supplements.go
- **Commits:** 1
- **Depends on:** Issue #216

### Issue #218: Task 3 - Refactor updateSupplement Function
- **Link:** https://github.com/PACTA-Team/pacta/issues/218
- **Labels:** bug, enhancement
- **Objective:** Fix missing status validation and audit log corruption (MOST CRITICAL)
- **Files:** internal/handlers/supplements.go
- **Commits:** 1
- **Depends on:** Issue #216

### Issue #220: Task 4 - Write Comprehensive Tests
- **Link:** https://github.com/PACTA-Team/pacta/issues/220
- **Labels:** enhancement
- **Objective:** Write 6 test cases for supplement status handling
- **Files:** internal/handlers/supplements_test.go (new)
- **Commits:** 1
- **Depends on:** Issues #217, #218

### Issue #221: Task 5 - Run All Tests and Verify
- **Link:** https://github.com/PACTA-Team/pacta/issues/221
- **Labels:** enhancement
- **Objective:** Run tests and verify no regressions
- **Commits:** 1
- **Depends on:** Issue #220

### Issue #219: Task 6 - Final Verification and Commit
- **Link:** https://github.com/PACTA-Team/pacta/issues/219
- **Labels:** documentation
- **Objective:** Final verification and commit with co-author trailer
- **Commits:** 1
- **Depends on:** Issue #221

## Task Dependencies

```
Issue #216 (Task 1: Helpers)
    ├─→ Issue #217 (Task 2: createSupplement)
    │       ├─→ Issue #220 (Task 4: Tests)
    │           ├─→ Issue #221 (Task 5: Verify)
    │               └─→ Issue #219 (Task 6: Final)
    │
    └─→ Issue #218 (Task 3: updateSupplement)
            └─→ Issue #220 (Task 4: Tests)
                ├─→ Issue #221 (Task 5: Verify)
                    └─→ Issue #219 (Task 6: Final)
```

## Issues Being Fixed

### PR #154 Root Causes (4 total)

1. **createSupplement ignores Status field in INSERT**
   - Problem: Validates req.Status but hardcodes 'draft' in INSERT
   - Fix: Use determineSupplementStatus(req.Status, nil)
   - Issue: #216, #217

2. **createSupplement audit log corrupts status**
   - Problem: Audit log records hardcoded 'draft' instead of actual status
   - Fix: Use statusToUse in audit log map
   - Issue: #216, #217

3. **updateSupplement audit log corrupts status (MOST CRITICAL)**
   - Problem: Database UPDATE uses correct status but audit log hardcodes 'draft'
   - Fix: Use statusToUse in audit log "after" state
   - Issue: #216, #218

4. **updateSupplement missing status validation**
   - Problem: createSupplement validates status but updateSupplement does not
   - Fix: Add status validation using validateSupplementStatus()
   - Issue: #216, #218

## Implementation Plan Reference

Full implementation plan available at:
- `/home/mowgli/pacta/docs/plans/2026-04-19-issue-138-implementation.md`

Each issue contains:
- Step-by-step implementation instructions
- Exact file paths and line numbers
- Code snippets to add/modify
- Commit message templates
- Acceptance criteria
- Testing instructions

## Team Assignment

Tasks are ready for team assignment:

| Task | Priority | Complexity | Est. Time |
|------|----------|-----------|-----------|
| #216 | HIGH | Low | 30 min |
| #217 | HIGH | Low | 30 min |
| #218 | CRITICAL | Low | 30 min |
| #220 | MEDIUM | Medium | 2 hours |
| #221 | MEDIUM | Low | 30 min |
| #219 | LOW | Low | 20 min |

**Total estimated effort:** 6-8 hours

## Success Criteria

✅ All 4 bugs fixed (validateSupplementStatus, determineSupplementStatus, audit logs)
✅ Consistent validation across create/update flows
✅ No hardcoded status values in audit logs
✅ All 6 tests pass
✅ No regressions
✅ Code properly committed with co-author trailer
✅ Ready for PR review and merge

## Related Resources

- Original Issue: #138
- Original PR: #154 (needs fixes)
- Code Review Findings: https://github.com/PACTA-Team/pacta/issues/138
- Architecture: Refactor with abstraction (helpers) + comprehensive testing

---

**Created:** 2026-04-19 by Copilot (Brainstorming + Writing Plans + Plan-to-Issues)
**Next Step:** Assign issues to team members and begin implementation
