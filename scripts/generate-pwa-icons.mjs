// scripts/generate-pwa-icons.mjs
// מריץ: node scripts/generate-pwa-icons.mjs

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

// SVG של האייקון — רקע כהה עם הלוגו ממורכז (ריבוע לPWA)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#070b14"/>
    </radialGradient>
    <radialGradient id="ballGrad" cx="38%" cy="32%" r="62%">
      <stop offset="0%"  stop-color="#60a5fa"/>
      <stop offset="45%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </radialGradient>
    <radialGradient id="ballShine" cx="30%" cy="25%" r="45%">
      <stop offset="0%"  stop-color="#bfdbfe" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#bfdbfe" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="crownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"  stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#a16207"/>
    </linearGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"  stop-color="#93c5fd"/>
      <stop offset="50%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#93c5fd"/>
    </linearGradient>
    <filter id="crownGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="ballGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- רקע -->
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>

  <!-- Orbit ring -->
  <circle cx="256" cy="248" r="152" stroke="url(#ringGrad)" stroke-width="2" stroke-dasharray="8 6" opacity="0.45"/>
  <circle cx="256" cy="96"  r="7" fill="#93c5fd" opacity="0.9"/>
  <circle cx="408" cy="248" r="7" fill="#93c5fd" opacity="0.9"/>
  <circle cx="256" cy="400" r="7" fill="#93c5fd" opacity="0.9"/>
  <circle cx="104" cy="248" r="7" fill="#93c5fd" opacity="0.9"/>

  <!-- Football -->
  <circle cx="256" cy="248" r="104" fill="url(#ballGrad)" filter="url(#ballGlow)"/>
  <circle cx="256" cy="248" r="104" fill="url(#ballShine)"/>

  <!-- Pentagon patches -->
  <polygon points="256,206 282,224 272,252 240,252 230,224" fill="#1d4ed8" stroke="#93c5fd" stroke-width="2"/>
  <polygon points="256,148 276,163 270,184 242,184 236,163" fill="#1e40af" stroke="#93c5fd" stroke-width="2"/>
  <polygon points="302,175 322,195 314,217 290,213 284,191" fill="#1d4ed8" stroke="#93c5fd" stroke-width="2"/>
  <polygon points="304,265 316,288 298,306 276,297 276,274" fill="#1e40af" stroke="#93c5fd" stroke-width="2"/>
  <polygon points="208,274 236,274 236,297 214,306 196,288" fill="#1d4ed8" stroke="#93c5fd" stroke-width="2"/>
  <polygon points="210,175 228,191 222,213 198,217 190,195" fill="#1e40af" stroke="#93c5fd" stroke-width="2"/>
  <circle cx="256" cy="248" r="104" stroke="#93c5fd" stroke-width="2" fill="none" opacity="0.4"/>

  <!-- Crown -->
  <rect x="212" y="130" width="88" height="20" rx="4" fill="url(#crownGrad)" filter="url(#crownGlow)"/>
  <polygon points="218,130 228,88 240,116 256,76 272,116 284,88 294,130" fill="url(#crownGrad)" filter="url(#crownGlow)"/>
  <polygon points="224,130 233,94 243,118 256,80 269,118 279,94 288,130" fill="#fef9c3" opacity="0.2"/>
  <circle cx="228" cy="90" r="5.5" fill="#fef08a"/>
  <circle cx="256" cy="77" r="6.5" fill="#fef08a"/>
  <circle cx="284" cy="90" r="5.5" fill="#fef08a"/>

  <!-- Text: GUESS -->
  <text x="256" y="448"
    font-family="'Arial Black', 'Arial', sans-serif"
    font-weight="900" font-size="58" letter-spacing="5"
    text-anchor="middle" fill="#ffffff">GUESS</text>

  <!-- Text: &amp; WIN -->
  <text x="256" y="500"
    font-family="'Arial Black', 'Arial', sans-serif"
    font-weight="900" font-size="50" letter-spacing="4"
    text-anchor="middle" fill="#eab308">&amp; WIN</text>
</svg>`

async function generate() {
  const svgBuf = Buffer.from(iconSvg)

  // 512×512
  await sharp(svgBuf).resize(512, 512).png().toFile('public/icon-512.png')
  console.log('✓ public/icon-512.png')

  // 192×192
  await sharp(svgBuf).resize(192, 192).png().toFile('public/icon-192.png')
  console.log('✓ public/icon-192.png')

  // Apple touch icon 180×180
  await sharp(svgBuf).resize(180, 180).png().toFile('public/apple-touch-icon.png')
  console.log('✓ public/apple-touch-icon.png')

  // favicon 32×32
  await sharp(svgBuf).resize(32, 32).png().toFile('public/favicon-32.png')
  console.log('✓ public/favicon-32.png')

  console.log('\nכל האייקונים נוצרו בהצלחה!')
}

generate().catch(console.error)
