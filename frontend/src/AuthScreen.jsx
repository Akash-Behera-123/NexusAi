
import { Show, SignIn, SignUp, UserButton } from '@clerk/react'
import './AuthScreen.css'

export default function AuthScreen() {
  const path = window.location.pathname

  if (path === '/sign-in' || path.startsWith('/sign-in/')) {
    return (
      <main className="auth-screen">
        <SignIn />
      </main>
    )
  }

  if (path === '/sign-up' || path.startsWith('/sign-up/')) {
    return (
      <main className="auth-screen">
        <SignUp />
      </main>
    )
  }

  return null
}
