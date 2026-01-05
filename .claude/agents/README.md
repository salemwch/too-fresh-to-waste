# Enterprise-Grade Claude Code Agents

This directory contains 10 powerful, production-ready agents designed for
enterprise software engineering at scale (FAANG/Fortune 100 level).

## 🚀 Quick Start

### Using Agents

**@-mention an agent** to invoke it:

```
@security-auditor please audit the authentication system
@performance-optimizer analyze the /api/offers endpoint
@database-architect review the users table schema
```

**Command line**:

```bash
claude --agents '{"security": {"description": "Security auditor", "prompt": "file://.claude/agents/security-auditor.md"}}'
```

## 📋 Available Agents

### 1. Security & Compliance

#### **@security-auditor** (Opus)

- **Specialty**: OWASP Top 10, zero-trust architecture, penetration testing
- **Use cases**:
  - Security code reviews
  - SAST/DAST analysis
  - Vulnerability assessments
  - Mobile security (OWASP MASVS)
  - Cloud security (AWS/Azure/GCP)
- **Output**: Prioritized findings (P0-P3) with fixes and CWE references

#### **@compliance-engineer** (Sonnet)

- **Specialty**: SOC2, GDPR, HIPAA, PCI-DSS, ISO 27001, CCPA
- **Use cases**:
  - Compliance gap analysis
  - Privacy impact assessments
  - Data inventory and classification
  - Audit preparation
  - Third-party risk management
- **Output**: Compliance checklist, gap analysis, remediation plan

### 2. Architecture & Code Quality

#### **@principal-architect** (Opus)

- **Specialty**: System design, microservices, DDD, Clean Architecture
- **Use cases**:
  - Architecture reviews (C4 diagrams)
  - Technology selection (with trade-off analysis)
  - Scalability design (10M+ users)
  - Architectural Decision Records (ADRs)
  - Refactoring strategies
- **Output**: Architecture diagrams, ADRs, implementation roadmap

#### **@code-quality-enforcer** (Sonnet)

- **Specialty**: Clean code, design patterns, refactoring, technical debt
- **Use cases**:
  - Code smell detection
  - Design pattern recommendations
  - Technical debt tracking
  - Cyclomatic complexity reduction
  - DRY/SOLID enforcement
- **Output**: Code quality report, refactoring suggestions, metrics

### 3. DevOps & Infrastructure

#### **@devops-sre** (Sonnet)

- **Specialty**: CI/CD, Kubernetes, Terraform, monitoring, incident response
- **Use cases**:
  - Infrastructure as Code (Terraform, Helm)
  - CI/CD pipeline design (GitHub Actions, GitLab CI)
  - Observability setup (Prometheus, Grafana, ELK)
  - Incident response and post-mortems
  - Cost optimization (FinOps)
- **Output**: Infrastructure audit, CI/CD configs, runbooks, cost analysis

### 4. Testing & QA

#### **@test-automation-expert** (Sonnet)

- **Specialty**: Unit/integration/E2E testing, TDD/BDD, test coverage
- **Use cases**:
  - Test strategy design (testing pyramid)
  - Test coverage optimization (>80%)
  - TDD/BDD implementation
  - Performance testing (k6, JMeter)
  - Contract testing (Pact)
- **Output**: Test coverage report, missing tests, test improvements

### 5. Performance & Scalability

#### **@performance-optimizer** (Sonnet)

- **Specialty**: Profiling, caching, database optimization, load testing
- **Use cases**:
  - Performance profiling (CPU, memory, I/O)
  - N+1 query detection
  - Caching strategies (Redis, CDN)
  - Database query optimization
  - Load testing and capacity planning
- **Output**: Performance audit, bottleneck analysis, optimization plan

### 6. Database & Data Engineering

#### **@database-architect** (Sonnet)

- **Specialty**: Schema design, migrations, indexing, SQL/NoSQL
- **Use cases**:
  - Database schema design (normalization, constraints)
  - Query optimization (EXPLAIN plans)
  - Index strategy (B-Tree, GIN, GiST)
  - Zero-downtime migrations
  - Sharding and partitioning
- **Output**: Schema review, migration scripts, query optimization

### 7. API Design

#### **@api-architect** (Sonnet)

- **Specialty**: REST, GraphQL, gRPC, API governance, OpenAPI
- **Use cases**:
  - RESTful API design (best practices)
  - GraphQL schema design
  - API versioning strategies
  - OpenAPI specification generation
  - API gateway configuration
- **Output**: API design review, OpenAPI spec, integration guide

### 8. Documentation

#### **@technical-writer** (Sonnet)

- **Specialty**: API docs, README, ADRs, runbooks, tutorials
- **Use cases**:
  - API reference documentation
  - README and onboarding guides
  - Architecture Decision Records (ADRs)
  - Incident runbooks
  - Code comment standards
- **Output**: Documentation audit, templates, improved docs

## 🎯 Common Workflows

### Security Review Before Production

