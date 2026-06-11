# Graph Report - .  (2026-05-26)

## Corpus Check
- 155 files · ~268,129 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 704 nodes · 1296 edges · 50 communities (42 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth & Admin Shell|Auth & Admin Shell]]
- [[_COMMUNITY_Betting & Bonus Logic|Betting & Bonus Logic]]
- [[_COMMUNITY_Tournament & Joker Context|Tournament & Joker Context]]
- [[_COMMUNITY_Match Sync & Fixtures API|Match Sync & Fixtures API]]
- [[_COMMUNITY_Admin UI Components|Admin UI Components]]
- [[_COMMUNITY_Dev Guidelines & Design System|Dev Guidelines & Design System]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Tournament Bracket|Tournament Bracket]]
- [[_COMMUNITY_External Football API|External Football API]]
- [[_COMMUNITY_shadcnui Config|shadcn/ui Config]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Password Change Tests|Password Change Tests]]
- [[_COMMUNITY_Match Card Tests|Match Card Tests]]
- [[_COMMUNITY_Hash  Caching Util|Hash / Caching Util]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_Login Form Tests|Login Form Tests]]
- [[_COMMUNITY_Brand Logo SVG|Brand Logo SVG]]
- [[_COMMUNITY_App Root Layout|App Root Layout]]
- [[_COMMUNITY_PWA Icons|PWA Icons]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_NPM Scripts|NPM Scripts]]
- [[_COMMUNITY_FIFA World Cup 2026|FIFA World Cup 2026]]
- [[_COMMUNITY_Apple Touch Icon|Apple Touch Icon]]
- [[_COMMUNITY_bet365 Integration|bet365 Integration]]
- [[_COMMUNITY_bet365 Brand Assets|bet365 Brand Assets]]
- [[_COMMUNITY_Favicon|Favicon]]
- [[_COMMUNITY_Default UI Icons|Default UI Icons]]
- [[_COMMUNITY_PWA Icon 192|PWA Icon 192]]
- [[_COMMUNITY_App Instrumentation|App Instrumentation]]
- [[_COMMUNITY_Logo Tests|Logo Tests]]
- [[_COMMUNITY_Window SVG Icon|Window SVG Icon]]
- [[_COMMUNITY_File SVG Icon|File SVG Icon]]
- [[_COMMUNITY_MCP Config|MCP Config]]
- [[_COMMUNITY_Next.js Assets|Next.js Assets]]
- [[_COMMUNITY_Vercel Assets|Vercel Assets]]
- [[_COMMUNITY_Package Identity|Package Identity]]
- [[_COMMUNITY_Matches API Response|Matches API Response]]
- [[_COMMUNITY_API Proxy|API Proxy]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Vercel Cron Config|Vercel Cron Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_shadcnui Reference|shadcn/ui Reference]]
- [[_COMMUNITY_Web Design Guidelines|Web Design Guidelines]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 54 edges
2. `requireAdmin()` - 31 edges
3. `useAuth()` - 27 edges
4. `useTournament()` - 27 edges
5. `supabaseAdmin` - 20 edges
6. `createSupabaseServerClient()` - 19 edges
7. `compilerOptions` - 16 edges
8. `Match` - 11 edges
9. `syncLiveMatches()` - 10 edges
10. `translateTeam()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Guess & Win Application` --conceptually_related_to--> `Frontend Design Skill`  [INFERRED]
  README.md → .agents/skills/frontend-design/SKILL.md
- `Vercel Best Practices` --references--> `Next.js Agent Rules`  [EXTRACTED]
  claude.md → AGENTS.md
- `Next.js Agent Rules` --conceptually_related_to--> `Next.js App Router`  [INFERRED]
  AGENTS.md → .agents/skills/shadcn-ui/references/nextjs-integration.md
- `Guess & Win Application` --conceptually_related_to--> `Vercel Best Practices`  [INFERRED]
  README.md → claude.md
- `Design Preview HTML` --implements--> `Frontend Design Principles (Anti-Generic)`  [INFERRED]
  design-preview.html → .agents/skills/frontend-design/SKILL.md

## Hyperedges (group relationships)
- **shadcn/ui Skill Documentation Ecosystem** — skill_shadcn_ui, ref_setup_config_md, ref_ui_components_md, ref_forms_validation_md, ref_charts_components_md, ref_nextjs_integration_md, ref_customization_md, ref_chart_md, ref_learn_md, ref_official_ui_md, ref_reference_md, ref_ui_reference_md [EXTRACTED 1.00]
- **Form Validation Stack (shadcn Form + React Hook Form + Zod)** — ref_forms_validation_md, concept_react_hook_form, concept_zod_validation [EXTRACTED 1.00]
- **Vercel Deployment Best Practices Stack** — claude_md_vercel_best_practices, concept_vercel_functions, concept_vercel_blob, concept_vercel_ai_gateway [EXTRACTED 1.00]

## Communities (50 total, 8 thin omitted)

### Community 0 - "Auth & Admin Shell"
Cohesion: 0.06
Nodes (50): AdminShell(), ALLOWED_ROLES, AuthGuard(), LoginForm(), Tab, CompetitionsContent(), AuthContext, AuthContextType (+42 more)

### Community 1 - "Betting & Bonus Logic"
Cohesion: 0.06
Nodes (51): placeBetAction(), setActualScoreAction(), createBonusQuestion(), DbBonusPick, DbBonusQuestion, deleteBonusQuestion(), getBonusQuestions(), getMyBonusPicks() (+43 more)

### Community 2 - "Tournament & Joker Context"
Cohesion: 0.06
Nodes (43): toggleJokerPick(), CreateTournamentInput, TournamentContext, TournamentContextType, UpdateTournamentInput, CountdownResult, useCountdown(), GROUP_STAGE_PREFIXES (+35 more)

### Community 3 - "Match Sync & Fixtures API"
Cohesion: 0.07
Nodes (39): refreshMatchResult(), setMatchScore(), syncFixtures(), syncOdds(), gateway, POST(), dbMatchToMatch(), GET() (+31 more)

### Community 4 - "Admin UI Components"
Cohesion: 0.10
Nodes (25): AdminOverviewPage(), CompetitionCard(), Props, statusBorders, statusColors, statusLabels, useTournament(), AdminTournamentDetailPage() (+17 more)

### Community 5 - "Dev Guidelines & Design System"
Cohesion: 0.09
Nodes (31): Next.js Agent Rules, Vercel Best Practices, cn() Utility (clsx + tailwind-merge), Copy-Paste Component Philosophy, CSS Variables Theming, Class Variance Authority (CVA), Dark Mode with next-themes, Frontend Design Principles (Anti-Generic) (+23 more)

### Community 6 - "Package Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, ai, @ai-sdk/openai, @base-ui/react, class-variance-authority, clsx, framer-motion, lucide-react (+17 more)

### Community 7 - "Tournament Bracket"
Cohesion: 0.10
Nodes (18): BracketSlot, BracketTree(), buildBracketMatrix(), colX(), computeCenters(), FIN_ST, FormBadge(), KnockoutBracket() (+10 more)

### Community 8 - "External Football API"
Cohesion: 0.12
Nodes (18): apiFetch(), ApiLeagueResponse, ApiSeason, fetchAllLeagues(), fetchLeaguesFromApi(), LeagueItem, GET(), AdminTournamentsPage() (+10 more)

### Community 9 - "shadcn/ui Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 11 - "Password Change Tests"
Cohesion: 0.10
Nodes (16): { currentPw, newPw, confirmPw }, input, inputs, mockBack, mockEq, mockFrom, mockGetPublicUrl, mockRefreshUser (+8 more)

### Community 12 - "Match Card Tests"
Cohesion: 0.11
Nodes (16): bet, chip, DEFAULT_PROPS, futureTime, [homeInput], [homeInput, awayInput], inputs, minute (+8 more)

### Community 13 - "Hash / Caching Util"
Cohesion: 0.13
Nodes (14): computedHash, source, sourceType, computedHash, source, sourceType, skills, frontend-design (+6 more)

### Community 14 - "Dev Dependencies"
Cohesion: 0.13
Nodes (15): devDependencies, eslint, eslint-config-next, jsdom, tailwindcss, @tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react (+7 more)

### Community 15 - "PWA Manifest"
Cohesion: 0.13
Nodes (14): background_color, categories, description, dir, display, icons, lang, name (+6 more)

### Community 16 - "Login Form Tests"
Cohesion: 0.18
Nodes (9): [emailInput], getTab(), img, mockLogin, mockPush, mockRegister, mockUseAuth, switchToRegister() (+1 more)

### Community 17 - "Brand Logo SVG"
Cohesion: 0.24
Nodes (10): & WIN Text Label, Blue Radial Gradient, Gold Crown, Football / Soccer Ball, Gold Linear Gradient (Crown), GUESS Text Label, Guess & Win Brand Logo, Logo SVG (+2 more)

### Community 18 - "App Root Layout"
Cohesion: 0.24
Nodes (6): metadata, viewport, AppProviders(), AuthProvider(), TournamentProvider(), OfflineBanner()

### Community 19 - "PWA Icons"
Cohesion: 0.29
Nodes (8): Gold Crown Icon, Dark Navy Background, Football / Soccer Ball, Guess & Win App, PWA Icon 512x512, Orbit / Dashed Ring Element, Progressive Web App Icon, Rounded Rectangle Shape

### Community 20 - "Brand Identity"
Cohesion: 0.52
Nodes (7): Guess & Win Brand, Circular Orbit / Network Ring, Crown Icon, Football Prediction Game, Guess & Win Logo, Soccer Ball Icon, Blue and Gold Visual Style

### Community 21 - "NPM Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, test:watch

### Community 22 - "FIFA World Cup 2026"
Cohesion: 0.53
Nodes (6): FIFA, FIFA World Cup 2026, FIFA World Cup 2026 Official Logo, Promotional Image, FIFA World Cup Trophy, Year 2026

### Community 23 - "Apple Touch Icon"
Cohesion: 0.47
Nodes (6): Apple Touch Icon, Crown / Trophy Icon, Dark Navy Background, Football / Soccer Ball, Guess & Win App, iOS Home Screen Icon

### Community 24 - "bet365 Integration"
Cohesion: 0.47
Nodes (6): bet365 Brand, bet365 Logo, bet365 Sportsbook / Online Betting Platform, bet365 Visual Style (Green and Yellow on White), Guess-Win Project, Online Sports Betting Industry

### Community 25 - "bet365 Brand Assets"
Cohesion: 0.40
Nodes (6): Bet365 Brand, Bet365 Logo, Green Text Color, Online Sports Betting, Partner / Integration Reference, Yellow Text Color

### Community 26 - "Favicon"
Cohesion: 0.40
Nodes (6): Browser Favicon, Crown Icon, Dark Navy Background, Favicon 32x32, Football / Soccer Ball, Guess & Win App

### Community 27 - "Default UI Icons"
Cohesion: 0.33
Nodes (6): Globe SVG Icon, Gray (#666) Color Scheme, Internationalization / Web Symbol, Next.js Default Asset, UI Utility Icon, World Globe Icon

### Community 28 - "PWA Icon 192"
Cohesion: 0.40
Nodes (6): Crown Icon, Dark Navy Background, Football / Soccer Ball, Guess & Win App, PWA Icon 192x192, Progressive Web App Icon

### Community 29 - "App Instrumentation"
Cohesion: 0.47
Nodes (3): startSyncCron(), register(), validateSecrets()

### Community 30 - "Logo Tests"
Cohesion: 0.33
Nodes (5): loginFormPath, pagePath, source, svg, svgPath

### Community 31 - "Window SVG Icon"
Cohesion: 0.40
Nodes (6): Browser Window Icon, Gray (#666) Color Scheme, Next.js Default Asset, Window Traffic Light Dots, UI Utility Icon, Window SVG Icon

### Community 32 - "File SVG Icon"
Cohesion: 0.50
Nodes (5): Document / File Icon, File SVG Icon, Gray (#666) Color Scheme, Next.js Default Asset, UI Utility Icon

### Community 33 - "MCP Config"
Cohesion: 0.40
Nodes (4): mcpServers, ruflo, args, command

### Community 34 - "Next.js Assets"
Cohesion: 0.50
Nodes (5): Black Wordmark, Next.js Default Asset, Next.js Logo SVG, Next.js Brand, React Framework

### Community 35 - "Vercel Assets"
Cohesion: 0.40
Nodes (5): Deployment Platform, Next.js Default Asset, Vercel Brand, Vercel Logo SVG, White Triangle / Chevron

### Community 36 - "Package Identity"
Cohesion: 0.50
Nodes (3): name, private, version

## Knowledge Gaps
- **273 isolated node(s):** `command`, `args`, `$schema`, `style`, `rsc` (+268 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Auth & Admin Shell` to `Betting & Bonus Logic`, `Tournament & Joker Context`, `Match Sync & Fixtures API`, `Admin UI Components`, `Tournament Bracket`, `External Football API`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `useTournament()` connect `Admin UI Components` to `External Football API`, `Betting & Bonus Logic`, `Tournament & Joker Context`, `Auth & Admin Shell`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `supabaseAdmin` connect `Match Sync & Fixtures API` to `External Football API`, `Betting & Bonus Logic`, `Tournament & Joker Context`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `command`, `args`, `$schema` to the rest of the system?**
  _276 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & Admin Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.05802469135802469 - nodes in this community are weakly interconnected._
- **Should `Betting & Bonus Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.05924978687127025 - nodes in this community are weakly interconnected._
- **Should `Tournament & Joker Context` be split into smaller, more focused modules?**
  _Cohesion score 0.061457418788410885 - nodes in this community are weakly interconnected._