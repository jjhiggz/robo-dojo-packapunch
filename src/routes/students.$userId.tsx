import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, AlertCircle, Edit, Trash2, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPunchHistory, updatePunch, deletePunch, createPunch } from '@/server/punches'
import { useBoardContext } from '@/lib/board-context'

export const Route = createFileRoute('/students/$userId')({
  component: StudentProfilePage,
})

const formatDateTime = (date: Date | string) => {
  const d = new Date(date)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

interface PunchFormData {
  date: string
  time: string
  type: 'in' | 'out'
}

function StudentProfilePage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()
  const { userId } = Route.useParams()
  const { currentBoard, isOrgAdmin, isLoading: boardLoading } = useBoardContext()
  const queryClient = useQueryClient()

  const [editingPunch, setEditingPunch] = useState<{ id: number; data: PunchFormData } | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addFormData, setAddFormData] = useState<PunchFormData>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    type: 'in',
  })

  // Users can view their own profile, or org admins can view anyone's
  const isOwnProfile = user?.id === userId
  const canView = isOwnProfile || isOrgAdmin

  const { data: punches = [], isLoading: punchesLoading } = useQuery({
    queryKey: ['punchHistory', userId, currentBoard?.id],
    queryFn: () =>
      getPunchHistory({
        data: {
          userId,
          boardId: currentBoard!.id,
          startDate: new Date(0).toISOString(),
          endDate: new Date().toISOString(),
        },
      }),
    enabled: !!currentBoard?.id && canView,
  })

  // Get student info from first punch
  const studentInfo = punches[0] || { userName: null, userEmail: null }

  const updateMutation = useMutation({
    mutationFn: ({ punchId, timestamp, type }: { punchId: number; timestamp: string; type?: 'in' | 'out' }) =>
      updatePunch({ data: { punchId, timestamp, type } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId, currentBoard?.id] })
      setEditingPunch(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (punchId: number) => deletePunch({ data: punchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId, currentBoard?.id] })
    },
  })

  const createMutation = useMutation({
    mutationFn: ({ timestamp, type }: { timestamp: string; type: 'in' | 'out' }) =>
      createPunch({
        data: {
          userId,
          boardId: currentBoard!.id,
          timestamp,
          type,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchHistory', userId, currentBoard?.id] })
      setAddDialogOpen(false)
      setAddFormData({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        type: 'in',
      })
    },
  })

  const handleEdit = (punch: any) => {
    const date = new Date(punch.timestamp)
    setEditingPunch({
      id: punch.id,
      data: {
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().slice(0, 5),
        type: punch.type,
      },
    })
  }

  const handleSaveEdit = () => {
    if (!editingPunch) return

    const timestamp = new Date(`${editingPunch.data.date}T${editingPunch.data.time}:00`).toISOString()
    updateMutation.mutate({
      punchId: editingPunch.id,
      timestamp,
      type: editingPunch.data.type,
    })
  }

  const handleDelete = (punchId: number) => {
    if (confirm('Are you sure you want to delete this punch?')) {
      deleteMutation.mutate(punchId)
    }
  }

  const handleAdd = () => {
    const timestamp = new Date(`${addFormData.date}T${addFormData.time}:00`).toISOString()
    createMutation.mutate({ timestamp, type: addFormData.type })
  }

  if (!isLoaded || boardLoading) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground font-bold uppercase">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    navigate({ to: '/login' })
    return null
  }

  if (!canView) {
    navigate({ to: '/' })
    return null
  }

  if (!currentBoard) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
          </div>
        </div>
        <Card className="bg-muted/50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-bold mb-2">No Board Selected</h3>
            <p className="text-muted-foreground">
              Please select a board to view time tracking data.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Sort punches by date descending (newest first)
  const sortedPunches = [...punches].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/board">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase">
            {isOwnProfile ? 'My Time Tracking' : studentInfo.userName || 'Member Time Tracking'}
          </h1>
          <p className="text-muted-foreground font-medium">
            {currentBoard.name} - {studentInfo.userEmail || userId}
          </p>
        </div>
        {isOrgAdmin && (
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Punch
          </Button>
        )}
      </div>

      {/* Punches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-extrabold uppercase">Punch History</CardTitle>
          <CardDescription className="font-medium">
            {isOrgAdmin ? 'View and edit all time punches' : 'View your time tracking history'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {punchesLoading ? (
            <div className="text-center py-12 text-muted-foreground font-bold uppercase">Loading...</div>
          ) : sortedPunches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-medium">
              No punches recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Type</TableHead>
                    {isOrgAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPunches.map((punch) => (
                    <TableRow key={punch.id}>
                      <TableCell className="font-medium">
                        {formatDateTime(punch.timestamp)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-3 py-1 border-2 border-foreground font-extrabold uppercase text-xs shadow-[2px_2px_0px_hsl(0_0%_5%)] ${
                            punch.type === 'in'
                              ? 'bg-[hsl(140_70%_85%)] text-[hsl(140_80%_20%)]'
                              : 'bg-[hsl(0_70%_85%)] text-[hsl(0_80%_30%)]'
                          }`}
                        >
                          {punch.type === 'in' ? 'IN' : 'OUT'}
                        </span>
                      </TableCell>
                      {isOrgAdmin && (
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(punch)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(punch.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Punch Dialog */}
      <Dialog open={!!editingPunch} onOpenChange={() => setEditingPunch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase">Edit Punch</DialogTitle>
            <DialogDescription className="font-medium">
              Update the date, time, and type for this punch.
            </DialogDescription>
          </DialogHeader>
          {editingPunch && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date" className="font-bold">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editingPunch.data.date}
                  onChange={(e) =>
                    setEditingPunch({
                      ...editingPunch,
                      data: { ...editingPunch.data, date: e.target.value },
                    })
                  }
                  className="border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-time" className="font-bold">Time</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={editingPunch.data.time}
                  onChange={(e) =>
                    setEditingPunch({
                      ...editingPunch,
                      data: { ...editingPunch.data, time: e.target.value },
                    })
                  }
                  className="border-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type" className="font-bold">Type</Label>
                <Select
                  value={editingPunch.data.type}
                  onValueChange={(value: 'in' | 'out') =>
                    setEditingPunch({
                      ...editingPunch,
                      data: { ...editingPunch.data, type: value },
                    })
                  }
                >
                  <SelectTrigger id="edit-type" className="border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Punch In</SelectItem>
                    <SelectItem value="out">Punch Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPunch(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Punch Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-extrabold uppercase">Add Punch</DialogTitle>
            <DialogDescription className="font-medium">
              Manually add a punch in or out record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-date" className="font-bold">Date</Label>
              <Input
                id="add-date"
                type="date"
                value={addFormData.date}
                onChange={(e) => setAddFormData({ ...addFormData, date: e.target.value })}
                className="border-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-time" className="font-bold">Time</Label>
              <Input
                id="add-time"
                type="time"
                value={addFormData.time}
                onChange={(e) => setAddFormData({ ...addFormData, time: e.target.value })}
                className="border-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-type" className="font-bold">Type</Label>
              <Select
                value={addFormData.type}
                onValueChange={(value: 'in' | 'out') =>
                  setAddFormData({ ...addFormData, type: value })
                }
              >
                <SelectTrigger id="add-type" className="border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Punch In</SelectItem>
                  <SelectItem value="out">Punch Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Punch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isOrgAdmin && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>This is a read-only view for accountability.</p>
        </div>
      )}
    </div>
  )
}
