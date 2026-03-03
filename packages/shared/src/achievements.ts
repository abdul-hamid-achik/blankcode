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
    type: 'challenge_master',
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
  marathon: {
    type: 'marathon',
    title: 'Marathon',
    description: 'Complete challenges 7 days in a row',
    icon: '🔥',
    color: '#ec4899',
    requirement: {
      type: 'streak',
      count: 7,
    },
  },
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
    name: 'TypeScript Fundamentals',
    description: 'Master TypeScript from basic types to advanced patterns',
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
    name: 'TypeScript Expert',
    description: 'Advanced TypeScript patterns for experts',
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
    name: 'Python Essentials',
    description: 'From basic functions to advanced Python patterns',
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
    name: 'Python Expert',
    description: 'Advanced Python: ORM, metaclasses, and more',
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
    name: 'Go Concurrency Master',
    description: 'Master Go concurrency with goroutines and channels',
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
    name: 'Rust Systems Programming',
    description: 'Learn Rust from options to async runtime',
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
    name: 'React Hooks Master',
    description: 'Master React hooks and modern patterns',
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
    name: 'Vue Composables Master',
    description: 'Master Vue 3 composables and composition API',
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
    name: 'Frontend Performance',
    description: 'Build high-performance frontend components',
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
    name: 'Backend Essentials',
    description: 'Essential backend patterns across languages',
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
]
