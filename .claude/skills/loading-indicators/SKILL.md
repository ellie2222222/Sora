---
name: loading-indicators
description: "Use when auditing slow page loads, heavy assets, or rendering delays related to Show loading indicators. Verify the actual bottleneck in DevTools, Lighthouse, or field data before recommending changes."
metadata:
  category: performance
  priority: high
  difficulty: beginner
  estimatedTime: "15"
  source: frontendchecklist.io
  url: https://frontendchecklist.io/en/rules/performance/loading-indicators
---

# Show loading indicators

Loading indicators reassure users that something is happening—without feedback, users may think the page is broken or click repeatedly, degrading experience and causing duplicate actions.

## Quick Reference

- Show immediate feedback for all async operations
- Use skeletons for content, spinners for actions
- Ensure skeleton loading shapes (dimensions and border radii) exactly match the final rendered content to prevent layout shifts
- Include ARIA attributes for screen reader accessibility
- Avoid content jumps when loading completes

## Check

Verify that loading states are displayed during async operations with appropriate ARIA attributes for screen readers, and that skeleton loaders match the physical dimensions and shape of the final loaded content.

## Fix

Implement loading spinners/progress bars with aria-busy, aria-live, and clear visual feedback for ongoing operations. For skeleton loaders, align their dimensions and border radii precisely with the loaded components.

## Explain

Explain how loading indicators improve perceived performance and accessibility by communicating system status to users, and how matching skeleton shapes to final content reduces Cumulative Layout Shift (CLS).

## Code Review

Review the routes, assets, and loading behavior that affect Show loading indicators. Verify that skeletons have the exact same dimensions and border radii as their final rendered counterparts. Flag exact files, requests, or rendering steps that add unnecessary network, CPU, or layout cost, and describe the measurement method used to confirm the issue.

---

For full implementation details, code examples, and framework-specific guidance,
see `references/rule.md`.

Rule page: https://frontendchecklist.io/en/rules/performance/loading-indicators
