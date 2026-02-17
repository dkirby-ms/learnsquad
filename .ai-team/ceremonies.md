# Ceremonies

> Team meetings that happen before or after work. Each squad configures their own.

## Code Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | PR opened or updated |
| **Facilitator** | alex |
| **Participants** | pr-author |
| **Time budget** | thorough |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review PR description and understand the change intent
2. Review code diff for quality, correctness, security
3. Check test coverage and quality
4. Verify architecture alignment and conventions
5. Provide feedback: APPROVE, REQUEST CHANGES, or COMMENT
6. If rejecting, specify revision approach (reassign or escalate)

---

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | multi-agent task involving 2+ agents modifying shared systems |
| **Facilitator** | lead |
| **Participants** | all-relevant |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review the task and requirements
2. Agree on interfaces and contracts between components
3. Identify risks and edge cases
4. Assign action items

---

## Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, or reviewer rejection |
| **Facilitator** | lead |
| **Participants** | all-involved |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. Root cause analysis
3. What should change?
4. Action items for next iteration