```
1. @security-auditor audit the codebase for OWASP Top 10
2. @compliance-engineer verify GDPR compliance
3. @devops-sre review infrastructure security (IAM, network policies)
```

### Performance Optimization Sprint

```
1. @performance-optimizer profile the API and identify bottlenecks
2. @database-architect optimize slow queries and add indexes
3. @test-automation-expert add performance tests (load testing)
```

### New Feature Development

```
1. @principal-architect design the architecture (microservices, DDD)
2. @api-architect design the REST API (OpenAPI spec)
3. @test-automation-expert create TDD test plan
4. @code-quality-enforcer review implementation for clean code
5. @technical-writer create API documentation
```

### Production Incident Response

```
1. @devops-sre follow incident runbook and investigate
2. @performance-optimizer profile for performance regressions
3. @database-architect check for missing indexes or slow queries
4. @technical-writer create post-mortem document
```

## 🏆 Agent Capabilities Matrix

| Agent                  | Security | Performance | Scalability | Testing | Docs   |
| ---------------------- | -------- | ----------- | ----------- | ------- | ------ |
| security-auditor       | ✅✅✅   | -           | -           | -       | -      |
| compliance-engineer    | ✅✅✅   | -           | -           | -       | -      |
| principal-architect    | ✅       | ✅          | ✅✅✅      | -       | ✅     |
| code-quality-enforcer  | ✅       | ✅          | ✅          | -       | -      |
| devops-sre             | ✅✅     | ✅          | ✅✅✅      | -       | ✅     |
| test-automation-expert | -        | ✅          | -           | ✅✅✅  | -      |
| performance-optimizer  | -        | ✅✅✅      | ✅✅        | ✅      | -      |
| database-architect     | ✅       | ✅✅✅      | ✅✅        | -       | -      |
| api-architect          | ✅       | ✅          | ✅✅        | -       | ✅     |
| technical-writer       | -        | -           | -           | -       | ✅✅✅ |

## 🔧 Customization

### Changing Agent Models

Edit the `model:` field in each agent's markdown frontmatter:

```yaml
---
description: Your description
model: opus # Options: opus, sonnet, haiku
---
```

### Creating Custom Agents

1. Copy an existing agent as a template
2. Modify the role, mission, and checklist
3. Save to `.claude/agents/your-agent.md`
4. Invoke with `@your-agent`

## 📚 Best Practices

### When to Use Which Agent

**Before writing code**:

- @principal-architect (architecture design)
- @api-architect (API contracts)
- @database-architect (schema design)

**During development**:

- @test-automation-expert (TDD)
- @code-quality-enforcer (code reviews)

**Before deployment**:

- @security-auditor (security review)
- @compliance-engineer (compliance check)
- @test-automation-expert (test coverage)
- @performance-optimizer (load testing)
- @devops-sre (CI/CD, infrastructure)

**After deployment**:

- @devops-sre (monitoring, incidents)
- @technical-writer (documentation)

### Agent Combinations

**Production Readiness Review**:

```
@security-auditor + @test-automation-expert + @performance-optimizer
```

**Architecture Review**:

```
@principal-architect + @database-architect + @api-architect
```

**Compliance Audit**:

```
@compliance-engineer + @security-auditor + @technical-writer
```

## 🌟 Pro Tips

1. **Be Specific**: Instead of "review the code", say "audit authentication for
   OWASP A01-A03"
2. **Combine Agents**: Use multiple agents for comprehensive reviews
3. **Iterate**: Agents can review each other's recommendations
4. **Reference Files**: Mention specific files/lines for targeted analysis
5. **Set Context**: Provide business requirements, constraints, SLAs

## 📖 Examples

### Example 1: Security Audit

```
@security-auditor

Please audit the authentication system for:
1. OWASP Top 10 vulnerabilities
2. JWT token security
3. Session management
4. Password storage (bcrypt)

Focus on these files:
- apps/food-waste-backend/src/auth/auth.service.ts
- apps/food-waste-backend/src/auth/auth.controller.ts
```

### Example 2: Performance Optimization

```
@performance-optimizer

The /api/offers endpoint has p95 latency of 2 seconds.
Please:
1. Identify bottlenecks (N+1 queries, missing indexes)
2. Recommend caching strategy
3. Suggest database optimizations

Target: p95 < 500ms
```

### Example 3: Architecture Review

```
@principal-architect

We're migrating from monolith to microservices.
Please:
1. Design service boundaries (DDD bounded contexts)
2. Recommend communication patterns (sync vs async)
3. Create C4 diagrams
4. Write ADR for major decisions

Context: 100K daily active users, 1M database records
```

## 🆘 Support

If an agent isn't working as expected:

1. Check the agent's model (Opus for complex tasks, Sonnet for most tasks)
2. Be more specific in your request
3. Provide file paths and line numbers
4. Review the agent's markdown file for capabilities

## 📄 License

These agents are part of your project and follow your project's license.

---

**Built with ❤️ for enterprise-grade software engineering**
