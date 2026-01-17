import {
  SignedIn,
  UserButton,
  useUser,
} from '@clerk/clerk-react'

export default function HeaderUser() {
  const { user, isLoaded } = useUser()

  return (
    <SignedIn>
      <div className="flex items-center gap-4">
        {isLoaded && user && (
          <span className="text-sm text-gray-300">
            Hello, {user.firstName || user.emailAddresses[0]?.emailAddress || 'User'}
          </span>
        )}
        <UserButton />
      </div>
    </SignedIn>
  )
}
