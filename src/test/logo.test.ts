import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const svgPath = resolve(process.cwd(), 'public/logo.svg')
const svg = readFileSync(svgPath, 'utf-8')

describe('logo.svg — structure', () => {
  it('is a valid SVG element', () => {
    expect(svg).toMatch(/^<svg\s/)
    expect(svg).toContain('</svg>')
  })

  it('has an explicit viewBox', () => {
    expect(svg).toMatch(/viewBox=/)
  })
})

describe('logo.svg — brand colors', () => {
  it('uses emerald green (#065f46 or #047857 or #10b981)', () => {
    expect(svg).toMatch(/#065f46|#047857|#10b981/i)
  })

  it('uses orange CTA color (#f97316)', () => {
    expect(svg).toContain('#f97316')
  })

  it('does not contain the old blue colors from the original logo', () => {
    // Old logo used a light sky blue — ensure it's gone
    expect(svg).not.toMatch(/#6cb4e8|#4a90d9/i)
  })
})

describe('logo.svg — content', () => {
  it('renders "GUESS" text', () => {
    expect(svg).toContain('GUESS')
  })

  it('renders "& WIN" text (as &amp; WIN in SVG)', () => {
    expect(svg).toMatch(/&amp; WIN|& WIN/)
  })

  it('has a crown shape (polygon)', () => {
    // Crown is a polygon with multiple points
    expect(svg).toMatch(/<polygon[^>]+points=/)
  })

  it('has a football circle', () => {
    expect(svg).toMatch(/<circle[^>]+r="62"/)
  })

  it('has gradient definitions', () => {
    expect(svg).toContain('<defs>')
    expect(svg).toMatch(/radialGradient|linearGradient/)
  })

  it('has at least one glow filter', () => {
    expect(svg).toMatch(/<filter\s/)
    expect(svg).toMatch(/feGaussianBlur/)
  })
})

describe('logo.svg — accessibility', () => {
  it('is used with an alt attribute in the app (checked via component source)', () => {
    // The Image component in LoginForm must pass alt="Guess&Win"
    const loginFormPath = resolve(process.cwd(), 'src/components/auth/LoginForm.tsx')
    const source = readFileSync(loginFormPath, 'utf-8')
    expect(source).toContain('alt="Guess&Win"')
    expect(source).toContain('src="/logo.svg"')
  })

  it('is used in the competitions page header', () => {
    const pagePath = resolve(process.cwd(), 'src/app/competitions/page.tsx')
    const source = readFileSync(pagePath, 'utf-8')
    expect(source).toContain('/logo.svg')
  })
})
