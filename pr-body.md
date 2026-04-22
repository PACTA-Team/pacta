## Summary
- Replaced empty catch block in logout function with console.warn
- Errors are now logged to help debug logout failures

## Changes
- pacta_appweb/src/contexts/AuthContext.tsx: Added error logging in logout catch block

Fixes #225