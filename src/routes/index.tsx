import { useUser } from '@clerk/clerk-react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const { user, isSignedIn, isLoaded } = useUser()

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 max-w-4xl mx-auto flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold">packapunch</CardTitle>
          <CardDescription>
            {isLoaded && isSignedIn
              ? `Welcome back, ${user?.firstName || user?.emailAddresses[0]?.emailAddress || 'friend'}!`
              : 'Get started by signing in'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoaded ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : isSignedIn ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                You're signed in and ready to go.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/signup">Create Account</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
