import { BackgroundBeamsWithCollision } from '@/components/ui/background-beams-with-collision'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <BackgroundBeamsWithCollision className="min-h-screen bg-gradient-to-b from-[#0a0e1a] via-[#0d1b14] to-[#0a0e1a]">
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-8">
        <h1 className="font-suez text-5xl text-white mb-2 text-center drop-shadow-lg">
          Guess&amp;Win
        </h1>
        <p className="text-emerald-200 mb-8 text-center text-lg">ליגת ניחושי כדורגל</p>
        <LoginForm />
      </div>
    </BackgroundBeamsWithCollision>
  )
}
