---
name: s-skill-validate
description: >-
  Validate whether a skill's "what it is" and "how to do it" instructions let a fresh agent infer the correct design "why" without the skill over-explaining that why. Use when creating, revising, or auditing a Codex/Cursor skill; when the user provides or asks to compare against a real design mental model, rationale, "why" information system, or expected behavior theory; when testing whether SKILL.md is practice-focused rather than rationale-heavy; or when the user asks for subagent/forward-test validation, meaning diff, blind inference, or s-skill-validate.
---

# s-skill-validate

## Purpose

Validate a skill with a two-sided test:

1. A fresh agent can infer the intended design "why" from the skill's definitions and procedures.
2. The skill itself remains focused on "what it is" and "how to do it", rather than leaking the full "why" as theory.

Use this skill to test skill design integrity, not to review general writing quality.

## Required Inputs

Collect or identify:

- **Candidate skill**: the `SKILL.md` path or pasted skill content being validated.
- **True why**: the actual design mental model, rationale, or information system the skill should imply.
- **Validation target**: whether to only report findings, revise the skill, or revise and rerun validation.

If the true why is missing, do not claim full validation. Ask for it, or perform only a weaker "inferred-why consistency check".

## Source Separation Rule

Keep three artifacts separate:

- **Candidate skill**: what the blind agent may see.
- **True why**: the answer key, visible only to the validating agent.
- **Blind inference output**: what the fresh agent inferred from the candidate skill.

Never pass the true why, expected gaps, suspected fixes, or prior conclusions into the blind inference prompt. The experiment is invalid if the blind agent can reconstruct the answer from leaked context instead of from the skill.

## Workflow

### 1. Freeze The Candidate

Read the candidate `SKILL.md` completely. If validating an edited local file, record the path and whether you will modify it.

Check that the skill has:

- A clear `name` and `description`.
- Definitions for its key concepts.
- Concrete trigger conditions.
- Concrete actions, procedures, gates, or output requirements.
- Boundaries and failure handling where execution could otherwise drift.

Do not start by rewriting. First understand what the current text actually asks an agent to do.

### 2. Prepare The True-Why Answer Key

Turn the true why into compact evaluation claims. Use this structure:

- **Core problem**: what failure mode the skill exists to prevent.
- **Core mechanism**: how the skill prevents it.
- **Load-bearing distinctions**: definitions or boundaries that must not be confused.
- **Execution consequences**: what an agent should do differently in concrete tasks.
- **Non-goals / forbidden interpretations**: plausible but wrong readings the skill must avoid.

Mark each claim as:

- **Must**: missing or wrong means the skill does not transmit its design.
- **Should**: desirable but not fatal if expressed differently.
- **Optional**: useful color; not required for validation.

### 3. Run Blind Inference

When subagent tools are available and the user has requested or authorized experimental validation, spawn a fresh agent with no inherited conversation context. Pass only the candidate skill and a neutral prompt.

Use a prompt shaped like:

```text
Please read only the provided skill. Do not use outside context.

Task: infer the design "why" behind this skill from its "what" and "how" instructions.
Explain why the skill defines its key concepts this way, why its procedure is structured this way,
what failures it is trying to prevent, and what an agent should do differently because of it.

Do not evaluate whether the skill is good. Output a structured Chinese explanation.
```

If the validation is about a specific risk, include the risk category in neutral form, not the expected answer. For example: "Also explain why the skill treats post-hoc validation the way it does." Do not include the true why.

If subagent tools are unavailable or not authorized, do not fake an experimental pass. State that only a non-blind self-check was possible.

### 4. Diff Meaning, Not Wording

Compare the blind inference output against the true-why answer key by meaning.

For each `Must` and `Should` claim, classify:

- **Match**: the blind inference captures the claim's practical meaning.
- **Near match**: wording or abstraction differs, but execution would stay correct.
- **Missing**: the blind inference does not contain the claim.
- **Drift**: the blind inference points in a related but materially different direction.
- **Contradiction**: the blind inference says the opposite or would drive wrong execution.
- **Unsupported over-inference**: the blind inference invents rationale not supported by the skill.

Treat small vocabulary differences as harmless when the implied behavior is the same. Treat a missing distinction as serious when it would make an agent choose the wrong trigger, wrong granularity, wrong action level, or wrong validation standard.

Pass the meaning test only when:

- All `Must` claims are `Match` or strong `Near match`.
- No `Must` claim is `Missing`, `Drift`, or `Contradiction`.
- Unsupported over-inference does not create wrong execution.
- The inferred why would lead an agent to behave like the true why intends.

### 5. Audit Practice Focus

Independently inspect the candidate skill text. Decide whether it remains a practical skill rather than a rationale essay.

Pass this audit when:

- The frontmatter explains what the skill does and when to use it.
- The body primarily contains definitions, gates, steps, decision rules, payload requirements, output requirements, and failure handling.
- Rationale appears only where needed to prevent misexecution.
- The blind agent had to infer the broader why from operational structure, rather than copying long theory sections.

Fail or warn when:

- The skill contains long "why", "background", "philosophy", or "core idea" sections that are not necessary for execution.
- The true why is directly explained in enough detail that blind inference is not a real inference.
- The skill persuades the agent instead of telling it what to do.
- The operational rules are thin, but the rationale is rich.

Do not mechanically fail a skill for using words like "because" or "why". Judge whether those lines are operational guardrails or theory leakage.

### 6. Decide What To Change

If meaning diff fails because the blind agent missed or distorted the true why, repair the skill by strengthening "what" and "how":

- Add or sharpen definitions.
- Add trigger conditions.
- Add action levels or decision gates.
- Add payload or output requirements.
- Add boundary cases and forbidden interpretations.
- Add examples only when they teach execution, not when they merely explain motivation.

If practice focus fails, compress rationale into operational rules:

- Replace theory paragraphs with concrete checks.
- Move design history out of the skill.
- Convert "why this matters" into "when this condition appears, do this".

After material edits, rerun blind inference with a new fresh agent. Do not reuse the previous agent for the same validation round.

## Report Format

Use this report shape:

```markdown
**Setup**
- Candidate skill: <path or description>
- True why source: <user-provided / file / conversation excerpt>
- Blind experiment: <subagent id / not run and why>

**Blind Inference Summary**
<short summary of what the fresh agent inferred>

**Meaning Diff**
| Claim | Importance | Result | Notes |
| --- | --- | --- | --- |
| <true-why claim> | Must/Should | Match/Near match/Missing/Drift/Contradiction/Unsupported | <concise evidence> |

**Practice-Focus Audit**
- Verdict: Pass / Warn / Fail
- Evidence: <what in the skill is definition/procedure vs rationale leakage>

**Verdict**
Pass / Pass after edits / Fail

**Changes Made Or Recommended**
<file paths and concise change summary, or recommended edits>
```

Keep the report high-signal. Include raw blind inference only when the user asks or when a disputed diff needs evidence.

## Validation Integrity Checklist

Before finalizing, confirm:

- The blind agent did not receive the true why.
- The comparison used meaning, not phrase overlap.
- The practice-focus audit did not reward over-explaining.
- Any edits preserved the skill's triggerability and concrete execution guidance.
- Any rerun used a fresh agent or clearly stated why no blind rerun was possible.
