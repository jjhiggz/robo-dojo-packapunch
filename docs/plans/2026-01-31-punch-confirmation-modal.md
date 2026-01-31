# Punch Confirmation Modal Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add a confirmation modal when students punch in/out, allowing them to adjust time and add notes before submission.

**Architecture:** Create a new `PunchConfirmationModal` component that opens before punch submission. Modal validates time (must be after last punch, can't be future) and accepts optional notes. Update `PunchControls` to use modal workflow instead of direct mutation. Modify `punch` server function to accept custom timestamp and notes.

**Tech Stack:** React, TanStack Query, shadcn/ui Dialog, HTML5 datetime-local input, existing Drizzle schema (notes field already exists)

---

## Task 1: Create PunchConfirmationModal Component Shell

**Files:**
- Create: `src/components/board/PunchConfirmationModal.tsx`

**Step 1: Create the modal component file**

Create `src/components/board/PunchConfirmationModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface PunchConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  punchType: 'in' | 'out'
  lastPunch: { type: 'in' | 'out'; timestamp: Date } | null
  onConfirm: (timestamp: Date, notes: string) => void
}

export function PunchConfirmationModal({
  isOpen,
  onClose,
  punchType,
  lastPunch,
  onConfirm,
}: PunchConfirmationModalProps) {
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date()
      const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      setTime(localTime)
      setNotes('')
      setError('')
    }
  }, [isOpen])

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const handleConfirm = () => {
    // Validation will be added in next task
    const selectedTime = new Date(time)
    onConfirm(selectedTime, notes)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Confirm Punch {punchType === 'in' ? 'In' : 'Out'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Last punch info */}
          <div className="text-sm text-muted-foreground">
            {lastPunch ? (
              <span>
                Last punch: <strong>{lastPunch.type.toUpperCase()}</strong> at{' '}
                <strong>{formatTime(lastPunch.timestamp)}</strong>
              </span>
            ) : (
              <span>No previous punches</span>
            )}
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes (optional) - {notes.length}/255
            </Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this punch..."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 255))}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive font-medium">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant={punchType === 'out' ? 'destructive' : 'default'}
          >
            Confirm Punch {punchType === 'in' ? 'In' : 'Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify component compiles**

Run: `npm run build`
Expected: Build succeeds (component may not be used yet, that's OK)

**Step 3: Commit**

```bash
git add src/components/board/PunchConfirmationModal.tsx
git commit -m "feat: create PunchConfirmationModal component shell"
```

---

## Task 2: Add Validation Logic to Modal

**Files:**
- Modify: `src/components/board/PunchConfirmationModal.tsx`

**Step 1: Add validation function**

In `src/components/board/PunchConfirmationModal.tsx`, update the `handleConfirm` function:

```tsx
const handleConfirm = () => {
  const selectedTime = new Date(time)
  const now = new Date()

  // Validate: can't be in the future
  if (selectedTime > now) {
    setError('Cannot set punch time in the future')
    return
  }

  // Validate: must be after last punch
  if (lastPunch) {
    const lastPunchTime = new Date(lastPunch.timestamp)
    if (selectedTime <= lastPunchTime) {
      const lastPunchTypeText = lastPunch.type === 'in' ? 'in' : 'out'
      const formattedLastTime = formatTime(lastPunchTime)
      setError(
        `Time must be after your last punch ${lastPunchTypeText} at ${formattedLastTime}`
      )
      return
    }
  }

  // Clear error and confirm
  setError('')
  onConfirm(selectedTime, notes)
  onClose()
}
```

**Step 2: Test validation manually**

You'll test this in the next task when integrated into PunchControls.

**Step 3: Commit**

```bash
git add src/components/board/PunchConfirmationModal.tsx
git commit -m "feat: add time validation to PunchConfirmationModal"
```

---

## Task 3: Update Punch Server Function

**Files:**
- Modify: `src/server/punches.ts:447-469`

**Step 1: Update the punch function signature**

In `src/server/punches.ts`, modify the `punch` server function to accept optional `timestamp` and `notes`:

Replace lines 447-469 with:

```typescript
export const punch = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    userId: string
    boardId: number
    userName?: string
    userEmail?: string
    type: 'in' | 'out'
    timestamp?: string  // NEW: optional custom timestamp
    notes?: string      // NEW: optional notes
  }) => data)
  .handler(async ({ data }) => {
    const punchTime = data.timestamp ? new Date(data.timestamp) : new Date()

    // Prevent future punches
    if (punchTime > new Date()) {
      throw new Error('Cannot set punch time in the future')
    }

    const [newPunch] = await db
      .insert(punches)
      .values({
        userId: data.userId,
        boardId: data.boardId,
        userName: data.userName || null,
        userEmail: data.userEmail || null,
        type: data.type,
        timestamp: punchTime,
        notes: data.notes || null,
      })
      .returning()

    return newPunch
  })
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/server/punches.ts
git commit -m "feat: add timestamp and notes parameters to punch function"
```

---

## Task 4: Integrate Modal into PunchControls

**Files:**
- Modify: `src/components/board/PunchControls.tsx`

**Step 1: Import the modal component**

At the top of `src/components/board/PunchControls.tsx`, add:

```tsx
import { useState } from 'react'
import { PunchConfirmationModal } from './PunchConfirmationModal'
```

**Step 2: Add modal state**

Inside the `PunchControls` component function (after `const isClockedIn = ...`), add:

```tsx
const [showModal, setShowModal] = useState(false)
const [pendingPunchType, setPendingPunchType] = useState<'in' | 'out'>('in')
```

**Step 3: Update handlePunch to open modal**

Replace the current `handlePunch` function (lines 56-58) with:

```tsx
const handlePunch = () => {
  setPendingPunchType(isClockedIn ? 'out' : 'in')
  setShowModal(true)
}
```

**Step 4: Add handleConfirm function**

After `handlePunch`, add:

```tsx
const handleConfirm = (timestamp: Date, notes: string) => {
  punchMutation.mutate({
    type: pendingPunchType,
    timestamp: timestamp.toISOString(),
    notes,
  })
}
```

**Step 5: Update punchMutation to accept new parameters**

Replace the `punchMutation` definition (lines 31-45) with:

```tsx
const punchMutation = useMutation({
  mutationFn: (params: { type: 'in' | 'out'; timestamp?: string; notes?: string }) =>
    punch({
      data: {
        userId: user?.id ?? '',
        boardId: currentBoard!.id,
        userName: user?.fullName || user?.firstName || undefined,
        userEmail: user?.emailAddresses[0]?.emailAddress,
        type: params.type,
        timestamp: params.timestamp,
        notes: params.notes,
      },
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['allUsersStatus', currentBoard?.id] })
  },
})
```

**Step 6: Add modal to the JSX**

Before the closing `</div>` tag at the end of the return statement (after line 204), add:

```tsx
      <PunchConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        punchType={pendingPunchType}
        lastPunch={
          currentUserStatus
            ? {
                type: currentUserStatus.isClockedIn ? 'in' : 'out',
                timestamp: currentUserStatus.lastPunchTime,
              }
            : null
        }
        onConfirm={handleConfirm}
      />
