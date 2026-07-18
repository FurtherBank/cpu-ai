---
name: s-skill-validate
description: >-
  Validate whether a skill's "what it is" and "how to do it" instructions let a fresh agent infer the correct design "why" without the skill over-explaining that why. Use when creating, revising, or auditing a Codex/Cursor skill; when the user provides or asks to compare against a real design mental model, rationale, "why" information system, or expected behavior theory; when testing whether SKILL.md is practice-focused rather than rationale-heavy; or when the user asks for subagent/forward-test validation, meaning diff, blind inference, or s-skill-validate.
---

# s-skill-validate

## Purpose

Validate a skill with a three-sided test:

1. A fresh agent can infer the intended design "why" from the skill's definitions and procedures.
2. The skill itself remains focused on "what it is" and "how to do it", rather than leaking the full "why" as theory.
3. A no-context fresh subagent can use the skill to complete its declared task without relying on the author's unstated oral context.

Use this skill to test skill design integrity, not to review general writing quality. The third test is an execution-readiness check for reusable skills, not a general prose review, and it must be proven by a no-context subagent rather than static review alone.

## Required Inputs

Collect or identify:

- **Candidate skill**: the `SKILL.md` path or pasted skill content being validated.
- **True why**: the actual design mental model, rationale, or information system the skill should imply.
- **Validation target**: whether to only report findings, revise the skill, or revise and rerun validation. If it includes revision, also identify whether the validator is authorized to edit the candidate.
- **Reader-task context**: the intended fresh executor, the task it should complete, and any known input or audience constraints. Infer this from the candidate when possible; otherwise record it as an explicit validation uncertainty.
- **No-context subagent capability**: a fresh subagent that can receive only a copy of the candidate skill, with no inherited conversation, tool trace, workspace material, true why, or prior conclusions. If this capability is unavailable, full validation cannot pass.

If the true why is missing, do not claim full validation. Ask for it, or perform only the following weaker **inferred-why consistency check**:

1. Extract the candidate's apparent problem, mechanism, distinctions, execution consequences, and non-goals from its own text.
2. Check whether its definitions, triggers, actions, outputs, and failure handling contradict one another or require an unstated author-only premise.
3. Report the result as `Inferred-why consistency check only`; identify every unresolved premise and explicitly omit Meaning Diff against a true-why answer key.

This check can find internal incoherence, but cannot prove that the candidate transmits its intended design why. Its verdict is never a full `Pass`.

## Source Separation Rule

Keep three artifacts separate:

- **Candidate skill**: what the blind agent may see.
- **True why**: the answer key, visible only to the validating agent.
- **Blind inference output**: what the fresh agent inferred from the candidate skill.
- **Blind reader-task output**: what a different fresh agent can determine and execute from the candidate skill alone.

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
- An identifiable reader/executor, task start, observable terminal state, and declared dependencies for each materially different trigger. Treat triggers as materially different when their executor, required inputs, procedure, terminal state, or safety boundary differs. Do not assume author-only project context fills these gaps.

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

### 3.5 Run Required No-Context Reader-Task Check

This is separate from blind inference: it tests whether the candidate gives a fresh executor enough operational context to act safely. Run it for every validation. Static audit in Step 5.5 is required too, but it is never a substitute for this experiment.

Create a **different**, fresh subagent with no inherited conversation context. Provide the candidate as copied text or a single isolated candidate artifact; do not give it a workspace path that lets it inspect surrounding materials. The subagent may use no source other than that candidate text. Do not provide the true why, expected reader-task profile, suspected gaps, desired fixes, tool traces, or prior conclusions.

Give the agent a neutral prompt shaped like:

```text
The candidate skill text below is your only source. Do not use outside context or inspect other files.

Task: identify each distinct reader task this skill declares. For each task, explain:
- who the executor is, what starts the task, and what observable result completes it;
- the inputs, tools, permissions, or referenced artifacts it needs, including when and why each is needed;
- the concrete action path, success signal, and exception or escalation path;
- the exact text that supports each answer; and
- every remaining assumption or question, classifying it as either a declared runtime input or author-only missing context.

Do not evaluate the quality of the skill or invent missing context. Output a structured Chinese report.
```

If no such subagent can be created, or the candidate cannot be isolated from other context, mark the Reader-Task Self-Containment Audit **Not Validated**. Do not replace it with a self-check, static review, or an agent that already saw the task context. The overall verdict cannot be `Pass` or `Pass after edits` until a valid no-context reader-task check has run.

Treat any author-only missing-context question, or any load-bearing answer without candidate evidence, as a blocker in Step 5.5. A declared runtime input is not a blocker only when the candidate states what it is, when it is supplied, and how it is used.

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

### 5.5 Audit Reader-Task Self-Containment

Audit whether a fresh agent can safely use the candidate skill without author-only oral context. This is an execution-readiness audit for a reusable skill, not a request to copy all background theory or source material into the skill. Use the required no-context reader-task output from Step 3.5 as external evidence; static inspection alone cannot pass this audit.

For each declared trigger, identify a **Reader-Task Profile**:

- **Reader/executor**: the fresh agent the skill is written for.
- **Task**: the decision, action, or deliverable it must complete.
- **Start and terminal state**: what starts the task and what observable result ends it.
- **Declared dependencies**: tools, inputs, permissions, or referenced artifacts the task needs.

