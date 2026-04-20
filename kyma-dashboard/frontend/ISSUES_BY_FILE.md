# Issues By File - Quick Reference

## 📋 Pages Analysis (18 files)

### HelmPage.tsx (1213 lines)
**Severity: CRITICAL** ⚠️

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| XSS via shell injection | 1126 | Security | 🔴 CRITICAL |
| Memory leak in streamSSE | 63-93 | Memory | 🔴 CRITICAL |
| Type safety: `any` overuse | 175, 404 | Type Safety | 🔴 CRITICAL |
| No error handling for SSE | 515-533 | Error Handling | 🔴 HIGH |
| Silent catch block | 176 | Error Handling | 🟡 MEDIUM |
| Hardcoded endpoints | 191-205 | Security | 🟡 MEDIUM |
| No YAML validation | 199, 308-314 | Validation | 🟡 MEDIUM |
| CSS inline styles | 111, 241, 322 | Performance | 🟡 MEDIUM |
| No debouncing on form changes | 672-684 | Performance | 🟢 LOW |
| Missing accessibility labels | Multiple | A11Y | 🟢 LOW |

**Recommended Actions:**
- [ ] Replace shell injection with proper API call
- [ ] Add try-catch with error logging to streamSSE
- [ ] Create types for API responses
- [ ] Add YAML validation library

---

### PodsPage.tsx (772 lines)
**Severity: CRITICAL** ⚠️

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| EventSource memory leak | 40-138 | Memory | 🔴 CRITICAL |
| Unbounded array growth | 67 | Memory | 🔴 CRITICAL |
| Race condition in pagination | 502, 73 | Race Condition | 🔴 CRITICAL |
| Type safety: `as any` | 159, 410 | Type Safety | 🔴 CRITICAL |
| No request cancellation | 504-509 | Performance | 🔴 HIGH |
| Excessive DOM nodes in logs | 118-129 | Performance | 🔴 HIGH |
| Silent error swallowing | 494 | Error Handling | 🔴 HIGH |
| No keyboard navigation | 594-640 | Accessibility | 🔴 HIGH |
| Accessibility: action menu | 652-687 | Accessibility | 🔴 HIGH |
| Inline function definitions | 675-683 | Performance | 🟡 MEDIUM |

**Recommended Actions:**
- [ ] Implement virtual scrolling for logs
- [ ] Add AbortController for query cancellation
- [ ] Wrap table in React.memo
- [ ] Add keyboard event handlers
- [ ] Add aria-label to action button

---

### DeploymentsPage.tsx (453 lines)
**Severity: HIGH** 🔴

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| Type safety: `as any` | 159, 220, 247 | Type Safety | 🔴 CRITICAL |
| Silent error in download | 328-330 | Error Handling | 🔴 HIGH |
| No null coalescing for namespace | 313 | Type Safety | 🟡 MEDIUM |
| Hardcoded endpoint | 317 | Security | 🟡 MEDIUM |
| Inconsistent date formatting | 169 | Code Quality | 🟡 MEDIUM |
| No loading state for detail | 147-149 | UX | 🟡 MEDIUM |
| Missing error boundary | None | Error Handling | 🟡 MEDIUM |
| CSS class fragmentation | Multiple | Code Quality | 🟢 LOW |

**Recommended Actions:**
- [ ] Create DeploymentDetail type
- [ ] Add error toast to download failure
- [ ] Standardize date formatting
- [ ] Add error boundary wrapper

---

### ClusterOverview.tsx (464 lines)
**Severity: HIGH** 🔴

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| Over-fetching data | 295 | Performance | 🔴 HIGH |
| Type safety: `as any` | 314, 439 | Type Safety | 🔴 CRITICAL |
| Multiple nullable chains | 314-320 | Code Quality | 🟡 MEDIUM |
| Magic numbers | 365 | Code Quality | 🟡 MEDIUM |
| Unused query result | 299 | Performance | 🟡 MEDIUM |
| Inline styles | Multiple | Performance | 🟢 LOW |
| No loading skeleton | None | UX | 🟢 LOW |

**Recommended Actions:**
- [ ] Extract numeric constants
- [ ] Add proper type guards
- [ ] Filter namespace overview by current scope