```

**Step 7: Test the feature manually**

Run: `npm run dev`

Test cases:
1. Click "Punch In" → modal opens with current time
2. Try to set time in the future → error appears
3. Punch in successfully → check database has correct time and notes
4. Click "Punch Out" → modal shows last IN punch info
5. Try to set time before last IN → error appears
6. Punch out successfully with notes → verify in database
7. Add 255+ characters to notes → should truncate at 255

**Step 8: Commit**

```bash
git add src/components/board/PunchControls.tsx
git commit -m "feat: integrate PunchConfirmationModal into punch workflow"
```

---

## Task 5: Fix Notes Field Default Value

**Files:**
- Modify: `src/db/schema.ts:104`

**Step 1: Update schema to allow null notes**

The current schema has `notes` with a default of empty string, but our code uses `null`. Update line 104:

```typescript
notes: varchar("notes", {length: 255}),
```

Remove `.notNull().default("")` to allow null values and no default.

**Step 2: Generate and run migration**

Run: `npm run db:generate`
Expected: Creates a new migration file

Run: `npm run db:push`  (or appropriate migration command)
Expected: Updates database schema

**Step 3: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "fix: allow null notes in punches schema"
```

---

## Task 6: Verify Complete Feature

**Files:**
- No changes, just testing

**Step 1: Run full test suite**

Run: `npm test` (if tests exist)
Expected: All tests pass

**Step 2: Manual end-to-end test**

1. Start dev server: `npm run dev`
2. Log in as a student
3. Click "Punch In"
   - Verify modal opens
   - Verify current time is pre-filled
   - Verify "No previous punches" or last punch info shows
   - Try setting future time → should show error
   - Set valid time, add note "Test punch in"
   - Confirm → modal closes, status updates
4. Click "Punch Out"
   - Verify modal shows last IN time
   - Try setting time before last IN → should show error
   - Set valid time, add note "Test punch out"
   - Confirm → modal closes, status updates
5. Check student detail page to verify notes appear

**Step 3: Verify admin view shows notes**

Check `src/routes/students.$userId.tsx` to ensure notes field displays in punch history table. If not displayed, add a Notes column.

**Step 4: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: any final adjustments from testing"
```

---

## Success Criteria

✅ Modal opens when user clicks Punch In or Punch Out
✅ Time picker defaults to current time
✅ Last punch info displays correctly
✅ Future times are rejected with error message
✅ Times before last punch are rejected with error message
✅ Notes can be added (optional, max 255 chars)
✅ Punch saves with custom time and notes
✅ Status updates correctly after punch
✅ Notes display in admin/student history views

---

## Rollback Plan

If issues arise:
1. Revert commits in reverse order
2. Run `git revert <commit-hash>` for each commit
3. The punch system will return to direct mutation workflow
