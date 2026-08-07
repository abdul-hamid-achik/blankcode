import { requireAdmin } from '../../../utils/admin'

/**
 * Whether the caller may see the operator view.
 *
 * The navigation needs this to decide whether to render the link, and it cannot
 * be decided in the browser: the allowlist is a server environment variable,
 * and shipping it to the client would publish the list of who is an admin.
 *
 * Answers 204 or the 404 that `requireAdmin` throws. No body, because there is
 * nothing to say beyond yes.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  setResponseStatus(event, 204)
  return null
})
