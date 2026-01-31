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
