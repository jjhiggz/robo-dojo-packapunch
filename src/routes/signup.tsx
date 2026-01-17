import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/clerk-react'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
      <SignUp routing="path" path="/signup" signInUrl="/login" />
    </div>
  )
}
