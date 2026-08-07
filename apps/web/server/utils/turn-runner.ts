/**
 * Runs a finished session's code against the exercise's real suite.
 *
 * A placeholder that refuses rather than pretends. The execution path already
 * exists and lives behind the Effect API; wiring this to it needs a submission
 * to be created from session code rather than from the editor, which is a
 * change to that service and not to this one.
 *
 * Returning `false` here would report every session as failed, which reads as a
 * working feature giving wrong answers. Throwing keeps it honestly unfinished.
 */
export async function runHiddenTests(_code: string, _exerciseId: string): Promise<boolean> {
  throw createError({
    statusCode: 501,
    statusMessage: 'Running a turn-budget submission is not wired up yet',
  })
}
