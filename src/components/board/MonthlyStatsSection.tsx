import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getAllUsersMonthlyStats, getAllUsersStatus } from '@/server/punches'
import { useBoardContext } from '@/lib/board-context'

const formatHours = (hours: number) => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0 && m === 0) return '0h'
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const getAdjacentMonth = (monthStr: string, direction: 'prev' | 'next') => {
  const [year, month] = monthStr.split('-').map(Number)
  const date = new Date(year, month - 1 + (direction === 'next' ? 1 : -1))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

interface MonthlyStatsSectionProps {
  editable: boolean
  currentUserId: string
}

export function MonthlyStatsSection({ editable, currentUserId }: MonthlyStatsSectionProps) {
  const navigate = useNavigate()
  const { currentBoard } = useBoardContext()
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const { data: usersStatus = [] } = useQuery({
    queryKey: ['allUsersStatus', currentBoard?.id],
    queryFn: () => getAllUsersStatus({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id,
    refetchInterval: 30000,
  })

  const { data: monthlyStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['allUsersMonthlyStats', currentBoard?.id, selectedMonth],
    queryFn: () => getAllUsersMonthlyStats({ data: { boardId: currentBoard!.id, month: selectedMonth } }),
    enabled: !!currentBoard?.id,
  })

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedMonth(getAdjacentMonth(selectedMonth, direction))
  }

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        {/* Month Navigation */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="flex-1 text-center font-extrabold uppercase">
            {formatMonth(selectedMonth)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateMonth('next')}
            disabled={selectedMonth === getCurrentMonth()}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center font-medium">
          {editable ? 'Tap a member for details' : 'Monthly hours summary'}
        </p>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {statsLoading ? (
          <div className="text-center py-8 text-muted-foreground font-bold uppercase">Loading...</div>
        ) : monthlyStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm font-medium">
            No activity recorded for this month
          </div>
        ) : (
          <div className="space-y-2">
            {monthlyStats.slice(0, 50).map((stat) => {
              const currentStatus = usersStatus.find((u) => u.userId === stat.userId)
              const isClockedIn = currentStatus?.isClockedIn ?? false
              const isCurrentUser = stat.userId === currentUserId

              const content = (
                <>
                  {/* Status dot */}
                  <div
                    className={`w-3 h-3 shrink-0 border-2 border-foreground ${
                      isClockedIn ? 'bg-[hsl(140_80%_45%)]' : 'bg-muted'
                    }`}
                  />

                  {/* Name and email */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">
                      {stat.userName || 'Unknown'}
                      {isCurrentUser && ' (You)'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate hidden xs:block font-medium">
                      {stat.userEmail || '-'}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-sm sm:text-base">
                      {formatHours(stat.totalHours)}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {stat.daysWorked}d · {formatHours(stat.avgHoursPerDay)}/d
                    </div>
                  </div>
                </>
              )

              return editable ? (
                <button
                  key={stat.userId}
                  type="button"
                  className={`w-full flex items-center gap-3 p-4 text-left transition-all border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)] hover:shadow-[3px_3px_0px_hsl(0_0%_5%)] hover:-translate-x-px hover:-translate-y-px ${
                    isClockedIn ? 'bg-[hsl(140_70%_90%)]' : 'bg-card hover:bg-muted'
                  }`}
                  onClick={() => navigate({ to: '/admin/students/$userId', params: { userId: stat.userId } })}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={stat.userId}
                  className={`flex items-center gap-3 p-4 border-2 border-foreground shadow-[2px_2px_0px_hsl(0_0%_5%)] ${
                    isClockedIn ? 'bg-[hsl(140_70%_90%)]' : 'bg-card'
                  }`}
                >
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
