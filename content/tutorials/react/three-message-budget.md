---
title: "The Three-Message Budget"
slug: "react-three-message-budget"
description: "Cap the conversation at three messages and each one gets a job: buy the whole shape, correct one reading you actually verified, and know when to stop steering and edit the code yourself."
track: "react"
order: 6
difficulty: "intermediate"
tags: ["ai", "prompting", "specification", "verification"]
practice:
  concept: "turn-budget"
  label: "Three messages"
---

Anyone can steer a model to a working function in twenty turns. The loop is familiar: a vague request, a wrong answer, "no, not quite", a different wrong answer, "closer, but" — and eventually the code converges on the intent you never stated. It feels like collaboration. It is closer to search, with you playing the fitness function one complaint at a time. Cap the budget at three messages and the padding disappears: each message has to have a job, and the jobs turn out to be different skills.

## Message one buys the shape

The first message is the cheapest place to be precise, and the most expensive place to be vague — every clause you leave open, the model closes with a choice it does not announce. Coherence is what makes a wrong reading hard to notice.

Take a retry helper: `retry(operation, attempts, delayMs)` retries a failing async operation. Typed quickly, that is the whole prompt. But the spec has edges. What happens when every attempt fails? What happens when `attempts` is zero?

```typescript
export async function retry<T>(
  operation: () => Promise<T>,
  attempts: number,
  delayMs: number
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      await sleep(delayMs)
    }
  }
  throw lastError
}
```

When all attempts fail, this correctly throws the last error. But call it with `attempts` of zero and the loop never runs, so `throw lastError` executes with `lastError` still unset: the function literally throws `undefined`. The first message is where you ask: *if every attempt fails, throw the last error; if attempts is zero or less, throw immediately without calling the operation.*

::code-blank{lang="typescript" href="/tracks/react/turn-budget" label="practice three messages for real"}
---
code: |
  if (attempts <= 0) throw new Error('attempts must be positive')
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      await sleep(delayMs)
    }
  }
  throw ___blank_start___lastError___blank_end___
---
::

## Message two is a correction, which means reading comes first

The middle of the budget is where it usually dies. The reflex is to type the second message immediately. The discipline is to spend that turn on the defect you *found*: read what came back, hold it against the spec clause by clause.

The skeleton above has one more defect. It sleeps after the final failure: three attempts with a 30ms delay takes ~90ms to give up instead of ~60. The second message names the clause precisely: *wait between attempts, not after the last one.*

::code-blank{lang="typescript" href="/tracks/react/turn-budget" label="practice three messages for real"}
---
code: |
  } catch (error) {
    lastError = error
    if (attempt < ___blank_start___attempts___blank_end___) await sleep(delayMs)
  }
---
::

## Stopping is a move

The third message is the most expensive one in the budget: a correction regenerates the function and can silently lose fixes the previous turn got right. An edit you type yourself touches only that line.

Verification is cheap and steering is expensive. The real skill at the end of the budget is recognizing the crossover: the moment the remaining distance is a diff you could type, type it. Submitting with a turn in hand is not leaving value unused; it is the evidence you specified well and verified early.

## Where this bites

**Spending message one on a fragment.** "Write a retry helper" costs you message two and three just to discover your own spec in public.

**Typing the second message before reading the reply.** A correction aimed at no verified defect is a restatement, not a fix.

**Steering when you should be editing.** Late corrections regenerate everything and can regress what was already right.

**Treating the hidden tests as an obstacle.** The graded suite stays hidden because pasting it would replace the skill being practiced with transcription.
