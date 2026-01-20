# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AI Writing Assistant Demo (MVP)** - A Next.js application that uses OpenRouter API to generate writing content with different AI models (DeepSeek R1 and Kimi K2).

**Tech Stack**:
- Next.js 16.1.4 (App Router)
- React 19.2.3
- TypeScript 5
- TailwindCSS 4
- shadcn/ui (New York style)
- Lucide icons

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm build

# Start production server
npm start

# Run linter
npm run lint
```

## Project Architecture

### Directory Structure
```
src/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts          # OpenRouter API proxy endpoint
│   ├── page.tsx                   # Main single-page application
│   ├── layout.tsx                 # Root layout with metadata
│   └── globals.css                # Global styles + CSS variables
├── components/
│   ├── ui/                        # shadcn/ui components
│   └── [feature-components].tsx  # Custom components
└── lib/
    ├── utils.ts                   # cn() utility from shadcn
    └── [additional-utilities].ts
```

### Path Aliases
- `@/*` maps to `./src/*`
- Configured in both `tsconfig.json` and `components.json`

### shadcn/ui Configuration
- **Style**: New York
- **Base Color**: Neutral
- **CSS Variables**: Enabled (in `src/app/globals.css`)
- **Icon Library**: Lucide React
- **RSC**: Enabled (React Server Components)

Add components with:
```bash
npx shadcn@latest add [component-name]
```

## Core Product Requirements (from prd.md)

### Single-Page Application Structure

**Desktop**: Two-column layout (input form left/top, output panel right/bottom)
**Mobile**: Vertical layout (input above, output below)

### Required Form Fields

**Mandatory**:
1. Model selection (Select): `deepseek/deepseek-r1-0528:free` | `moonshotai/kimi-k2:free`
2. Topic keyword (Input): 2-50 chars
3. Topic description (Textarea): 10-1000 chars

**Advanced Settings** (Accordion):
1. Language (Select): 中文 (default) | English | 日本語
2. Tone (Select): 正式 (default) | 轻松 | 专业 | 说服型
3. Role (Input/Select): 资深写作助手 (default) | custom roles

**Actions**:
- Generate (Primary button)
- Reset (Secondary button)

### Output Panel Requirements
- Display generated content (plain text or Markdown)
- Copy button
- States: Loading | Error | Empty | Success

### User Preferences Persistence
Use `localStorage` to remember:
- Last selected model
- Language preference
- Tone preference
- Role preference

## API Implementation

### Route Handler: `POST /api/generate`

**Request Body**:
```typescript
{
  model: string;           // Selected OpenRouter model
  keyword: string;         // Topic keyword
  description: string;     // Topic description
  language: string;        // Output language
  tone: string;            // Writing tone
  role: string;            // AI role/persona
}
```

**Response**:
```typescript
{
  success: boolean;
  data?: {
    text: string;          // Generated content
    usage?: {              // Token usage (optional)
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  };
  error?: string;
}
```

### Prompt Template Structure

**System Prompt**:
```
你是{role}，用{language}输出，整体语气为{tone}。
输出要求：结构清晰、可直接复制使用。
若信息不足，可合理补全，但不要编造具体事实来源。

请按以下格式输出：
1. 标题候选（3个）
2. 内容大纲（分点列出）
3. 正文（600-1000字）
4. 结尾总结或行动建议
```

**User Prompt**:
```
主题关键词：{keyword}
主题描述：{description}

请基于以上信息生成完整的写作内容。
```

### OpenRouter API Configuration
```typescript
{
  model: string,            // User-selected model
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  temperature: 0.7,         // Fixed for MVP
  max_tokens: 2000          // Fixed for MVP
}
```

**Environment Variable Required**:
```bash
OPENROUTER_API_KEY=your_key_here
```

Store in `.env.local` (already in `.gitignore`).

## Error Handling

Map HTTP status codes to user-friendly messages:
- `400`: Invalid request parameters
- `401/403`: API key invalid or insufficient permissions
- `429`: Rate limited, retry later
- `500/503`: Service temporarily unavailable
- `TIMEOUT`: Request timeout, please retry

Display errors in the output panel, log details server-side only.

## Form Validation

Client-side validation rules:
- Model: required
- Keyword: required, 2-50 characters
- Description: required, 10-1000 characters
- Advanced settings: optional (use defaults if empty)

Disable submit button during loading to prevent duplicate requests.

## MVP Exclusions

Do NOT implement:
- User authentication/accounts
- History/saved documents
- Streaming responses (SSE)
- Multi-turn conversations
- File uploads
- Template marketplace
- Export to PDF/Word

## Responsive Design

Use Tailwind breakpoints:
- Mobile-first approach
- `md:` for desktop two-column layout
- Ensure form and output are scrollable on small screens

## Security Requirements

- ✅ API key must ONLY exist in server-side environment variables
- ✅ Never expose API key in client bundle or network requests
- ✅ Use Next.js Route Handler as proxy for OpenRouter calls
- ✅ Sanitize user input before passing to API
- ✅ Validate content length to prevent token abuse

## Acceptance Criteria

1. Page renders correctly in development mode
2. Both models can be selected and produce different outputs
3. Advanced settings affect the generated content
4. Loading state shows during API calls
5. Errors display user-friendly messages
6. Copy button works correctly
7. API key never appears in browser DevTools
8. Form preferences persist across page refreshes
9. Responsive layout works on mobile and desktop

## Implementation Milestones (from prd.md)

**Day 1**: Page structure + form UI + output panel (static)
**Day 2**: API Route + OpenRouter integration
**Day 3**: State management + error handling + copy function + localStorage
**Day 4**: Responsive polish + final testing

## Related Documentation

- See `prd.md` for complete product requirements
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [shadcn/ui Components](https://ui.shadcn.com)
- [OpenRouter API Docs](https://openrouter.ai/docs)
