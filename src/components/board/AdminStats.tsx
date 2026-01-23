import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

const getCurrentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function AdminStats() {
  const { currentBoard } = useBoardContext()

  const { data: usersStatus = [] } = useQuery({
    queryKey: ['allUsersStatus', currentBoard?.id],
    queryFn: () => getAllUsersStatus({ data: currentBoard!.id }),
    enabled: !!currentBoard?.id,
    refetchInterval: 30000,
  })

  const { data: monthlyStats = [] } = useQuery({
    queryKey: ['allUsersMonthlyStats', currentBoard?.id, getCurrentMonth()],
    queryFn: () => getAllUsersMonthlyStats({ data: { boardId: currentBoard!.id, month: getCurrentMonth() } }),
    enabled: !!currentBoard?.id,
  })

  const clockedInUsers = usersStatus.filter((u) => u.isClockedIn)
  const totalMonthHours = monthlyStats.reduce((sum, s) => sum + s.totalHours, 0)

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible">
      <Card className="shrink-0 w-[140px] sm:w-auto bg-[hsl(140_70%_85%)]">
        <CardContent className="p-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[hsl(140_80%_45%)] border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold">{clockedInUsers.length}</div>
              <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase">Currently In</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="shrink-0 w-[140px] sm:w-auto bg-[hsl(210_70%_85%)]">
        <CardContent className="p-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold">{usersStatus.length}</div>
              <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase">Total Members</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="shrink-0 w-[140px] sm:w-auto bg-[hsl(280_70%_88%)]">
        <CardContent className="p-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent border-2 border-foreground flex items-center justify-center shrink-0 shadow-[2px_2px_0px_hsl(0_0%_5%)]">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold">{formatHours(totalMonthHours)}</div>
              <p className="text-xs sm:text-sm text-muted-foreground font-bold uppercase">This Month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
