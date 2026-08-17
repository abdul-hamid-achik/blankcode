export const ACHIEVEMENTS: Record<string, import('@blankcode/shared').AchievementDefinition> = {
  first_challenge: {
    type: 'first_challenge',
    title: 'First Steps',
    description: 'Complete your first challenge',
    icon: '🎉',
    color: '#22c55e',
    requirement: {
      type: 'challenges_completed',
      count: 1,
    },
  },
  challenge_master: {
    type: 'challenge_master',
    title: 'Challenge Master',
    description: 'Complete 10 challenges',
    icon: '🏆',
    color: '#eab308',
    requirement: {
      type: 'challenges_completed',
      count: 10,
    },
  },
  challenge_legend: {
    type: 'challenge_legend',
    title: 'Challenge Legend',
    description: 'Complete 20 challenges',
    icon: '👑',
    color: '#f59e0b',
    requirement: {
      type: 'challenges_completed',
      count: 20,
    },
  },
  polyglot: {
    type: 'polyglot',
    title: 'Polyglot',
    description: 'Complete challenges in 3 different languages',
    icon: '🌍',
    color: '#3b82f6',
    requirement: {
      type: 'languages_completed',
      count: 3,
    },
  },
  polyglot_master: {
    type: 'polyglot',
    title: 'Polyglot Master',
    description: 'Complete challenges in all 6 languages',
    icon: '🗣️',
    color: '#8b5cf6',
    requirement: {
      type: 'languages_completed',
      count: 6,
    },
  },
  expert: {
    type: 'expert',
    title: 'Expert Level',
    description: 'Complete all expert-level challenges',
    icon: '⚡',
    color: '#ef4444',
    requirement: {
      type: 'challenges_completed',
      count: 6,
    },
  },
  speed_demon: {
    type: 'speed_demon',
    title: 'Speed Demon',
    description: 'Complete a challenge in under 5 minutes',
    icon: '🚀',
    color: '#f97316',
    requirement: {
      type: 'time_limit',
      timeMs: 300000, // 5 minutes
    },
  },
  perfectionist: {
    type: 'perfectionist',
    title: 'Perfectionist',
    description: 'Complete 5 challenges on first attempt',
    icon: '💎',
    color: '#06b6d4',
    requirement: {
      type: 'perfect_score',
      count: 5,
    },
  },
  // `marathon` (7 days in a row) was removed on purpose, not lost: a daily
  // streak contradicts the product's own scheduler. SM-2 exists to tell you
  // NOT to come back until it is time, so the obedient learner has empty
  // days by design — a streak either breaks on them or manufactures
  // busywork. Presence ("4 of the last 7 days") replaced it in stats.
  language_specialist_ts: {
    type: 'language_specialist',
    title: 'TypeScript Specialist',
    description: 'Complete all TypeScript challenges',
    icon: '📘',
    color: '#3178c6',
    requirement: {
      type: 'languages_completed',
      languages: ['typescript'],
    },
  },
  language_specialist_python: {
    type: 'language_specialist',
    title: 'Python Specialist',
    description: 'Complete all Python challenges',
    icon: '🐍',
    color: '#3776ab',
    requirement: {
      type: 'languages_completed',
      languages: ['python'],
    },
  },
  language_specialist_go: {
    type: 'language_specialist',
    title: 'Go Specialist',
    description: 'Complete all Go challenges',
    icon: '🐹',
    color: '#00add8',
    requirement: {
      type: 'languages_completed',
      languages: ['go'],
    },
  },
  language_specialist_rust: {
    type: 'language_specialist',
    title: 'Rust Specialist',
    description: 'Complete all Rust challenges',
    icon: '🦀',
    color: '#dea584',
    requirement: {
      type: 'languages_completed',
      languages: ['rust'],
    },
  },
  language_specialist_react: {
    type: 'language_specialist',
    title: 'React Specialist',
    description: 'Complete all React challenges',
    icon: '⚛️',
    color: '#61dafb',
    requirement: {
      type: 'languages_completed',
      languages: ['react'],
    },
  },
  language_specialist_vue: {
    type: 'language_specialist',
    title: 'Vue Specialist',
    description: 'Complete all Vue challenges',
    icon: '💚',
    color: '#42b883',
    requirement: {
      type: 'languages_completed',
      languages: ['vue'],
    },
  },
}

