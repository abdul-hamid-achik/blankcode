import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const web = process.cwd()
const read = (rel: string) => readFileSync(join(web, rel), 'utf-8')

describe('catalog and chrome wiring', () => {
  it('filters challenges by the embedded track slug, not a UUID prefix', () => {
    const page = read('pages/challenges/index.vue')
    expect(page).toContain('challengeBelongsToTrack')
    expect(page).toContain('trackLabelForExercise')
    expect(page).not.toContain('conceptId.startsWith')
    expect(page).not.toContain("conceptId.split('-')")
  })

  it('puts Reading and Connect on the signed-out nav', () => {
    const header = read('components/layout/app-header.vue')
    expect(header).toContain("{ to: '/reading', label: 'Reading' }")
    expect(header).toContain("{ to: '/connect', label: 'Connect' }")
  })

  it('keeps Review in the header and out of the sidebar', () => {
    const header = read('components/layout/app-header.vue')
    const sidebar = read('components/layout/app-sidebar.vue')
    expect(header).toContain('to="/review"')
    expect(header).toContain('reviewStore.dueCount')
    expect(sidebar).not.toContain("{ to: '/review', label: 'Review' }")
    expect(sidebar).not.toContain("link.to === '/review'")
  })

  it('signs out by leaving the protected page', () => {
    expect(read('components/layout/app-sidebar.vue')).toContain("navigateTo('/')")
  })

  it('exposes forgot-password and OAuth on the door', () => {
    const login = read('pages/login.vue')
    expect(login).toContain('Forgot password')
    expect(login).toContain('OauthButtons')
    expect(login).toContain('oauthErrorMessage')
    expect(read('pages/register.vue')).toContain('OauthButtons')
    expect(read('pages/forgot.vue')).toContain('/api/account/password/forgot')
    expect(read('pages/reset.vue')).toContain('/api/account/password/reset')
  })

  it('announces tutorial checkpoint results', () => {
    expect(read('components/content/CodeBlank.vue')).toContain('aria-live="polite"')
  })

  it('names a quota endpoint the exercise page reads', () => {
    expect(read('components/exercise/exercise-workspace.vue')).toContain('/api/account/quota')
    expect(read('server/routes/api/account/quota.get.ts')).toContain('FREE_DAILY_SUBMISSIONS')
  })

  it('does not nest a button inside the sign-in link', () => {
    const header = read('components/layout/app-header.vue')
    expect(header).toContain('to="/login"')
    expect(header).not.toContain('<NuxtLink to="/login">')
  })

  it('skips to main content and starts a new account on a real blank', () => {
    expect(read('layouts/default.vue')).toContain('Skip to content')
    expect(read('layouts/default.vue')).toContain('id="main-content"')
    expect(read('pages/register.vue')).toContain('FIRST_SITTING_HREF')
    expect(read('pages/exercise/[exerciseId].vue')).not.toContain('requiresAuth: true')
    expect(read('server/routes/sitemap.xml.ts')).toContain("'/connect'")
  })

  it('puts challenge filters in the query string', () => {
    const page = read('pages/challenges/index.vue')
    expect(page).toContain('writeQuery')
    expect(page).toContain('selectedKind')
    expect(page).toContain('exerciseHref')
  })
})
