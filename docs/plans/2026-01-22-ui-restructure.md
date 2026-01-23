# UI Restructuring: Board-Centric Navigation Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Restructure the UI to make boards the primary focus, move org selector to user profile area, consolidate admin features into board view, and create dedicated organization management section.

**Architecture:** Extract reusable dashboard components with editable prop, create new /board route combining punch + admin features, create /organization layout with nested tabs, reorganize header to show Board/Organization tabs with org selector in user profile.

**Tech Stack:** React, TanStack Router, TanStack Query, existing components and server functions (no database changes needed)

---

## Task 1: Extract Punch Controls Component

**Files:**
- Create: `src/components/board/PunchControls.tsx`
- Reference: `src/routes/index.tsx:30-100`

**Step 1: Create PunchControls component**

Extract the punch in/out logic from `src/routes/index.tsx`:

```typescript
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import { getPunchStatus, punch } from '@/server/punches'
import { Button } from '@/components/ui/button'

export function PunchControls() {
  const { user } = useUser()
  const { currentBoard } = useBoardContext()
  const queryClient = useQueryClient()

  const { data: punchData, isLoading } = useQuery({
    queryKey: ['punchStatus', user?.id, currentBoard?.id],
    queryFn: () =>
      getPunchStatus({
        data: {
          userId: user!.id,
          boardId: currentBoard!.id,
        },
      }),
    enabled: !!user?.id && !!currentBoard?.id,
    refetchInterval: 5000,
  })

  const punchMutation = useMutation({
    mutationFn: (type: 'in' | 'out') =>
      punch({
        data: {
          userId: user!.id,
          boardId: currentBoard!.id,
          userName: user?.fullName || user?.firstName || undefined,
          userEmail: user?.emailAddresses[0]?.emailAddress,
          type,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punchStatus'] })
      queryClient.invalidateQueries({ queryKey: ['todayPunches'] })
      queryClient.invalidateQueries({ queryKey: ['allUsersStatus'] })
      queryClient.invalidateQueries({ queryKey: ['allTodayPunches'] })
    },
  })

  const isClockedIn = punchData?.isClockedIn || false
  const lastPunch = punchData?.lastPunch

  if (!currentBoard) {
    return (
      <div className="bg-card border-2 border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Please select a board to start tracking time</p>
      </div>
    )
  }

  return (
    <div className="bg-card border-2 border-primary/50 rounded-lg p-6 shadow-neon-cyan-sm">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg border-2 border-primary">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">
              Current Status
            </p>
            <p className="text-xl font-bold">
              {isLoading ? (
                'Loading...'
              ) : isClockedIn ? (
                <>
                  Clocked In{' '}
                  <span className="text-sm text-muted-foreground">
                    since {lastPunch ? new Date(lastPunch.timestamp).toLocaleTimeString() : ''}
                  </span>
                </>
              ) : (
                <>
                  Clocked Out{' '}
                  <span className="text-sm text-muted-foreground">
                    {lastPunch ? `at ${new Date(lastPunch.timestamp).toLocaleTimeString()}` : ''}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => punchMutation.mutate('in')}
            disabled={isClockedIn || punchMutation.isPending || isLoading}
            className="min-w-[120px]"
            size="lg"
          >
            {punchMutation.isPending ? 'Punching...' : 'Clock In'}
          </Button>
          <Button
            onClick={() => punchMutation.mutate('out')}
            disabled={!isClockedIn || punchMutation.isPending || isLoading}
            variant="outline"
            className="min-w-[120px]"
            size="lg"
          >
            {punchMutation.isPending ? 'Punching...' : 'Clock Out'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Test the component**

Create a temporary test route to verify the component works in isolation.

**Step 3: Commit**

```bash
git add src/components/board/PunchControls.tsx
git commit -m "feat: extract PunchControls component"
```

---

## Task 2: Extract Admin Stats Component

**Files:**
- Create: `src/components/board/AdminStats.tsx`
- Reference: `src/routes/admin.index.tsx:40-80`

**Step 1: Create AdminStats component**

```typescript
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/clerk-react'
import { Users, Clock } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import { getAllUsersStatus, getAllTodayPunches, calculateHoursFromPunches } from '@/server/punches'

