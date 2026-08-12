---
title: "The Three-Message Budget"
slug: "python-three-message-budget"
description: "Cap the conversation at three messages and each one gets a job: buy the whole shape, correct one reading you actually verified, and know when to stop steering and edit the code yourself."
track: "python"
order: 7
difficulty: "intermediate"
tags: ["ai", "prompting", "specification", "verification"]
practice:
  concept: "turn-budget"
  label: "Three messages"
---

Anyone can steer a model to a working function in twenty turns. The loop is familiar: a vague request, a wrong answer, "no, not quite", a different wrong answer, "closer, but" — and eventually the code converges on the intent you never stated. It feels like collaboration. It is closer to search, with you playing the fitness function one complaint at a time. Cap the budget at three messages and the padding disappears: each message has to have a job, and the jobs turn out to be different skills.

## Message one buys the shape

The first message is the cheapest place to be precise, and the most expensive place to be vague — every clause you leave open, the model closes with a choice it does not announce. The choice arrives fluent and well-named, which is the problem: coherence is what makes a wrong reading hard to notice. An answer that guessed wrong does not look like a guess.

Take a retry helper: `retry(operation, attempts, delay_ms)` retries a failing async operation. Typed quickly, that is the whole prompt. But the spec has edges, and they are exactly the ones a quick first message drops. What happens when every attempt fails? What happens when `attempts` is zero? A model left to choose tends to produce this skeleton:

```python
import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")

async def retry(
    operation: Callable[[], Awaitable[T]],
    attempts: int,
    delay_ms: float,
) -> T:
    last_error: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await operation()
        except Exception as error:
            last_error = error
            await asyncio.sleep(delay_ms / 1000)
    raise last_error  # type: ignore[misc]
```

When all attempts fail, this correctly re-raises the last error — run it with three failing calls and the caller catches `failure 3`. But call it with `attempts` of zero and the loop never runs, so `raise last_error` executes with `last_error` still `None`: Python raises `TypeError: exceptions must derive from BaseException` instead of anything about retries. A caller's `except RuntimeError` misses it entirely. That behavior is in the code above right now, visible only if you thought to ask. The first message is where you ask: *if every attempt fails, raise the last error; if attempts is zero or less, raise immediately without calling the operation.* Failure behavior is not an edge case of the shape — it is half of it.

::code-blank{lang="python" href="/tracks/python/turn-budget" label="practice three messages for real"}
---
code: |
  if attempts <= 0:
      raise ValueError("attempts must be positive")
  last_error: BaseException | None = None
  for attempt in range(1, attempts + 1):
      try:
          return await operation()
      except Exception as error:
          last_error = error
          await asyncio.sleep(delay_ms / 1000)
  assert last_error is not None
  raise ___blank_start___last_error___blank_end___
---
::

## Message two is a correction, which means reading comes first

The middle of the budget is where it usually dies. The reflex is to type the second message immediately — add a feature, restate the request louder. The discipline is to spend that turn on the defect you *found*, which requires looking for one: read what came back, hold it against the spec clause by clause, and the defect will be sitting in a clause you never named.

Reading here means something narrower than skimming for weirdness. Take the clauses from your first message — raise the last error, raise immediately on zero attempts, wait between attempts — and check each one against the code that came back, line by line. The model will not flag the clauses it decided for itself; a choice and a requirement look identical in the output. The diff between what you asked and what you got is the only place a real correction can come from, and producing it costs a minute of reading against a turn of guessing.

The skeleton above has one more defect. It sleeps after the final failure: three attempts with a 30ms delay takes ~90ms to give up instead of ~60, because the last `except` waits `delay_ms` for an attempt that never comes. In a retry helper with real delays — seconds, with backoff — that is a caller waiting a full delay to be told the news that was already known. The second message names the clause precisely: *wait between attempts, not after the last one.* One sentence, aimed at a verified defect, beats a paragraph of restated intent.

::code-blank{lang="python" href="/tracks/python/turn-budget" label="practice three messages for real"}
---
code: |
  except Exception as error:
      last_error = error
      if attempt < ___blank_start___attempts___blank_end___:
          await asyncio.sleep(delay_ms / 1000)
---
::

## Stopping is a move

The third message is the most expensive one in the budget, because of what it does to code that is already mostly right: a correction message regenerates the function, and regeneration can silently lose fixes the previous turn got right. You are re-rolling the whole answer to change one line. An edit you type yourself touches only that line.

This is the asymmetry the budget exists to teach: verification is cheap and steering is expensive. Reading the reply costs a minute and no turns. A correction costs a turn and re-rolls code that was partly right. The economics only point one way — spend reading freely, spend messages reluctantly, and never spend one to learn something reading would have told you.

So the real skill at the end of the budget is recognizing the crossover: the moment the remaining distance is a diff you could type, type it. "Almost — but rename the guard and make the error message say the attempt count" is a third message that risks the whole function to save yourself thirty seconds of editing. Submitting with a turn in hand is not leaving value unused; it is the evidence you specified well and verified early, and the turn exercises report it that way on purpose.

## Where this bites

**Spending message one on a fragment.** "Write a retry helper" costs you message two and three just to discover your own spec in public. The clauses you did not write in the first message are the defects you will pay turns to remove later.

**Typing the second message before reading the reply.** A correction aimed at no verified defect is a restatement, and a restatement buys a rephrasing, not a fix. If you cannot point at the line that is wrong, you have not earned the turn yet.

**Steering when you should be editing.** Late corrections regenerate everything and can regress what was already right. When the fix is a line, the model is the wrong tool for it — you have a keyboard.

**Treating the hidden tests as an obstacle.** The graded suite stays hidden because pasting it would replace the skill being practiced with transcription. The same is true outside the exercise: a spec you can only satisfy by seeing the test cases is a spec you have not understood yet.
