import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { getUserOrganizations, getUserBoardsInOrg, ensureUser, getUserOrgRole } from '@/server/punches'

interface Organization {
  id: number
  name: string
  slug: string
  role: string
}

interface Board {
  id: number
  organizationId: number
  name: string
  slug: string
}

interface BoardContextType {
  organizations: Organization[]
  currentOrg: Organization | null
  currentBoard: Board | null
  boards: Board[]
  isLoading: boolean
  isOrgAdmin: boolean
  setCurrentOrg: (org: Organization | null) => void
  setCurrentBoard: (board: Board | null) => void
}

const BoardContext = createContext<BoardContextType | null>(null)

const STORAGE_KEY_ORG = 'packapunch_current_org'
const STORAGE_KEY_BOARD = 'packapunch_current_board'

export const BoardProvider = ({ children }: { children: ReactNode }) => {
  const { user, isSignedIn, isLoaded } = useUser()
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null)
  const [currentBoard, setCurrentBoardState] = useState<Board | null>(null)

  // Ensure user exists in our database when they sign in
  useQuery({
    queryKey: ['ensureUser', user?.id],
    queryFn: () => {
      if (!user?.id) return null
      return ensureUser({
        data: {
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          name: user.fullName || user.firstName || undefined,
        },
      })
    },
    enabled: isSignedIn && !!user?.id,
  })

  // Fetch user's organizations
  const { data: organizations = [], isLoading: orgsLoading } = useQuery({
    queryKey: ['userOrganizations', user?.id],
    queryFn: () => getUserOrganizations({ data: user!.id }),
    enabled: isSignedIn && !!user?.id,
  })

  // Fetch boards for current org
  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ['userBoards', user?.id, currentOrg?.id],
    queryFn: () => getUserBoardsInOrg({ data: { userId: user!.id, organizationId: currentOrg!.id } }),
    enabled: isSignedIn && !!user?.id && !!currentOrg?.id,
  })

  // Get user's role in current org
  const { data: orgRole } = useQuery({
    queryKey: ['userOrgRole', user?.id, currentOrg?.id],
    queryFn: () => getUserOrgRole({ data: { userId: user!.id, organizationId: currentOrg!.id } }),
    enabled: isSignedIn && !!user?.id && !!currentOrg?.id,
  })

  const isOrgAdmin = orgRole === 'admin'

  // Restore saved org/board from localStorage on mount
  useEffect(() => {
    if (organizations.length > 0 && !currentOrg) {
      const savedOrgSlug = localStorage.getItem(STORAGE_KEY_ORG)
      const savedOrg = savedOrgSlug 
        ? organizations.find(o => o.slug === savedOrgSlug) 
        : null
      
      setCurrentOrgState(savedOrg || organizations[0])
    }
  }, [organizations, currentOrg])

  // Restore saved board when boards load
  useEffect(() => {
    if (boards.length > 0 && !currentBoard) {
      const savedBoardSlug = localStorage.getItem(STORAGE_KEY_BOARD)
      const savedBoard = savedBoardSlug 
        ? boards.find(b => b.slug === savedBoardSlug)
        : null
      
      setCurrentBoardState(savedBoard || boards[0])
    }
  }, [boards, currentBoard])

  // Clear board when org changes
  useEffect(() => {
    if (currentOrg && currentBoard && currentBoard.organizationId !== currentOrg.id) {
      setCurrentBoardState(null)
    }
  }, [currentOrg, currentBoard])

  const setCurrentOrg = (org: Organization | null) => {
    setCurrentOrgState(org)
    if (org) {
      localStorage.setItem(STORAGE_KEY_ORG, org.slug)
    } else {
      localStorage.removeItem(STORAGE_KEY_ORG)
    }
    // Clear board when org changes
    setCurrentBoardState(null)
    localStorage.removeItem(STORAGE_KEY_BOARD)
  }

  const setCurrentBoard = (board: Board | null) => {
    setCurrentBoardState(board)
    if (board) {
      localStorage.setItem(STORAGE_KEY_BOARD, board.slug)
    } else {
      localStorage.removeItem(STORAGE_KEY_BOARD)
    }
  }

  const isLoading = !isLoaded || orgsLoading || (!!currentOrg && boardsLoading)

  return (
    <BoardContext.Provider
      value={{
        organizations,
        currentOrg,
        currentBoard,
        boards,
        isLoading,
        isOrgAdmin,
        setCurrentOrg,
        setCurrentBoard,
      }}
    >
      {children}
    </BoardContext.Provider>
  )
}

export const useBoardContext = () => {
  const context = useContext(BoardContext)
  if (!context) {
    throw new Error('useBoardContext must be used within a BoardProvider')
  }
  return context
}
