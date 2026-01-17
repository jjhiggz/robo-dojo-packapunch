import { useUser } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calculateHoursFromPunches, getPunchHistory, getWeeklySummary } from '@/server/punches'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

const formatTime = (date: Date | string) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

const formatHours = (hours: number) => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0 && m === 0) return '0h'
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const getWeekStart = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const getMonthStart = (date: Date) => {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

const getMonthEnd = (date: Date) => {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  d.setHours(23, 59, 59, 999)
  return d
}

type ViewMode = 'week' | 'month'

function HistoryPage() {
  const { user, isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
  }, [weekStart])

  const monthStart = useMemo(() => getMonthStart(currentDate), [currentDate])
  const monthEnd = useMemo(() => getMonthEnd(currentDate), [currentDate])

  const startDate = viewMode === 'week' ? weekStart : monthStart
  const endDate = viewMode === 'week' ? weekEnd : monthEnd

  const { data: punches = [], isLoading } = useQuery({
    queryKey: ['punchHistory', user?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: () =>
      getPunchHistory({
        data: {
          userId: user!.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      }),
    enabled: !!user?.id,
  })

  const { data: weeklySummary = [] } = useQuery({
    queryKey: ['weeklySummary', user?.id, weekStart.toISOString()],
    queryFn: () =>
      getWeeklySummary({
        data: {
          userId: user!.id,
          weekStart: weekStart.toISOString(),
        },
      }),
    enabled: !!user?.id && viewMode === 'week',
  })

  // Group punches by day
  const punchesByDay = useMemo(() => {
    const grouped = new Map<string, typeof punches>()
    for (const p of punches) {
      const dateKey = new Date(p.timestamp).toISOString().split('T')[0]
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(p)
    }
    // Sort by date descending
    return Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [punches])

  const totalHours = useMemo(() => calculateHoursFromPunches(punches), [punches])

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const d = new Date(currentDate)
    if (viewMode === 'week') {
      d.setDate(d.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(d)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  if (!isLoaded) {
    return (
      <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isSignedIn) {
    navigate({ to: '/login' })
    return null
  }

  const periodLabel = viewMode === 'week'
    ? `${formatDate(weekStart)} - ${formatDate(weekEnd)}`
    : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-muted-foreground">View your punch history</p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={viewMode === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('week')}
        >
          Weekly
        </Button>
        <Button
          variant={viewMode === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('month')}
        >
          Monthly
        </Button>
      </div>

      {/* Period Navigation */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigatePeriod('prev')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <div className="font-medium">{periodLabel}</div>
              <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={goToToday}>
                Go to today
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigatePeriod('next')}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary Bar Chart */}
      {viewMode === 'week' && weeklySummary.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Weekly Overview</span>
              <span className="text-2xl">{formatHours(totalHours)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-32">
              {weeklySummary.map((day ) => {
                const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })
                const maxHours = Math.max(...weeklySummary.map(d => d.hours), 1)
                const heightPercent = (day.hours / maxHours) * 100
                const isToday = day.date === new Date().toISOString().split('T')[0]
                
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center justify-end h-24">
                      {day.hours > 0 && (
                        <span className="text-xs text-muted-foreground mb-1">
                          {formatHours(day.hours)}
                        </span>
                      )}
                      <div
                        className={`w-full rounded-t transition-all ${
                          isToday ? 'bg-primary' : 'bg-primary/60'
                        }`}
                        style={{ height: `${Math.max(heightPercent, day.hours > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                    <span className={`text-xs ${isToday ? 'font-bold' : 'text-muted-foreground'}`}>
                      {dayName}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Total */}
      {viewMode === 'month' && (
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="text-4xl font-bold">{formatHours(totalHours)}</div>
              <p className="text-muted-foreground">Total hours this month</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Punches by Day */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading history...</div>
      ) : punchesByDay.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No punches recorded for this period</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {punchesByDay.map(([date, dayPunches]) => {
            const dayHours = calculateHoursFromPunches(dayPunches)
            const isToday = date === new Date().toISOString().split('T')[0]
            
            return (
              <Card key={date} className={isToday ? 'border-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {formatDate(date)}
                      {isToday && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          Today
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">{formatHours(dayHours)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {[...dayPunches]
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                p.type === 'in' ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                            <span>{p.type === 'in' ? 'In' : 'Out'}</span>
                          </div>
                          <span className="text-muted-foreground">{formatTime(p.timestamp)}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}


