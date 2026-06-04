import Image from 'next/image'

export default function RulesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Image
        src="/rule1.jpeg"
        alt="תקנון"
        width={900}
        height={600}
        className="w-full rounded-xl border border-border"
        priority
      />
      <Image
        src="/rule2.jpeg"
        alt="לוחות זמנים וחוקים"
        width={900}
        height={600}
        className="w-full rounded-xl border border-border"
      />
    </div>
  )
}
