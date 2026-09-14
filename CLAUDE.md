@AGENTS.md

# Vianda — Project Rules

## Package Manager
**Always use `pnpm`. Never use `npm` or `yarn` — prohibited.**
- Install: `pnpm install` / `pnpm add <pkg>`
- Run scripts: `pnpm <script>` (e.g. `pnpm dev`, `pnpm build`)
- Execute binaries: `pnpm exec <bin>` or `pnpm dlx <pkg>`
- Never run `npm install`, `npm run`, `npx`, `yarn`, etc.
