import { Suspense } from 'react'
import { BackgroundBeamsWithCollision } from '@/components/ui/background-beams-with-collision'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <BackgroundBeamsWithCollision className="min-h-screen bg-gradient-to-b from-surface-deep via-base to-surface-deep">
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-8">
        <h1 className="font-suez text-5xl text-foreground mb-2 text-center drop-shadow-sm">
          Guess&amp;Win
        </h1>
        <p className="text-primary mb-8 text-center text-lg font-medium">ליגת ניחושי כדורגל</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </BackgroundBeamsWithCollision>
  )
}
