---
description: Security standards applied to all files in the monorepo
---

# Security Standards

1. **No hardcoded secrets** — API keys, tokens, passwords, connection strings must come from environment variables. Use `.env` locally (gitignored), CI secret stores for deployment.
2. **Mobile tokens**: React Native Keychain only. Web tokens: HttpOnly cookies only. Never localStorage, Redux, MMKV, or sessionStorage.
3. **Input validation**: `class-validator` DTOs on backend, `Yup`/`Zod` on mobile and web. Validate at system boundaries.
4. **XSS prevention**: backend `GlobalSanitizationMiddleware` sanitizes all inputs. Web uses Next.js built-in escaping. Mobile uses no `dangerouslySetInnerHTML`.
5. **Auth**: JWT with short access tokens (~15min), refresh token rotation, MFA support, session middleware.
6. **RBAC**: Role-based guards — consumer, merchant, admin, moderator. Enforce on both server (guards) and client (RoleGuard component).
7. **HTTPS**: required in production. Helmet CSP configured on backend, security headers on web (next.config.js).
8. **Dependencies**: pin exact versions, audit regularly. Never use floating `latest`.
9. **Never commit**: `.env`, `.env.*`, keystores, `credentials.json`, service account files, JWT secrets.
10. **CSP**: backend Helmet + web next.config.js both define Content-Security-Policy. Keep them in sync.