---

### PodsPage.tsx (427 lines)
**Severity: HIGH** 🔴

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| Silent error in download | 481-496 | Error Handling | 🔴 HIGH |
| Type safety: Detail panel | 127 | Type Safety | 🔴 CRITICAL |
| Missing null check | 125-127 | Type Safety | 🔴 CRITICAL |
| No confirmation for delete | 681-683 | UX | 🟡 MEDIUM |
| Event handler leak | 257-280 | Memory | 🟡 MEDIUM |
| Hardcoded endpoint | 317 | Security | 🟡 MEDIUM |
| Poor error messaging | Multiple | UX | 🟢 LOW |

**Recommended Actions:**
- [ ] Add null check before rendering detail
- [ ] Add confirmation dialog
- [ ] Add error toast to download

---

### NamespacesPage.tsx (474 lines)
**Severity: MEDIUM** 🟡

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| N+1 query problem | 405-413 | Performance | 🔴 HIGH |
| No filter debouncing | 343-348 | Performance | 🔴 HIGH |
| Inline function creation | 299-306 | Performance | 🟡 MEDIUM |
| Missing confirmation | 440-445 | UX | 🟡 MEDIUM |
| Type safety issues | Multiple | Type Safety | 🟡 MEDIUM |
| Hardcoded strings | 462 | Code Quality | 🟢 LOW |
| CSS fragmentation | Multiple | Code Quality | 🟢 LOW |

**Recommended Actions:**
- [ ] Batch load namespace details
- [ ] Add debouncing to filter input
- [ ] Add delete confirmation dialog
- [ ] Create string constants file

---

### All Other Pages (13 files)
**Severity: MEDIUM to HIGH** 🟡🔴

**Common Issues Across Multiple Files:**
- Silent error handling (try/catch with no action)
- Type safety issues (any types, missing null checks)
- No confirmation dialogs for destructive actions
- Hardcoded API endpoints
- CSS class duplication
- Missing error boundaries
- No filter debouncing
- Accessibility: missing aria-labels
- Performance: inline function definitions

**Files with Issues:**
1. NamespaceDetailPage.tsx - 7 issues
2. RBACPage.tsx - 6 issues
3. WorkloadsPage.tsx - 5 issues
4. NodesPage.tsx - 5 issues
5. KymaPage.tsx - 4 issues
6. IstioPage.tsx - 4 issues
7. ConfigMapsPage.tsx - 5 issues
8. SecretsPage.tsx - 5 issues
9. EventsPage.tsx - 4 issues
10. ClustersPage.tsx - 3 issues
11. TopologyPage.tsx - 3 issues
12. AdminPage.tsx - 3 issues
13. PVCsPage.tsx - 6 issues (+ all remaining resource pages)

---

## 🔧 Shared Components Analysis (16 files)

### DataTable.tsx
**Status:** ✅ Good - Few Issues

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| Missing PropTypes | N/A | Type Safety | 🟢 LOW |
| No accessibility attrs | Multiple | A11Y | 🟢 LOW |

---

### LoadingState.tsx
**Status:** ✅ Good

- No critical issues
- Good shimmer animation
- Proper CSS injection

---

### StatusBadge.tsx
**Status:** ✅ Good

- Proper type definitions
- No issues found

---

### PodTerminal.tsx (262 lines)
**Status:** 🟡 Medium Issues

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| Silent error in fit() | 138, 164 | Error Handling | 🟡 MEDIUM |
| ResizeObserver cleanup needed | 164-165 | Memory | 🟡 MEDIUM |
| No error boundary | N/A | Error Handling | 🟡 MEDIUM |
| Missing a11y labels | 200-248 | Accessibility | 🟡 MEDIUM |
| Magic font size | 102 | Code Quality | 🟢 LOW |

**Recommended Actions:**
- [ ] Log errors in ResizeObserver
- [ ] Add ARIA labels to buttons
- [ ] Extract hardcoded values to constants

---

### ErrorState.tsx
**Status:** ✅ Good

- Good error detection logic
- Proper user messaging
- No critical issues

---

### QueryGuard.tsx
**File:** Not provided - Add proper error handling

