import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../src/app.module.js'

describe('App (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('DRIZZLE')
      .useValue({})
      .overrideProvider('SUBMISSION_QUEUE')
      .useValue({ add: async () => ({ id: 'test' }) })
      .overrideProvider('GENERATION_QUEUE')
      .useValue({ add: async () => ({ id: 'test' }) })
      .compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('/health (GET)', () => {
    it('returns health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeDefined()
    })
  })
})