If a profile cannot be identified from the candidate, record a blocker and fail this audit. Then inspect every load-bearing term, condition, threshold, decision gate, required artifact, and failure boundary. Record exact candidate evidence for every applicable question:

In this audit, **load-bearing** means that an ambiguity or omission could change the reader's interpretation, task execution, safety, or validation verdict. **Operational closure** means that, from the declared trigger and dependencies, the reader can complete the task and recognize either its success signal or its exception/escalation path without asking the author for unstated context.

- **Meaning and scope**: Can the reader identify what it means, when it applies, and when it does not?
- **Operational closure**: Given the trigger, can the reader determine required inputs, ordered action, expected success signal, and exception or escalation path?
- **Epistemic status**: For a factual claim, is its source or evidence stated? For a judgment, is its criterion stated? For a recommendation, are its trigger and relevant tradeoff stated?
- **Dependency closure**: If an external input or reference is required, does the candidate identify where it is, when it is needed, and what decision-relevant information it supplies?
- **Audience safety**: Does the candidate avoid exposing details inappropriate for its declared or reasonably expected reader? Mark this Not Applicable only when no such disclosure is present.

A compact operational rule is enough. Do not require a full rationale essay or a copy of the true why. External tools, inputs, and documents are allowed when their identity or stable location, use point, and decision-relevant role are declared; a vague reference such as "follow the usual process" is not closed.

Pass only when every Reader-Task Profile has operational closure, every load-bearing item has sufficient meaning-and-scope evidence, the no-context subagent's cited output confirms those conditions, no blocker remains, and no inappropriate disclosure is found. Warn only for omissions that cannot change a safe decision or execution. Fail for an unidentified reader-task profile, an author-only assumption, an ambiguous action loop, an unsupported material fact, judgment, or recommendation, an unresolved dependency, or inappropriate disclosure. Mark **Not Validated** when the required no-context subagent check did not run or its isolation cannot be evidenced.

Compare the no-context subagent's cited answers and its classification of runtime inputs versus author-only questions against this static audit by meaning. Do not treat a fluent uncited reconstruction as evidence that the candidate is self-contained.

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

If reader-task self-containment fails, close the missing execution information without expanding the skill into a rationale essay:

- Define the missing term, threshold, scope, or non-goal where the reader needs it.
- State the trigger, required input, ordered action, success signal, and exception or escalation path.
- Name an external dependency precisely, state when it is used, and state what decision-relevant information it supplies.
- Label factual evidence, judgment criteria, recommendations, assumptions, and unknowns so the reader does not mistake one for another.
- Replace private implementation detail with a stable concept when that detail is inappropriate for the intended reader.

Treat an edit as **material** when it changes a trigger, definition, decision rule, action, output, failure boundary, external dependency, or reader-task profile. Pure spelling, formatting, or link corrections that do not change any of those meanings are not material.

If revision is requested but edit authorization is absent, do not write the candidate. Report the necessary edits under `Changes Made Or Recommended` and set the validation target to report-only for this round.

After material edits, rerun blind inference and the required no-context reader-task check with new, separate fresh agents. Do not reuse an agent from the previous validation round.

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

**Reader-Task Self-Containment Audit**
- Reader-task profiles: <reader, task, start/terminal state, and dependencies>
- Static-audit verdict: Pass / Warn / Fail
- Required no-context subagent: <subagent id and isolation evidence / Not Validated and why>
- Combined verdict: Pass / Warn / Fail / Not Validated

| Load-bearing item | What the reader must be able to do or determine | Candidate evidence | Result | Consequence |
| --- | --- | --- | --- | --- |
| <term, gate, claim, action, dependency, or boundary> | <reader task> | <exact text or missing> | Pass / Warn / Fail | <execution, interpretation, or safety impact> |

- Blind reader-task output: <short cited summary, including runtime-input vs author-only-context classification>
- Blockers: <none or concise list>

**Verdict**
Pass / Pass after edits / Fail

A full Pass requires a passing meaning test and a passing Reader-Task Self-Containment Audit backed by the required no-context subagent. If that subagent check did not run or was not demonstrably isolated, the verdict is `Not Validated`, not a static-only Pass.

**Changes Made Or Recommended**
<file paths and concise change summary, or recommended edits>
```

Keep the report high-signal. Include raw blind inference only when the user asks or when a disputed diff needs evidence.

## Validation Integrity Checklist

Before finalizing, confirm:

- The blind agent did not receive the true why.
- The comparison used meaning, not phrase overlap.
- The practice-focus audit did not reward over-explaining.
- A different fresh subagent received only an isolated copy of the candidate skill for the reader-task check; it inherited no conversation, tool trace, workspace material, or prior conclusion.
- Its remaining questions were classified as declared runtime inputs or author-only missing context, and every author-only question is reported as a blocker.
- Every materially different reader task has a reader-task profile, and every self-containment blocker is reported or repaired.
- Declared external dependencies are resolvable without author-only context, and no reader-inappropriate information is exposed.
- Any edits preserved the skill's triggerability and concrete execution guidance.
- Any rerun used a fresh agent or clearly stated why no blind rerun was possible.
