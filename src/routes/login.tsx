import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/clerk-react'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
      <SignIn routing="path" path="/login" signUpUrl="/signup" />
    </div>
  )
}
