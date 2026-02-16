import helmet from '@fastify/helmet'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { AppModule } from './app.module.js'
import { AllExceptionsFilter } from './common/filters/index.js'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js'
import { config } from './config/index.js'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
      },
    })
  )

  const logger = new Logger('Bootstrap')

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter())

  // Global request logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor())

  // CORS
  app.enableCors({
    origin: config.api.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  const port = config.api.port
  const host = config.api.host

  await app.listen(port, host)
  logger.log(`API running on http://${host}:${port}`)
}

bootstrap()