export function AdminStats() {
  const { user } = useUser()
  const { currentBoard } = useBoardContext()

  const { data: usersStatus = [] } = useQuery({
    queryKey: ['allUsersStatus', currentBoard?.id],
    queryFn: () => getAllUsersStatus({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id,
    refetchInterval: 10000,
  })

  const { data: todayPunches = [] } = useQuery({
    queryKey: ['allTodayPunches', currentBoard?.id],
    queryFn: () => getAllTodayPunches({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id,
    refetchInterval: 10000,
  })

  const clockedInCount = usersStatus.filter((u) => u.isClockedIn).length
  const totalStudents = usersStatus.length
  const monthHours = calculateHoursFromPunches(todayPunches)

  const stats = [
    {
      label: 'Online',
      value: clockedInCount,
      icon: '🟢',
      color: 'text-green-500',
    },
    {
      label: 'Students',
      value: totalStudents,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      label: 'This Month',
      value: `${monthHours.toFixed(1)}h`,
      icon: Clock,
      color: 'text-purple-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-card border-2 border-border rounded-lg p-6 hover:border-primary/50 transition-all hover:shadow-neon-cyan-sm"
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded border border-primary">
              {typeof stat.icon === 'string' ? (
                <span className="text-2xl">{stat.icon}</span>
              ) : (
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Test the component**

Verify stats display correctly with live data.

**Step 3: Commit**

```bash
git add src/components/board/AdminStats.tsx
git commit -m "feat: extract AdminStats component"
```

---

## Task 3: Extract Live Status Table Component

**Files:**
- Create: `src/components/board/LiveStatusTable.tsx`
- Reference: `src/routes/admin.index.tsx:100-200`

**Step 1: Create LiveStatusTable component with editable prop**

```typescript
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useBoardContext } from '@/lib/board-context'
import { getAllUsersStatus } from '@/server/punches'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

interface LiveStatusTableProps {
  editable: boolean
  currentUserId: string
}

export function LiveStatusTable({ editable, currentUserId }: LiveStatusTableProps) {
  const { currentBoard } = useBoardContext()

  const { data: usersStatus = [], isLoading } = useQuery({
    queryKey: ['allUsersStatus', currentBoard?.id],
    queryFn: () => getAllUsersStatus({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id,
    refetchInterval: 10000,
  })

  if (isLoading) {
    return (
      <div className="bg-card border-2 border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Loading live status...</p>
      </div>
    )
  }

  return (
    <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b-2 border-border">
        <h2 className="text-lg font-bold uppercase tracking-wider">Live Status</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Punch</TableHead>
            {editable && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {usersStatus.length === 0 ? (
            <TableRow>
              <TableCell colSpan={editable ? 5 : 4} className="text-center text-muted-foreground">
                No students have punched in yet
              </TableCell>
            </TableRow>
          ) : (
            usersStatus.map((userStatus) => (
              <TableRow
                key={userStatus.userId}
                className={userStatus.userId === currentUserId ? 'bg-accent/20' : ''}
              >
                <TableCell className="font-medium">
                  {userStatus.userName || 'Unknown'}
                </TableCell>
                <TableCell>{userStatus.userEmail || 'N/A'}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                      userStatus.isClockedIn
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-gray-500/20 text-gray-500'
                    }`}
                  >
                    {userStatus.isClockedIn ? '🟢 Clocked In' : '⚪ Clocked Out'}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date(userStatus.lastPunchTime).toLocaleString()}
                </TableCell>
                {editable && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        to="/admin/students/$userId"
                        params={{ userId: userStatus.userId }}
                      >
                        View Details
                      </Link>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Test the component**

Verify table displays correctly for both editable and non-editable modes.

**Step 3: Commit**

```bash
git add src/components/board/LiveStatusTable.tsx
git commit -m "feat: extract LiveStatusTable component with editable prop"
```

---

## Task 4: Extract Monthly Stats Section Component

**Files:**
- Create: `src/components/board/MonthlyStatsSection.tsx`
- Reference: `src/routes/admin.index.tsx:200-350`

**Step 1: Create MonthlyStatsSection component**

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useBoardContext } from '@/lib/board-context'
import { getAllUsersMonthlyStats } from '@/server/punches'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface MonthlyStatsSectionProps {
  editable: boolean
  currentUserId: string
}

export function MonthlyStatsSection({ editable, currentUserId }: MonthlyStatsSectionProps) {
  const { currentBoard } = useBoardContext()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: monthlyStats = [], isLoading } = useQuery({
    queryKey: ['monthlyStats', currentBoard?.id, month],
    queryFn: () =>
      getAllUsersMonthlyStats({ data: { boardId: currentBoard!.id, month } }),
    enabled: !!currentBoard?.id,
  })

  if (isLoading) {
    return (
      <div className="bg-card border-2 border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Loading monthly stats...</p>
      </div>
    )
  }

  return (
    <div className="bg-card border-2 border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b-2 border-border flex items-center justify-between">
        <h2 className="text-lg font-bold uppercase tracking-wider">Monthly Stats</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 bg-background border-2 border-border rounded"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Total Hours</TableHead>
            <TableHead className="text-right">Days Worked</TableHead>
            <TableHead className="text-right">Avg Hours/Day</TableHead>
            <TableHead className="text-right">Punches</TableHead>
            {editable && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthlyStats.length === 0 ? (
            <TableRow>
              <TableCell colSpan={editable ? 7 : 6} className="text-center text-muted-foreground">
                No data for this month
              </TableCell>
            </TableRow>
          ) : (
            monthlyStats.map((stat) => (
              <TableRow
                key={stat.userId}
                className={stat.userId === currentUserId ? 'bg-accent/20' : ''}
              >
                <TableCell className="font-medium">
                  {stat.userName || 'Unknown'}
                </TableCell>
                <TableCell>{stat.userEmail || 'N/A'}</TableCell>
                <TableCell className="text-right">
                  {stat.totalHours.toFixed(1)}h
                </TableCell>
                <TableCell className="text-right">{stat.daysWorked}</TableCell>
                <TableCell className="text-right">
                  {stat.avgHoursPerDay.toFixed(1)}h
                </TableCell>
                <TableCell className="text-right">{stat.punchCount}</TableCell>
                {editable && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        to="/admin/students/$userId"
                        params={{ userId: stat.userId }}
                      >
                        View Details
                      </Link>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Test the component**

Verify stats display correctly and month selector works.

**Step 3: Commit**

```bash
git add src/components/board/MonthlyStatsSection.tsx
git commit -m "feat: extract MonthlyStatsSection component with editable prop"
```

---

## Task 5: Create New Board Route

**Files:**
- Create: `src/routes/board.tsx`

**Step 1: Create board route combining all components**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useBoardContext } from '@/lib/board-context'
import { PunchControls } from '@/components/board/PunchControls'
import { AdminStats } from '@/components/board/AdminStats'
import { LiveStatusTable } from '@/components/board/LiveStatusTable'
import { MonthlyStatsSection } from '@/components/board/MonthlyStatsSection'

export const Route = createFileRoute('/board')({
  component: BoardPage,
})

function BoardPage() {
  const { user } = useUser()
  const { currentBoard, isOrgAdmin } = useBoardContext()

  if (!currentBoard) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-card border-2 border-border rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">No Board Selected</h2>
          <p className="text-muted-foreground">
            Please select a board from the header to start tracking time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Punch Controls - Everyone can punch in/out */}
      <PunchControls />

      {/* Admin Stats - Only visible for org admins */}
      {isOrgAdmin && <AdminStats />}

      {/* Live Status Table - Everyone sees it, admins can edit */}
      <LiveStatusTable editable={isOrgAdmin} currentUserId={user?.id || ''} />

      {/* Monthly Stats - Everyone sees it, admins can edit */}
      <MonthlyStatsSection editable={isOrgAdmin} currentUserId={user?.id || ''} />
    </div>
  )
}
```

**Step 2: Test the board route**

Navigate to /board and verify:
- Punch controls work
- Admin stats show for admins only
- Tables display correctly
- Edit buttons show for admins only

**Step 3: Commit**

```bash
git add src/routes/board.tsx
git commit -m "feat: create new board route with punch controls and admin dashboard"
```

---

## Task 6: Create Organization Layout Route

**Files:**
- Create: `src/routes/organization.tsx`

**Step 1: Create organization layout with tabs**

```typescript
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'

export const Route = createFileRoute('/organization')({
  component: OrganizationLayout,
})

function OrganizationLayout() {
  const { currentOrg, isOrgAdmin } = useBoardContext()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  if (!currentOrg) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-card border-2 border-border rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">
            Please select an organization from your profile to manage it.
          </p>
        </div>
      </div>
    )
  }

  // Non-admin view
  if (!isOrgAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-card border-2 border-border rounded-lg p-8 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">You are a member of {currentOrg.name}</h2>
          <p className="text-muted-foreground">
            Contact an administrator to manage boards, members, or settings.
          </p>
        </div>
      </div>
    )
  }

  // Admin view with tabs
  const tabs = [
    { path: '/organization/boards', label: 'Boards' },
    { path: '/organization/members', label: 'Members' },
    { path: '/organization/settings', label: 'Settings' },
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Building2 className="w-8 h-8" />
          {currentOrg.name}
        </h1>
        <p className="text-muted-foreground mt-2">Manage your organization</p>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-border mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-4 py-3 font-semibold uppercase tracking-wider transition-all duration-200 border-b-2 ${
                currentPath === tab.path
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <Outlet />
    </div>
  )
}
```

**Step 2: Test the layout**

Navigate to /organization and verify:
- Non-admins see read-only message
- Admins see tabs
- Tab navigation works

**Step 3: Commit**

```bash
git add src/routes/organization.tsx
git commit -m "feat: create organization layout route with admin/non-admin views"
```

---

## Task 7: Create Organization Boards Tab

**Files:**
- Create: `src/routes/organization.boards.tsx`
- Reference: Existing board creation logic from `/admin`

**Step 1: Create boards management tab**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, Plus } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import { getUserBoardsInOrg, createBoard } from '@/server/punches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/organization/boards')({
  component: OrganizationBoardsPage,
})

function OrganizationBoardsPage() {
  const { user } = useUser()
  const { currentOrg } = useBoardContext()
  const queryClient = useQueryClient()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [createError, setCreateError] = useState('')

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ['userBoards', user?.id, currentOrg?.id],
    queryFn: () =>
      getUserBoardsInOrg({
        data: { userId: user!.id, organizationId: currentOrg!.id },
      }),
    enabled: !!user?.id && !!currentOrg?.id,
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      return createBoard({
        data: {
          userId: user!.id,
          organizationId: currentOrg!.id,
          name,
          slug,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userBoards'] })
      setCreateDialogOpen(false)
      setNewBoardName('')
      setCreateError('')
    },
    onError: (error: Error) => {
      setCreateError(error.message)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage boards within {currentOrg?.name}
        </p>
        <Button
          onClick={() => {
            setNewBoardName('')
            setCreateError('')
            setCreateDialogOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Board
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading boards...</p>
        </div>
      ) : boards.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center">
          <LayoutGrid className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">No Boards Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first board to start tracking time
          </p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Board
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boards.map((board) => (
            <div
              key={board.id}
              className="bg-card border-2 border-border rounded-lg p-6 hover:border-primary/50 transition-all hover:shadow-neon-cyan-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/20 p-2 rounded border border-primary">
                    <LayoutGrid className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{board.name}</h3>
                    <p className="text-xs text-muted-foreground">{board.slug}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  Edit
                </Button>
                <Button variant="destructive" size="sm" className="flex-1">
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Board Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Board</DialogTitle>
            <DialogDescription>
              Create a new board to track time for different projects or teams.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="board-name">Board Name</Label>
              <Input
                id="board-name"
                placeholder="Development Team"
                value={newBoardName}
                onChange={(e) => {
                  setNewBoardName(e.target.value)
                  setCreateError('')
                }}
              />
              {newBoardName && (
                <p className="text-xs text-muted-foreground">
                  Slug: {newBoardName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                </p>
              )}
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newBoardName.trim()) {
                  setCreateError('Board name is required')
                  return
                }
                createMutation.mutate(newBoardName)
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 2: Test the boards tab**

Navigate to /organization/boards and verify:
- Boards display correctly
- Create board dialog works
- Board creation succeeds

**Step 3: Commit**

```bash
git add src/routes/organization.boards.tsx
git commit -m "feat: create organization boards management tab"
```

---

## Task 8: Create Organization Members Tab

**Files:**
- Create: `src/routes/organization.members.tsx`
- Reference: `src/routes/admin.members.tsx`

**Step 1: Move admin.members logic to organization.members**

Copy the entire content from `src/routes/admin.members.tsx` and adapt it:

```typescript
import { createFileRoute } from '@tanstack/react-router'
// ... copy all imports from admin.members.tsx ...

export const Route = createFileRoute('/organization/members')({
  component: OrganizationMembersPage,
})

function OrganizationMembersPage() {
  // ... copy all the logic from admin.members.tsx ...
  // Update any references to match the new context
}
```

**Step 2: Update any hardcoded references**

Make sure all organization/board references use the context correctly.

**Step 3: Test the members tab**

Navigate to /organization/members and verify:
- Members display correctly
- Invite functionality works
- Board assignment works
- Remove functionality works

**Step 4: Commit**

```bash
git add src/routes/organization.members.tsx
git commit -m "feat: create organization members management tab"
```

---

## Task 9: Create Organization Settings Tab

**Files:**
- Create: `src/routes/organization.settings.tsx`

**Step 1: Create settings tab with org info**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/organization/settings')({
  component: OrganizationSettingsPage,
})

function OrganizationSettingsPage() {
  const { currentOrg } = useBoardContext()

  if (!currentOrg) {
    return null
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border-2 border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Organization Information</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <Input value={currentOrg.name} disabled />
            <p className="text-xs text-muted-foreground">
              Contact a superadmin to change the organization name
            </p>
          </div>

          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={currentOrg.slug} disabled />
            <p className="text-xs text-muted-foreground">
              Auto-generated from organization name
            </p>
          </div>

          <div className="space-y-2">
            <Label>Created</Label>
            <Input
              value={new Date(currentOrg.createdAt).toLocaleDateString()}
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label>Your Role</Label>
            <Input value={currentOrg.role} disabled className="capitalize" />
          </div>
        </div>
      </div>

      <div className="bg-card border-2 border-border rounded-lg p-6">
        <h3 className="font-bold mb-2">Future Settings</h3>
        <p className="text-sm text-muted-foreground">
          Additional organization settings will be added here in future updates.
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Test the settings tab**

Navigate to /organization/settings and verify org info displays correctly.

**Step 3: Commit**

```bash
git add src/routes/organization.settings.tsx
git commit -m "feat: create organization settings tab"
```

---

## Task 10: Update Header - Move Org Selector to User Profile

**Files:**
- Modify: `src/integrations/clerk/header-user.tsx`
- Modify: `src/components/Header.tsx:98-132`

**Step 1: Add org selector to user profile dropdown**

In `src/integrations/clerk/header-user.tsx`, add org selector:

```typescript
import { UserButton } from '@clerk/clerk-react'
import { Building2, ChevronDown } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export default function ClerkHeader() {
  const { organizations, currentOrg, setCurrentOrg } = useBoardContext()

  return (
    <div className="flex items-center gap-2">
      {/* Organization Selector */}
      {organizations.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{currentOrg?.name || 'Select Org'}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setCurrentOrg(org)}
                className={currentOrg?.id === org.id ? 'bg-accent/20' : ''}
              >
                {org.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Clerk User Button */}
      <UserButton />
    </div>
  )
}
```

**Step 2: Remove org selector from Header, keep board selector**

In `src/components/Header.tsx`, update the selectors section:

```typescript
{/* Right side: Board selector only */}
{hasBoards && (
  <div className="flex items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 font-medium px-2 text-xs hover:bg-secondary/20"
        >
          <LayoutGrid className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="hidden sm:inline max-w-[120px] truncate">
            {currentBoard?.name || 'Board'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>Boards</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {boards.map((board) => (
          <DropdownMenuItem
            key={board.id}
            onClick={() => setCurrentBoard(board)}
            className={currentBoard?.id === board.id ? 'bg-accent/20' : ''}
          >
            <LayoutGrid className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">{board.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)}
```

**Step 3: Test the reorganized header**

Verify:
- Org selector appears in user profile area
- Board selector still in header
- Both selectors work correctly

**Step 4: Commit**

```bash
git add src/integrations/clerk/header-user.tsx src/components/Header.tsx
git commit -m "feat: move org selector to user profile area, keep board selector in header"
```

---

## Task 11: Update Header Tabs (Board/Organization)

**Files:**
- Modify: `src/components/Header.tsx:68-95`

**Step 1: Replace My Hours/Admin tabs with Board/Organization**

Update the tabs section:

```typescript
{/* Bottom row: Navigation tabs + Board selector */}
{isSignedIn && (
  <nav className="px-4 pb-0 flex items-end justify-between gap-2 relative z-10">
    {/* Left side: Page tabs */}
    <div className="flex gap-1 sm:gap-2">
      <Link
        to="/board"
        className={`px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all duration-200 rounded-t border-2 border-b-0 ${
          currentPath === '/board'
            ? 'bg-card text-secondary border-secondary shadow-neon-cyan-sm translate-y-[2px]'
            : 'bg-background/50 text-muted-foreground border-muted hover:text-secondary hover:border-secondary/50 hover:shadow-neon-cyan-sm'
        }`}
      >
        Board
      </Link>
      {organizations.length > 0 && (
        <Link
          to="/organization/boards"
          className={`px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider transition-all duration-200 flex items-center gap-1 sm:gap-2 rounded-t border-2 border-b-0 ${
            currentPath.startsWith('/organization')
              ? 'bg-card text-accent border-accent shadow-neon-purple translate-y-[2px]'
              : 'bg-background/50 text-muted-foreground border-muted hover:text-accent hover:border-accent/50 hover:shadow-neon-purple'
          }`}
        >
          <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">Organization</span>
        </Link>
      )}
    </div>

    {/* Right side: Board selector */}
    {/* ... keep existing board selector code ... */}
  </nav>
)}
```

**Step 2: Remove isOrgAdmin check from tabs**

The Organization tab should show for all org members (they'll see read-only view).

**Step 3: Test tab navigation**

Verify:
- Board tab shows for everyone
- Organization tab shows for org members
- Tabs highlight correctly on navigation
- Non-admins see read-only org view

**Step 4: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: replace My Hours/Admin tabs with Board/Organization tabs"
```

---

## Task 12: Add Default Route Redirect

**Files:**
- Modify: `src/routes/index.tsx` OR Create redirect

**Step 1: Update root index to redirect to /board**

Option A - Replace index.tsx:
```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/board' })
  },
})
```

Option B - Keep index.tsx and add navigation:
```typescript
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/')({
  component: IndexRedirect,
})

function IndexRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: '/board' })
  }, [navigate])

  return null
}
```

**Step 2: Test redirect**

Navigate to / and verify it redirects to /board.

**Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: redirect root route to /board"
```

---

## Task 13: Clean Up Old Routes

**Files:**
- Delete: `src/routes/admin.index.tsx`
- Delete: `src/routes/admin.tsx`
- Delete: `src/routes/admin.members.tsx`
- Keep: `src/routes/admin.students.$userId.tsx` (still needed for detail view)

**Step 1: Remove old admin routes**

```bash
git rm src/routes/admin.index.tsx src/routes/admin.tsx src/routes/admin.members.tsx
```

**Step 2: Update student detail route path**

Rename `src/routes/admin.students.$userId.tsx` → `src/routes/students.$userId.tsx`

Update any imports in the file if needed.

**Step 3: Update links to student detail page**

In `src/components/board/LiveStatusTable.tsx` and `src/components/board/MonthlyStatsSection.tsx`, update:

```typescript
<Link
  to="/students/$userId"  // Changed from /admin/students/$userId
  params={{ userId: stat.userId }}
>
  View Details
</Link>
```

**Step 4: Test student detail page**

Click "View Details" and verify the student detail page loads correctly.

**Step 5: Commit**

```bash
git add .
git commit -m "refactor: remove old admin routes, rename student detail route"
```

---

## Task 14: Handle History Route

**Files:**
- Option 1: Delete `src/routes/history.tsx`
- Option 2: Keep for backward compatibility

**Step 1: Decide on history route**

Since the Board page now shows history for everyone, the dedicated /history route is redundant.

Recommended: Delete it
```bash
git rm src/routes/history.tsx
```

**Step 2: Update any links to history**

Search for any references to `/history` in the codebase and remove them.

**Step 3: Test navigation**

Ensure no broken links exist.

**Step 4: Commit**

```bash
git add .
git commit -m "refactor: remove redundant history route"
```

---

## Task 15: Add Missing Imports to Header

**Files:**
- Modify: `src/components/Header.tsx:1-15`

**Step 1: Verify all imports are present**

Make sure these imports exist at the top:

```typescript
import { useUser } from '@clerk/clerk-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Building2, ChevronDown, LayoutGrid } from 'lucide-react'
import { useBoardContext } from '@/lib/board-context'
import ClerkHeader from '../integrations/clerk/header-user.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
```

**Step 2: Commit if changes needed**

```bash
git add src/components/Header.tsx
git commit -m "fix: add missing imports to Header component"
```

---

## Task 16: End-to-End Testing

**Files:**
- Manual testing only

**Step 1: Test as non-admin user**

- Log in as regular user
- Verify Board tab visible
- Verify Organization tab visible
- Navigate to Board - see punch controls + tables (no edit buttons)
- Navigate to Organization - see "You are a member" message
- Verify org selector in profile area
- Verify board selector in header

**Step 2: Test as org admin**

- Log in as org admin
- Navigate to Board - see all features with edit buttons
- Navigate to Organization/Boards - verify board management works
- Navigate to Organization/Members - verify member management works
- Navigate to Organization/Settings - verify org info displays
- Test creating board
- Test inviting member
- Test punch in/out

**Step 3: Test navigation flow**

- Switch orgs via profile dropdown
- Verify board selector updates
- Switch boards via header dropdown
- Verify Board page updates
- Navigate between tabs
- Verify state persists correctly

**Step 4: Test edge cases**

- User with no orgs
- User with no boards
- User switching between admin and non-admin orgs
- Concurrent punch operations

**Step 5: Document any issues**

Create list of bugs found during testing.

**Step 6: Create final commit for any fixes**

```bash
git add .
git commit -m "fix: address issues found in end-to-end testing"
```

---

## Completion Checklist

- [ ] PunchControls component extracted
- [ ] AdminStats component extracted
- [ ] LiveStatusTable component extracted with editable prop
- [ ] MonthlyStatsSection component extracted with editable prop
- [ ] New /board route created combining all components
- [ ] Organization layout route created with admin/non-admin views
- [ ] Organization/Boards tab created
- [ ] Organization/Members tab created
- [ ] Organization/Settings tab created
- [ ] Org selector moved to user profile area
- [ ] Board selector kept in header
- [ ] Header tabs updated to Board/Organization
- [ ] Root route redirects to /board
- [ ] Old admin routes removed
- [ ] Student detail route updated
- [ ] History route removed (if decided)
- [ ] All imports verified
- [ ] End-to-end testing completed
- [ ] No regressions for existing functionality
- [ ] UI flows correctly for both admin and non-admin users

---

## Next Steps After Implementation

1. Merge this branch with the superadmin-org-management branch
2. Test the combined functionality
3. Create pull request for code review
4. Update any documentation
5. Deploy to staging for user testing
6. Gather feedback on new navigation structure
