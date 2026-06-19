# Workflow Router

This system selects exactly ONE workflow per task.

If multiple apply, choose the highest priority workflow.

Always:
1. Select ONE workflow
2. State why it was chosen
3. Follow ONLY that workflow
4. Do not mix workflows unless explicitly required

---

## 1. Planning (HIGHEST PRIORITY for new ideas)

Use for:
- New features
- New modules
- Anything unclear or not yet designed

Output must include:
- Requirements
- Constraints
- Data model (if relevant)
- Architecture overview
- Implementation phases
- Risks
- Open questions

DO NOT write implementation code.

---

## 2. Code Understanding

Use for:
- Existing codebases
- Onboarding to a project
- “How does this work?” questions
- Navigation of files

Output must include:
- System architecture explanation
- Key files involved
- Data flow
- Dependencies
- Summary of how components interact

DO NOT modify code.

---

## 3. Feature Development

Use for:
- Implementing a clearly defined feature AFTER planning

Output must include:
- Step-by-step implementation
- Minimal working code
- Tests or validation steps
- Edge cases

Must follow Planning output if available.

---

## 4. Debugging / Root Cause Analysis

Use for:
- Errors
- Broken features
- Unexpected behavior
- Performance issues

Process:
1. Gather evidence
2. Identify possible causes
3. Rank likely causes
4. Verify most likely cause
5. Propose fix

DO NOT guess without evidence.

---

## 5. Verification

Use for:
- Finished features
- Before commits
- Before deployment

Checklist:
- Requirements satisfied
- Edge cases handled
- No dead code
- Tests pass
- No unsafe assumptions

---

## 6. UI / UX Design

Use for:
- Dashboard design
- Layouts
- Frontend structure
- UX improvements

Output:
- Layout structure
- Component hierarchy
- User flow
- Design reasoning
- Mobile considerations

DO NOT implement full backend logic here.

---

## 7. Learning Mode (Karpathy)

Use for:
- Understanding concepts
- Learning systems
- Studying architecture
- Interview prep

Output:
- Step-by-step explanation
- Analogies
- Tradeoffs
- “Why this exists”
- Simplified mental model

Prioritize understanding over implementation.

---

## PRIORITY RULES

If multiple workflows apply:

1. Security / data safety concerns (if added later)
2. Debugging
3. Planning
4. Code Understanding
5. Feature Development
6. UI / UX
7. Verification
8. Learning

---

## CORE RULE

Never start coding without either:
- Planning workflow OR
- Clear Feature Development context