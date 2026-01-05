# Quick Reference Card - Enterprise Agents

## 🎯 One-Liner Guide

| Need                 | Agent                   | Command                           |
| -------------------- | ----------------------- | --------------------------------- |
| **Security audit**   | @security-auditor       | Find OWASP vulnerabilities        |
| **Compliance check** | @compliance-engineer    | Verify SOC2/GDPR/HIPAA            |
| **System design**    | @principal-architect    | Design microservices architecture |
| **Code review**      | @code-quality-enforcer  | Find code smells, apply patterns  |
| **CI/CD setup**      | @devops-sre             | Create pipelines, infrastructure  |
| **Write tests**      | @test-automation-expert | Achieve 80%+ test coverage        |
| **Fix slow API**     | @performance-optimizer  | Optimize queries, add caching     |
| **Database design**  | @database-architect     | Design schemas, optimize queries  |
| **API design**       | @api-architect          | Create REST/GraphQL APIs          |
| **Write docs**       | @technical-writer       | API docs, README, runbooks        |

## 📋 Common Commands

### Security & Compliance

```bash
# Full security audit
@security-auditor audit the entire codebase for OWASP Top 10

# Check compliance
@compliance-engineer verify GDPR compliance for user data handling

# Mobile security
@security-auditor review React Native app for OWASP MASVS
```

### Architecture & Design

```bash
# Architecture review
@principal-architect review system design and create C4 diagrams

# Refactor monolith
@principal-architect design microservices migration strategy

# Code quality
@code-quality-enforcer find code smells and suggest design patterns
```

### DevOps & Testing

```bash
# CI/CD pipeline
@devops-sre create GitHub Actions pipeline with Docker and K8s

# Test strategy
@test-automation-expert design testing pyramid for the project

# Load testing
@test-automation-expert create k6 load tests for 10K requests/second
```

### Performance & Database

```bash
# Fix slow endpoint
@performance-optimizer analyze /api/offers endpoint (p95: 2s)

# Database optimization
@database-architect optimize queries and add missing indexes

# Caching strategy
@performance-optimizer recommend Redis caching for user profiles
```

### API & Documentation

```bash
# API design
@api-architect design RESTful API following best practices

# OpenAPI spec
@api-architect create OpenAPI 3.0 specification

# Documentation
@technical-writer create comprehensive API documentation
```

## 🔥 Power User Tips

### Multi-Agent Workflows

**Pre-Production Checklist**:

```bash
1. @security-auditor - Security review
2. @test-automation-expert - Test coverage check
3. @performance-optimizer - Load testing
4. @compliance-engineer - Compliance verification
5. @technical-writer - Documentation review
```

**New Feature Development**:

```bash
1. @principal-architect - Architecture design
2. @database-architect - Schema design
3. @api-architect - API contract
4. @test-automation-expert - TDD tests
5. @code-quality-enforcer - Code review
```

**Incident Response**:

```bash
1. @devops-sre - Incident investigation
2. @performance-optimizer - Performance profiling
3. @database-architect - Query optimization
4. @technical-writer - Post-mortem document
```

### Agent Model Selection

| Model      | When to Use                             | Speed  | Quality |
| ---------- | --------------------------------------- | ------ | ------- |
| **Opus**   | Complex architecture, critical security | Slow   | Highest |
| **Sonnet** | Most tasks, good balance                | Medium | High    |
| **Haiku**  | Quick checks, simple tasks              | Fast   | Good    |

**Current Configuration**:

- security-auditor: **Opus** (critical security decisions)
- principal-architect: **Opus** (complex system design)
- All others: **Sonnet** (balanced performance/quality)

### Targeting Specific Files

```bash
# Single file
@security-auditor audit apps/food-waste-backend/src/auth/auth.service.ts

# Multiple files
@code-quality-enforcer review:
- apps/food-waste-backend/src/users/users.service.ts
- apps/food-waste-backend/src/auth/auth.service.ts

# File pattern
@test-automation-expert check test coverage for apps/mobile/src/**/*.test.tsx
```

### Setting Context

```bash
# Provide constraints
@principal-architect design payment system
Requirements:
- Handle 1000 transactions/second
- PCI-DSS compliant
- 99.99% uptime SLA
- Budget: $5K/month AWS

# Provide background
@performance-optimizer optimize /api/search
Current: p95 = 3 seconds
Target: p95 < 500ms
Stack: PostgreSQL, Redis, Node.js
Data: 10M products, 1M users
```

## 🎓 Learning Path

### Beginner

1. Start with **@technical-writer** - Improve documentation
2. Use **@code-quality-enforcer** - Learn clean code
3. Try **@test-automation-expert** - Improve test coverage

### Intermediate

4. Use **@api-architect** - Design better APIs
5. Try **@database-architect** - Optimize database
6. Use **@performance-optimizer** - Speed up app

### Advanced

7. Use **@principal-architect** - Design scalable systems
8. Try **@devops-sre** - Build production infrastructure
9. Use **@security-auditor** - Enterprise security
10. Try **@compliance-engineer** - Regulatory compliance

## 📊 Metrics & KPIs

### Security & Compliance

- ✅ Zero P0/P1 vulnerabilities
- ✅ SOC2 Type II certified
- ✅ 100% compliance with GDPR

### Code Quality

- ✅ Test coverage > 80%
- ✅ Cyclomatic complexity < 10
- ✅ Code duplication < 3%

### Performance

- ✅ p50 latency < 100ms
- ✅ p95 latency < 500ms
- ✅ 99.9% uptime SLA

### Architecture

- ✅ All ADRs documented
- ✅ C4 diagrams up-to-date
- ✅ Zero circular dependencies

## 🚨 Common Issues

### Agent Not Working?

1. **Check model**: Complex tasks need Opus
2. **Be specific**: "audit auth" → "audit auth.service.ts for OWASP A01-A03"
3. **Provide context**: Stack, constraints, requirements

### Conflicting Recommendations?

- Different agents may suggest different approaches
- Use **@principal-architect** to make final decision
- Consider trade-offs (security vs performance)

### Too Detailed Output?

- Ask agent to "summarize top 5 issues only"
- Request "executive summary" format
- Focus on specific files/components

## 💡 Pro Patterns

### The "Three-Pass Review"

```bash
# Pass 1: Quick wins
@code-quality-enforcer find top 10 quick wins

# Pass 2: Deep analysis
@principal-architect comprehensive architecture review

# Pass 3: Optimization
@performance-optimizer benchmark and optimize
```

### The "Red Team Review"

```bash
# Offensive security
@security-auditor penetration testing mindset

# Defensive security
@compliance-engineer verify security controls

# Infrastructure
@devops-sre review network policies and IAM
```

### The "Production Readiness"

```bash
@security-auditor       # Security ✅
@test-automation-expert # Tests ✅
@performance-optimizer  # Performance ✅
@devops-sre            # Infrastructure ✅
@technical-writer      # Documentation ✅
```

## 📞 Support Matrix

| Issue                        | Contact                | SLA       |
| ---------------------------- | ---------------------- | --------- |
| Security vulnerability (P0)  | @security-auditor      | Immediate |
| Production outage (P0)       | @devops-sre            | 15 min    |
| Performance degradation (P1) | @performance-optimizer | 1 hour    |
| Architecture decision        | @principal-architect   | 1 day     |
| Documentation                | @technical-writer      | 2 days    |

---

**Save this file for quick reference!**

Last Updated: 2025-10-26 Version: 1.0.0
