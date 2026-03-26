import { BackgroundBeamsWithCollision } from '@/components/ui/background-beams-with-collision'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <BackgroundBeamsWithCollision className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900">
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-8">
        <h1 className="font-suez text-5xl text-white mb-2 text-center drop-shadow-lg">
          Guess&amp;Win
        </h1>
        <p className="text-indigo-200 mb-8 text-center text-lg">ליגת ניחושי כדורגל</p>
        <LoginForm />
      </div>
    </BackgroundBeamsWithCollision>
  )
}