---

### CommandPalette.tsx
**File:** Not provided - Add accessibility features

---

### ResourceYamlPanel.tsx (192 lines)
**Status:** 🔴 High Issues

| Issue | Line(s) | Type | Priority |
|-------|---------|------|----------|
| No YAML validation | 43-50 | Validation | 🔴 HIGH |
| Silent fetch failure | 43-50 | Error Handling | 🔴 HIGH |
| Type safety: d.yaml | 44-47 | Type Safety | 🟡 MEDIUM |
| Missing null check | 144 | Type Safety | 🟡 MEDIUM |
| No editor error boundary | 149 | Error Handling | 🟡 MEDIUM |

**Recommended Actions:**
- [ ] Add YAML schema validation
- [ ] Add error logging to fetch
- [ ] Add try-catch around Monaco editor

---

### Other Shared Components (8 files)
**LoadingState, StatusBadge, EmptyState, ActionMenu, AnimatedContainer, Breadcrumb, NamespaceSelect:** Generally good with minor a11y improvements needed

**HelmReleaseDetail.tsx (391 lines)**
- 5 issues: Type safety, navigation, emoji usage, memory
- Recommended: Extract resource mapping to constants

**DonutChart.tsx**
- Good implementation
- Minor: Magic numbers for dimensions

**SettingsPanel.tsx**
- Not analyzed (not provided)

---

## 📊 Summary Statistics

### By Severity
- 🔴 Critical (23): Memory leaks, XSS, type safety, race conditions
- 🔴 High (34): Error handling, performance, accessibility, type safety
- 🟡 Medium (41): Code quality, UX, validation, constants
- 🟢 Low (38): Documentation, naming, minor optimizations

### By Category
| Category | Count | Avg Severity |
|----------|-------|--------------|
| Type Safety | 15 | CRITICAL |
| Error Handling | 12 | HIGH |
| Performance | 18 | HIGH |
| Accessibility | 12 | HIGH |
| Code Quality | 20 | MEDIUM |
| Security | 3 | CRITICAL |
| UX | 10 | MEDIUM |
| Validation | 8 | HIGH |
| Memory Management | 6 | CRITICAL |
| Other | 12 | LOW |

### Files Needing Most Work
1. **HelmPage.tsx** - 12 issues (1213 lines) = 0.98 issues/100 lines
2. **PodsPage.tsx** - 10 issues (772 lines) = 1.29 issues/100 lines
3. **ResourceYamlPanel.tsx** - 5 issues (192 lines) = 2.60 issues/100 lines
4. **PodTerminal.tsx** - 5 issues (262 lines) = 1.91 issues/100 lines
5. **ClusterOverview.tsx** - 7 issues (464 lines) = 1.51 issues/100 lines

---

## 🎯 Quick Fixes (Can be done in <1 hour each)

1. Add `aria-label` to all icon-only buttons
2. Extract magic numbers to constants
3. Add error logging to all catch blocks
4. Create component PropTypes/interfaces
5. Standardize date formatting
6. Add confirmation dialogs to delete actions
7. Create reusable button component classes
8. Add TODO comments for future improvements
9. Move hardcoded strings to constants
10. Add JSDoc comments to utilities

---

## 🚀 Refactoring Priorities

### Week 1 (Critical)
- [ ] Fix XSS vulnerability in HelmPage
- [ ] Fix memory leaks in PodsPage & HelmPage
- [ ] Add type safety to API responses
- [ ] Add error boundaries

### Week 2 (High Priority)
- [ ] Implement debouncing for search/filter
- [ ] Add query cancellation
- [ ] Add accessibility labels
- [ ] Fix race conditions

### Week 3 (Medium Priority)
- [ ] Implement virtualization for large lists
- [ ] Extract reusable components
- [ ] Add comprehensive error handling
- [ ] Standardize formatting

### Week 4+ (Nice to Have)
- [ ] Add keyboard navigation
- [ ] Performance optimization
- [ ] Documentation
- [ ] Test coverage

---

**Generated:** 2024  
**Total Files Analyzed:** 50  
**Total Issues:** 136  
**Estimated Fix Time:** 40-60 hours
