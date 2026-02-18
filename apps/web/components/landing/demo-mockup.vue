<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useInView } from '~/composables/useInView'

const sectionRef = ref<HTMLElement | null>(null)
const isInView = useInView(sectionRef)

// Animation phase: 0=initial, 1=blanks 1-2 filled, 2=typing blank3, 3=typing blank4, 4=tests passed
const phase = ref(0)
const blank3Text = ref('')
const blank4Text = ref('')
const showToast = ref(false)
const filledCount = ref(0)

let intervalId: ReturnType<typeof setInterval> | null = null
let timeoutIds: ReturnType<typeof setTimeout>[] = []

function clearTimeouts() {
  timeoutIds.forEach(clearTimeout)
  timeoutIds = []
}

function typeText(target: 'blank3' | 'blank4', fullText: string, onDone: () => void) {
  let i = 0
  function typeNext() {
    if (i < fullText.length) {
      if (target === 'blank3') {
        blank3Text.value = fullText.slice(0, i + 1)
      } else {
        blank4Text.value = fullText.slice(0, i + 1)
      }
      i++
      const id = setTimeout(typeNext, 300)
      timeoutIds.push(id)
    } else {
      onDone()
    }
  }
  typeNext()
}

function runSequence() {
  // Reset
  phase.value = 0
  blank3Text.value = ''
  blank4Text.value = ''
  showToast.value = false
  filledCount.value = 0

  // Phase 1: Show blanks 1-2 as filled (after short delay)
  const t1 = setTimeout(() => {
    phase.value = 1
    filledCount.value = 2
  }, 500)
  timeoutIds.push(t1)

  // Phase 2: Type blank 3
  const t2 = setTimeout(() => {
    phase.value = 2
    typeText('blank3', 'n - 1', () => {
      filledCount.value = 3
    })
  }, 2000)
  timeoutIds.push(t2)

  // Phase 3: Type blank 4
  const t3 = setTimeout(() => {
    phase.value = 3
    typeText('blank4', 'n - 2', () => {
      filledCount.value = 4
    })
  }, 5000)
  timeoutIds.push(t3)

  // Phase 4: Show toast
  const t4 = setTimeout(() => {
    phase.value = 4
    showToast.value = true
  }, 7500)
  timeoutIds.push(t4)
}

let started = false

watch(isInView, (visible) => {
  if (visible && !started) {
    started = true
    runSequence()
    intervalId = setInterval(() => {
      clearTimeouts()
      runSequence()
    }, 9500)
  }
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
  clearTimeouts()
})
</script>

<template>
  <section ref="sectionRef" class="py-20 md:py-28">
    <div class="container">
      <div
        :class="[isInView ? 'animate-fade-slide-up' : 'opacity-0']"
      >
        <h2 class="text-3xl md:text-4xl font-bold text-center mb-4">See How It Works</h2>
        <p class="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Read the code. Fill in the blanks. Run the tests. Learn by doing.
        </p>
      </div>

      <div class="max-w-4xl mx-auto relative">
        <div class="demo-glow" />
        <div
          :class="[
            'relative rounded-xl border border-border shadow-xl shadow-primary/5 overflow-hidden',
            isInView ? 'animate-fade-slide-up animation-delay-200' : 'opacity-0',
          ]"
        >
          <!-- Title bar -->
          <div class="bg-card border-b border-border px-4 py-3 flex items-center gap-2">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-red-500/80" />
              <div class="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div class="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span class="text-sm text-muted-foreground font-mono ml-2">fibonacci.ts</span>
            <div class="ml-auto">
              <span class="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-medium">TS</span>
            </div>
          </div>

          <!-- Code area -->
          <div class="bg-[#1e1e2e] p-4 overflow-x-auto">
            <pre class="font-mono text-sm leading-relaxed"><code><!--
