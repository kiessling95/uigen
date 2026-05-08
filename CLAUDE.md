# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server with Turbopack (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Vitest (all tests)
npm run setup      # Install deps + generate Prisma client + run migrations
npm run db:reset   # Reset SQLite database (destructive)
```

Run a single test file:
```bash
npx vitest src/path/to/file.test.ts
```

Environment: copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without it, the app falls back to a mock provider with pre-canned component examples. Set `JWT_SECRET` in production (defaults to a hardcoded dev key).

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat interface; Claude AI generates and edits them in real-time via a virtual file system, with live preview rendered in an iframe.

### Request flow

1. User sends a message in the chat panel (`ChatContext` → Vercel AI SDK `useChat`)
2. `ChatContext.handleSubmit` serializes the current VirtualFileSystem and sends it alongside messages to `/api/chat` in the request body (not the system prompt)
3. The route reconstructs a server-side `VirtualFileSystem` from the serialized data, then streams a response from Claude using Anthropic's tool-use pattern
4. Claude calls two tools — `str_replace_editor` (create/edit file contents) and `file_manager` (rename/delete) — executed server-side against the ephemeral VirtualFS
5. As the stream completes, `ChatContext` scans new assistant messages for tool parts with `state === "output-available"` and replays each tool call against the client-side `FileSystemContext` — this is the mechanism that updates the code editor and live preview
6. On stream completion, `onFinish` persists the serialized messages + file system to the project's SQLite row (only if `projectId` is present and the user is authenticated)

### Key layers

| Layer | Location | Notes |
|---|---|---|
| Pages / routing | `src/app/` | App Router; `[projectId]` is the main workspace |
| AI endpoint | `src/app/api/chat/route.ts` | Streaming, tool execution, prompt caching |
| AI tools | `src/lib/tools/str-replace.ts`, `src/lib/tools/file-manager.ts` | Tool schemas + server-side execution logic |
| System prompt | `src/lib/prompts/generation.tsx` | Static prompt (FS state is NOT injected; AI learns file state from conversation history and tool results) |
| AI provider | `src/lib/provider.ts` | Returns Anthropic model or `MockLanguageModel` fallback |
| Virtual file system | `src/lib/file-system.ts` | In-memory tree; serialize/deserialize for DB + API transport |
| State | `src/app/main-content.tsx` | Mounts `FileSystemProvider` and `ChatProvider` providers |
| Preview | `src/components/preview/PreviewFrame.tsx` | Babel transpiles JSX → blob URL → iframe with import maps |
| Auth | `src/lib/auth.ts`, `src/middleware.ts` | JWT (JOSE) in httpOnly cookie, 7-day sessions; middleware protects routes |
| DB | `src/actions/`, `prisma/` | Prisma 6 + SQLite; server actions for auth and project CRUD |
| Anonymous work | `src/lib/anon-work-tracker.ts` | Persists chat + FS to `localStorage`; migrates to DB on sign-in |

### Virtual file system

`file-system.ts` is a pure in-memory tree with no disk I/O. The server reconstructs a fresh instance on every request from the serialized payload; the client holds a persistent instance in `FileSystemContext`. The two Claude tools (`str_replace_editor` / `file_manager`) mutate the server-side instance; `handleToolCall` in `FileSystemContext` then replays the same mutations client-side. The `undo_edit` command of `str_replace_editor` is intentionally unimplemented — the tool returns an error telling the model to use `str_replace` instead.

### Preview rendering

`createImportMap` in `jsx-transformer.ts` does two passes over the virtual FS:
1. Transforms all `.js/.jsx/.ts/.tsx` files with Babel and creates blob URLs; collects imports
2. For missing local imports, generates empty placeholder stub modules to avoid broken previews; for missing third-party packages, maps them to `https://esm.sh/<package>`

The generated HTML injects Tailwind CSS from CDN and mounts the app at `#root`. Entry point resolution order: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → `/src/App.jsx` → `/src/App.tsx` → first `.jsx`/`.tsx` found.

### AI-generated code conventions

The system prompt enforces these rules (relevant when editing `src/lib/prompts/generation.tsx` or the tools):
- Every project must have a root `/App.jsx` as its entry point with a default export
- All local imports must use the `@/` alias (e.g. `import Foo from '@/components/Foo'`)
- Style with Tailwind CSS only — no hardcoded styles
- No HTML files; `/App.jsx` is the sole entry point

### Mock provider

When `ANTHROPIC_API_KEY` is absent, `getLanguageModel()` returns `MockLanguageModel`, which replies with pre-canned components (Counter, ContactForm, Card) and uses `maxSteps: 4` instead of `40`. This lets the UI run without credentials.

## Tech stack highlights

- **Next.js 15** App Router + **React 19**
- **Tailwind CSS v4** (PostCSS plugin — config is in `postcss.config.mjs`, not `tailwind.config.*`)
- **Vercel AI SDK** (`ai` v6, `@ai-sdk/react` v3) for streaming chat
- **Monaco Editor** for in-browser code editing
- **Prisma 6** + **SQLite** — schema in `prisma/schema.prisma`; generated client output in `src/generated/prisma/`
- Path alias `@/*` → `src/*` (configured in `tsconfig.json` and `vitest.config.mts`)
