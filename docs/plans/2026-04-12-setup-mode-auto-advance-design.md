# Setup Mode Selector Auto-Advance Design

## Problem

The `SetupModeSelector` component (step 1 of the setup wizard) has no navigation mechanism. Users can click to select a mode (single/multi), but there's no "Next" button or auto-advance behavior, leaving them stuck on this step.

## Solution

Auto-advance to the next step when a mode card is clicked.

## Changes

### 1. `SetupModeSelector.tsx`

- Add `onSelect: () => void` prop
- Call `onSelect()` when a card is clicked (after setting the mode)
- Add visual feedback: scale transform + shadow on hover/active to signal clickability
- Add a small "Back" button at the bottom for navigation consistency

### 2. `SetupWizard.tsx`

- Pass `onNext` as the `onSelect` prop to `SetupModeSelector`

## UX Details

- Cards get `hover:scale-[1.02]` and `active:scale-[0.98]` for tactile feedback
- Selection is immediate: click -> mode set -> advance to next step
- Back button on next step allows undoing the selection

## Files Modified

- `pacta_appweb/src/components/setup/SetupModeSelector.tsx`
- `pacta_appweb/src/components/setup/SetupWizard.tsx`