--><span class="line"><span class="line-num">1</span><span class="text-blue-400">function</span> <span class="text-yellow-300">fibonacci</span>(n: <span class="text-green-400">number</span>): <span class="text-green-400">number</span> {'{'}</span>
<span class="line"><span class="line-num">2</span>  <span class="text-blue-400">if</span> (n &lt;= <span :class="phase >= 1 ? 'blank-filled' : 'blank-empty animate-pulse-blank'">{{ phase >= 1 ? '1' : '\u00A0\u00A0\u00A0' }}</span>) {'{'}</span>
<span class="line"><span class="line-num">3</span>    <span class="text-purple-400">return</span> <span :class="phase >= 1 ? 'blank-filled' : 'blank-empty animate-pulse-blank'">{{ phase >= 1 ? 'n' : '\u00A0\u00A0\u00A0' }}</span>;</span>
<span class="line"><span class="line-num">4</span>  {'}'}</span>
<span class="line"><span class="line-num">5</span>  <span class="text-purple-400">return</span> <span class="text-yellow-300">fibonacci</span>(<span :class="[phase >= 2 && blank3Text ? 'blank-filling' : phase >= 2 && filledCount >= 3 ? 'blank-filled' : 'blank-empty animate-pulse-blank', phase === 2 && blank3Text.length < 5 ? 'animate-blink-cursor' : '']">{{ phase >= 2 ? (blank3Text || '\u00A0\u00A0\u00A0\u00A0\u00A0') : '\u00A0\u00A0\u00A0\u00A0\u00A0' }}</span>) +</span>
<span class="line"><span class="line-num">6</span>         <span class="text-yellow-300">fibonacci</span>(<span :class="[phase >= 3 && blank4Text ? 'blank-filling' : phase >= 3 && filledCount >= 4 ? 'blank-filled' : 'blank-empty animate-pulse-blank', phase === 3 && blank4Text.length < 5 ? 'animate-blink-cursor' : '']">{{ phase >= 3 ? (blank4Text || '\u00A0\u00A0\u00A0\u00A0\u00A0') : '\u00A0\u00A0\u00A0\u00A0\u00A0' }}</span>);</span>
<span class="line"><span class="line-num">7</span>{'}'}</span></code></pre>
          </div>

          <!-- Bottom status bar -->
          <div class="bg-card border-t border-border px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-muted-foreground">
              {{ filledCount }} of 4 blanks filled
            </span>
            <button
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground"
            >
              <svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2l10 6-10 6V2z" />
              </svg>
              Run Tests
            </button>
          </div>

          <!-- Toast -->
          <Transition name="toast">
            <div
              v-if="showToast"
              class="absolute bottom-16 right-4 animate-toast-slide-up flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-medium"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8.5l3.5 3.5 6.5-8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              All tests passed
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.line {
  display: block;
  color: #cdd6f4;
}

.line-num {
  display: inline-block;
  width: 2rem;
  text-align: right;
  margin-right: 1rem;
  color: rgba(205, 214, 244, 0.3);
  user-select: none;
}

.blank-empty {
  display: inline-block;
  background: rgba(205, 214, 244, 0.08);
  border: 1px dashed rgba(205, 214, 244, 0.2);
  padding: 1px 8px;
  border-radius: 4px;
  min-width: 2.5rem;
  text-align: center;
  color: rgba(205, 214, 244, 0.4);
}

.blank-filling {
  display: inline-block;
  background: hsl(var(--primary) / 0.2);
  border: 1px solid hsl(var(--primary) / 0.3);
  padding: 1px 8px;
  border-radius: 4px;
  color: hsl(var(--primary));
}

.blank-filled {
  display: inline-block;
  background: hsl(var(--primary) / 0.2);
  border: 1px solid hsl(var(--primary) / 0.3);
  padding: 1px 8px;
  border-radius: 4px;
  color: hsl(var(--primary));
}

.demo-glow {
  position: absolute;
  inset: -20px;
  z-index: -1;
  background: linear-gradient(to right, hsl(var(--primary) / 0.05), transparent, hsl(var(--primary) / 0.05));
  filter: blur(40px);
  pointer-events: none;
}

.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.2s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
