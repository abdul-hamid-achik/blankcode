import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './database/database.module.js'
import { QueueModule } from './queue/queue.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { UsersModule } from './modules/users/users.module.js'
import { TracksModule } from './modules/tracks/tracks.module.js'
import { ExercisesModule } from './modules/exercises/exercises.module.js'
import { SubmissionsModule } from './modules/submissions/submissions.module.js'
import { ProgressModule } from './modules/progress/progress.module.js'
import { GenerationModule } from './modules/generation/generation.module.js'
import { AppController } from './app.controller.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    QueueModule,
    AuthModule,
    UsersModule,
    TracksModule,
    ExercisesModule,
    SubmissionsModule,
    ProgressModule,
    GenerationModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
