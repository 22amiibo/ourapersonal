# Framework Reference

## Framework Selection Rules

Choose ONE primary framework.

Priority Order:

1. Security Issues
   → Security Reviewer

2. Database Design or Performance
   → Database Reviewer

3. UI/UX Work
   → Open Design

4. Learning and Understanding
   → Karpathy Mode

5. New Feature Development
   → ECC TDD Workflow

6. Existing Code Understanding
   → ECC Search-First

7. Debugging
   → Root Cause Analysis

8. Project Planning
   → Ruflo

9. Architecture Review
   → Superpowers Architecture Review

10. Code Review
    → Superpowers Review

11. Final Validation
    → ECC Verification Loop

Only combine frameworks when necessary.

Always explain why a framework was selected.

Default to the simplest workflow that solves the problem.

---

# ECC

ECC is for disciplined software engineering.

Use ECC whenever code quality, testing, verification, or understanding an existing codebase is the primary goal.

---

## Search-First Skill

Purpose:
Understand before changing.

Use When:

* Joining a new codebase
* Returning after a break
* Investigating bugs
* Claude starts coding too quickly
* Refactoring existing systems

Workflow:

1. Read relevant files
2. Explain current architecture
3. Identify change locations
4. Identify risks
5. Wait for approval before editing

Output:

* Architecture summary
* Relevant files
* Risks
* Proposed approach

Avoid:

* Immediate code generation

---

## TDD Workflow

Purpose:
Build new functionality safely.

Use When:

* New features
* New API endpoints
* New database functionality
* Major business logic changes

Workflow:

1. Define requirements
2. Create tests first
3. Explain why tests fail initially
4. Implement minimum code necessary
5. Verify functionality
6. Refactor only after tests pass

Output:

* Requirements
* Tests
* Implementation
* Verification

Avoid:

* Large untested changes

---

## Verification Loop

Purpose:
Validate completed work.

Use When:

* Claude says work is complete
* Before commits
* Before deployment
* Before merging changes

Verification Checklist:

* Requirements satisfied
* Edge cases handled
* Tests pass
* No unused code
* No assumptions
* No regressions
* Error handling present

Output:

* Findings
* Remaining issues
* Confidence assessment

---

# Root Cause Analysis

Purpose:
Debug correctly.

Use When:

* Errors appear
* Build fails
* Data looks incorrect
* Performance degrades

Workflow:

1. Gather evidence
2. Identify possible causes
3. Rank causes by likelihood
4. Verify most likely cause
5. Explain findings
6. Propose fix

Avoid:

* Guessing
* Immediate fixes without evidence

Output:

* Evidence
* Root cause
* Proposed fix

---

# Security Reviewer

Purpose:
Identify security risks.

Use When:

* Deploying publicly
* Adding authentication
* Connecting health data
* Handling secrets
* Creating APIs

Review Areas:

* Authentication
* Authorization
* API endpoints
* Secrets handling
* Environment variables
* Database access
* User input validation
* Rate limiting
* Data exposure

Output:

Severity-ranked report:

* Critical
* High
* Medium
* Low

---

# Database Reviewer

Purpose:
Review database quality.

Use When:

* Designing schemas
* Creating tables
* Performance issues
* Query optimization

Review Areas:

* Schema design
* Indexes
* Query efficiency
* Data consistency
* Constraints
* Scalability
* Future growth

Output:

* Strengths
* Weaknesses
* Recommendations

---

# Karpathy Mode

Purpose:
Learn while building.

Use When:

* Learning programming
* Understanding architecture
* Interview preparation
* Exploring tradeoffs

---

## Explain Code

Explain:

* Why it exists
* How it works
* Common mistakes
* Alternative approaches
* Best practices

Assume the user wants deep understanding.

---

## Learn System Design

Explain using:

* Analogies
* Text diagrams
* Step-by-step reasoning
* Tradeoffs
* Real-world examples

Assume the user is learning.

---

## Learn While Building

While implementing:

1. Explain decisions
2. Explain tradeoffs
3. Explain alternatives
4. Explain industry practices
5. Explain future scaling concerns

Prioritize understanding over speed.

---

# Open Design

Purpose:
Design better user experiences.

Use When:

* Dashboard design
* Frontend design
* Mobile interfaces
* UX reviews
* Design systems

---

## Dashboard Design

Create:

* Layout
* Information hierarchy
* Components
* User flows
* Mobile considerations

Focus on clarity.

---

## UX Review

Evaluate:

* Accessibility
* Visual hierarchy
* UX friction
* Consistency
* User effort
* Navigation

Provide recommendations.

---

## Design System

Create:

* Typography
* Spacing
* Components
* Interaction patterns
* Layout standards

Ensure consistency.

---

# Ruflo

Purpose:
Plan products from idea to execution.

Use When:

* New projects
* Large features
* Roadmaps
* Product planning

---

## New Product Feature

Create:

1. Requirements
2. Architecture
3. Tasks
4. Implementation plan
5. Verification plan

Wait for approval before implementation.

---

## Large Project Planning

Break work into:

* Milestones
* Deliverables
* Dependencies
* Risks

Create roadmap.

---

## Product Manager Mode

Define:

* User stories
* Technical requirements
* MVP scope
* Future improvements

Focus on execution.

---

# Superpowers

Purpose:
Architecture and engineering review.

Use When:

* Planning large changes
* Refactoring
* Reviewing code
* Understanding systems

---

## Architecture Review

Analyze:

* Architecture
* Data flow
* Dependencies
* Risks
* Scaling concerns

Provide recommendations.

---

## Refactor Planning

Create plan that:

* Reduces complexity
* Removes duplication
* Preserves behavior
* Minimizes risk

Wait for approval.

---

## Senior Engineer Onboarding

Explain:

* Architecture
* Data flow
* Important files
* Patterns
* Risks

Assume a new developer is joining.

---

## Senior Code Review

Evaluate:

* Maintainability
* Readability
* Performance
* Security
* Scalability

Provide actionable recommendations.

---

# Obsidian CLI

Purpose:
Knowledge management and note analysis.

Use When:

* Daily notes
* Journaling
* Research
* Knowledge graph analysis

---

## Daily Notes

Analyze:

* Productivity
* Confidence
* Energy
* Study habits

Look for patterns.

---

## Vault Search

Find:

* Related notes
* Themes
* Repeated topics
* Missing connections

---

## Pattern Analysis

Review historical notes.

Identify:

* Trends
* Correlations
* Recurring issues
* Opportunities

Generate insights.

---

# Dashboard Project Defaults

For this project:

Planning
→ Ruflo

Code Understanding
→ ECC Search-First

Feature Development
→ ECC TDD

Debugging
→ Root Cause Analysis

Verification
→ ECC Verification Loop

UI/UX
→ Open Design

Learning
→ Karpathy Mode

Database
→ Database Reviewer

Security
→ Security Reviewer

Code Review
→ Superpowers Review

Notes and Journaling
→ Obsidian CLI

Always choose the simplest workflow that solves the task.

Prefer understanding before coding.

Prefer verification before completion.