export const LEARNING_PATHS = [
  {
    id: 'path-typescript-basics',
    slug: 'typescript-basics',
    name: 'TypeScript from scratch',
    description: 'Four write-the-whole-thing exercises, from a typed counter to an event emitter',
    icon: '📘',
    color: '#3178c6',
    order: 1,
    challengeIds: [
      'ts-challenge-001', // Type-Safe Counter
      'ts-challenge-002', // Generic Array Utilities
      'ts-challenge-003', // Promise Retry
      'ts-challenge-004', // Event Emitter
    ],
    isPublished: true,
  },
  {
    id: 'path-typescript-expert',
    slug: 'typescript-expert',
    name: 'TypeScript, the last two',
    description: 'A mini store and a query builder. No blanks.',
    icon: '🎯',
    color: '#3178c6',
    order: 2,
    challengeIds: [
      'ts-challenge-005', // Mini Redux
      'ts-challenge-006', // Query Builder
    ],
    isPublished: true,
  },
  {
    id: 'path-python-basics',
    slug: 'python-basics',
    name: 'Python from scratch',
    description: 'Four write-the-whole-thing exercises, from a converter to an async queue',
    icon: '🐍',
    color: '#3776ab',
    order: 3,
    challengeIds: [
      'py-challenge-001', // Temperature Converter
      'py-challenge-002', // File Statistics
      'py-challenge-003', // Context Manager
      'py-challenge-004', // Async Task Queue
    ],
    isPublished: true,
  },
  {
    id: 'path-python-expert',
    slug: 'python-expert',
    name: 'A Python ORM',
    description: 'One exercise: a small object-relational mapper. That is the whole path.',
    icon: '🎯',
    color: '#3776ab',
    order: 4,
    challengeIds: [
      'py-challenge-005', // Simple ORM
    ],
    isPublished: true,
  },
  {
    id: 'path-go-concurrency',
    slug: 'go-concurrency',
    name: 'Go concurrency',
    description:
      'Counters, rate limits, a worker pool, and a router — plus one string reverse to start',
    icon: '🐹',
    color: '#00add8',
    order: 5,
    challengeIds: [
      'go-challenge-001', // String Reverser
      'go-challenge-002', // Thread-Safe Counter
      'go-challenge-003', // Rate Limiter
      'go-challenge-004', // Worker Pool
      'go-challenge-005', // HTTP Router
    ],
    isPublished: true,
  },
  {
    id: 'path-rust-systems',
    slug: 'rust-systems',
    name: 'Rust from scratch',
    description: 'Option helpers through a small async runtime. No blanks.',
    icon: '🦀',
    color: '#dea584',
    order: 6,
    challengeIds: [
      'ru-challenge-001', // Option Utilities
      'ru-challenge-002', // Safe Division
      'ru-challenge-003', // TTL Cache
      'ru-challenge-004', // HTTP Builder
      'ru-challenge-005', // Async Runtime
    ],
    isPublished: true,
  },
  {
    id: 'path-react-hooks',
    slug: 'react-hooks',
    name: 'React hooks',
    description: 'Storage, debounce, a virtual list, a form, and infinite scroll. No blanks.',
    icon: '⚛️',
    color: '#61dafb',
    order: 7,
    challengeIds: [
      're-challenge-001', // useLocalStorage
      're-challenge-002', // Debounced Search
      're-challenge-003', // Virtualized List
      're-challenge-004', // Form Validation
      're-challenge-005', // Infinite Scroll
    ],
    isPublished: true,
  },
  {
    id: 'path-vue-composables',
    slug: 'vue-composables',
    name: 'Vue composables',
    description: 'The same five jobs as the React path, written as composables.',
    icon: '💚',
    color: '#42b883',
    order: 8,
    challengeIds: [
      'vue-challenge-001', // useLocalStorage
      'vue-challenge-002', // Debounced Search
      'vue-challenge-003', // Virtualized List
      'vue-challenge-004', // Form Validation
      'vue-challenge-005', // Infinite Scroll
    ],
    isPublished: true,
  },
  {
    id: 'path-frontend-performance',
    slug: 'frontend-performance',
    name: 'Lists that stay fast',
    description: 'Virtualize and paginate in React and Vue. Same problem, two trees.',
    icon: '⚡',
    color: '#f59e0b',
    order: 9,
    challengeIds: [
      're-challenge-003', // Virtualized List (React)
      'vue-challenge-003', // Virtualized List (Vue)
      're-challenge-005', // Infinite Scroll (React)
      'vue-challenge-005', // Infinite Scroll (Vue)
    ],
    isPublished: true,
  },
  {
    id: 'path-backend-essentials',
    slug: 'backend-essentials',
    name: 'Routers and stores',
    description: 'An HTTP router, an ORM, a request builder, and a query builder.',
    icon: '🖥️',
    color: '#10b981',
    order: 10,
    challengeIds: [
      'go-challenge-005', // HTTP Router
      'py-challenge-005', // Simple ORM
      'ru-challenge-004', // HTTP Builder
      'ts-challenge-006', // Query Builder
    ],
    isPublished: true,
  },
  {
    id: 'path-working-with-models',
    slug: 'working-with-models',
    name: 'Working with Models',
    // The table of contents of the vibecoding curriculum: reviewing what a
    // model wrote, specifying before it writes, prompting under a turn
    // budget, buying only the context it needs, and building it a tool.
    description:
      'Practice the craft of working with AI: review, specify, budget your turns, pick context, build tools',
    icon: '🤝',
    color: '#8b5cf6',
    order: 11,
    challengeIds: [
      'ts-review-001', // Find the defect the model shipped
      'ts-spec-001', // Specify before it writes
      'ts-turn-001', // Three messages: a retry that has to give up
      'ts-context-001', // Give it what it needs
      'ts-tool-001', // Build the model a tool
      'ts-review-003', // The async defect that survives junior review
      'ts-turn-002', // Three messages: refusals a model never volunteers
      'ts-context-002', // The guessable endpoint that runs and is wrong
      'ts-tool-002', // The rule that finds the hydration-breaking template
    ],
    isPublished: true,
  },
  {
    id: 'path-polyglot-vibecoding',
    slug: 'polyglot-vibecoding',
    name: 'Polyglot Vibecoding',
    // The same craft, out of TypeScript's comfort zone: each language gets
    // the full loop — find the seeded defect, steer in three messages, buy
    // exactly the context the model needs. The defects are the ones models
    // actually produce in each language, not translations of one bug.
    description:
      'Review, prompt, and context-budget across Python, Go, Rust, React, and Vue — every language has its own ways for generated code to be wrong',
    icon: '🗺️',
    color: '#8b5cf6',
    order: 12,
    challengeIds: [
      'py-review-002', // The default argument with a memory
      'py-spec-001', // Specify before it writes
      'py-turn-001', // Three messages: a slugify that survives truncation
      'py-context-001', // Column names you cannot guess
      'py-tool-002', // The rule that finds the fence nobody closed
      'go-review-001', // The truncate that corrupts text
      'go-spec-001', // The cases that make card masking unambiguous
      'go-turn-001', // Three messages: one slash exactly
      'go-context-001', // Struct fields you cannot guess
      'go-tool-001', // The rule that finds the broken error chain
      'ru-review-002', // The budget that explodes at zero
      'ru-spec-001', // The cases that make a duration formatter unambiguous
      'ru-turn-001', // Three messages: a parser that counts its commas
      'ru-context-001', // The error variant that is not NotFound
      'ru-tool-001', // The rule that finds the unwrap waiting for production
      're-review-002', // The countdown stuck one second in
      're-spec-001', // The cases that make a classnames helper unambiguous
      're-turn-001', // Three messages: a debounce that keeps the last word
      're-context-001', // Props the training data cannot supply
      're-tool-001', // The rule that holds usages to the props table
      'vue-review-001', // The cart total that never moves
      'vue-spec-001', // The cases that make a relative timestamp unambiguous
      'vue-turn-001', // Three messages: pagination that survives shrinking
      'vue-context-001', // The toast API that is not the famous one
      'vue-tool-001', // The rule that finds the watcher that watched a value
    ],
    isPublished: true,
  },
]
