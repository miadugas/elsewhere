<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { Scale, Telescope, Info } from "lucide-vue-next";
import { useComparison } from "../composables/useComparison";
import { useTheme } from "../composables/useTheme";
import PlacePicker from "../components/PlacePicker.vue";
import SalaryInput from "../components/SalaryInput.vue";
import ResultSlab from "../components/ResultSlab.vue";
import PlainEnglish from "../components/PlainEnglish.vue";
import BasketList from "../components/BasketList.vue";
import BreakdownSheet from "../components/BreakdownSheet.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import ExploreView from "./ExploreView.vue";
import AboutView from "./AboutView.vue";
import groundLight from "../assets/scenes/ground-light.jpg";
import groundDark from "../assets/scenes/ground-dark.jpg";

const c = useComparison();
onMounted(() => {
  c.loadMetros();
});
const { isDark } = useTheme();

// day scene in light, night scene in dark — matches the toggle's sun/moon
const heroScene = computed(() => (isDark.value ? groundDark : groundLight));

// which doorway is showing — the bottom nav switches this
const view = ref<"compare" | "explore" | "about">("compare");

const hasBothMetros = computed(() => !!c.from.value && !!c.to.value);
const hasResult = computed(
  () => !!c.result.value && !!c.from.value && !!c.to.value,
);
</script>

<template>
  <main
    class="relative mx-auto flex min-h-full max-w-md flex-col"
    :style="{ paddingBottom: 'var(--space-thumb)' }"
  >
    <!-- ── Brand mark ─────────────────────────────────────────── -->
    <header class="px-5 pb-2 pt-6">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <h1
            class="text-[length:var(--text-numeric)] font-black leading-none tracking-tight"
          >
            Elsewhere
          </h1>
          <span
            class="text-[length:var(--text-eyebrow)] uppercase opacity-75"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >cost of living parity</span
          >
        </div>
        <!-- Theme toggle — sliding sun ⇄ moon switcher -->
        <ThemeToggle />
      </div>
    </header>

    <!-- ════ COMPARE doorway ═══════════════════════════════════ -->
    <template v-if="view === 'compare'">
      <!-- ── Result stack ───────────────────────────────────────── -->
      <div
        class="reveal-stack flex flex-col gap-[var(--space-stack)] px-5 pt-4"
        v-if="hasBothMetros"
      >
        <ResultSlab
          v-if="hasResult"
          :from="c.from.value!"
          :to="c.to.value!"
          :result="c.result.value!"
          :period="c.period.value"
          :hours-per-week="c.hoursPerWeek.value"
        />

        <!-- Prompt when metros picked but no salary yet -->
        <section
          v-else
          class="px-5 py-6 text-center"
          :style="{
            borderRadius: 'var(--radius-sheet)',
            background: 'var(--color-paper)',
            border: '1px dashed var(--color-contour-ink)',
            boxShadow: 'var(--shadow-sheet)',
          }"
        >
          <p
            class="text-[length:var(--text-eyebrow)] uppercase opacity-60"
            style="letter-spacing: var(--text-eyebrow--letter-spacing)"
          >
            Almost there
          </p>
          <p class="mt-1 text-[length:var(--text-lede)] font-bold">
            Enter your salary below to see the parity number.
          </p>
        </section>

        <PlainEnglish
          v-if="hasResult"
          :from="c.from.value!"
          :to="c.to.value!"
          :result="c.result.value!"
          :period="c.period.value"
          :hours-per-week="c.hoursPerWeek.value"
        />

        <BasketList
          :rows="c.basket.value"
          :from="c.from.value!"
          :to="c.to.value!"
        />
        <BreakdownSheet :from="c.from.value!" :to="c.to.value!" />
      </div>

      <!-- ── Empty hero: nothing picked yet ─────────────────────── -->
      <section v-else class="reveal mt-2 px-5 pb-2 pt-4">
        <div
          class="relative overflow-hidden"
          :style="{
            borderRadius: 'var(--radius-slab)',
            boxShadow: 'var(--shadow-slab)',
            minHeight: '22rem',
          }"
        >
          <!-- day scene (light) / night scene (dark) — sits behind the message,
               swapping with the theme to echo the sun/moon toggle -->
          <img
            :src="heroScene"
            alt=""
            draggable="false"
            class="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style="object-position: 40% center"
          />
          <!-- legibility scrim: canvas-tinted, weighted to the top-left where
               the copy lives; fades out so the sun/moon + hills stay clear -->
          <div
            class="pointer-events-none absolute inset-0"
            :style="{
              background:
                'linear-gradient(116deg, color-mix(in oklch, var(--color-canvas) 84%, transparent) 0%, color-mix(in oklch, var(--color-canvas) 46%, transparent) 40%, transparent 70%), linear-gradient(to top, color-mix(in oklch, var(--color-canvas) 48%, transparent) 0%, transparent 28%)',
            }"
          />

          <!-- the message — ink flips with the theme, so it reads on either sky -->
          <div class="relative px-6 py-8" style="color: var(--color-ink)">
            <p
              class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
              style="letter-spacing: var(--text-eyebrow--letter-spacing)"
            >
              The question
            </p>
            <p
              class="font-display mt-2 font-black"
              style="
                font-size: var(--text-display);
                line-height: var(--text-display--line-height);
                letter-spacing: var(--text-display--letter-spacing);
              "
            >
              If I move,<br />what's my number?
            </p>
            <p
              class="mt-4 max-w-[42ch] text-[length:var(--text-lede)] font-medium leading-snug opacity-90"
            >
              Pick two cities below. We'll show the salary that keeps your life
              the same — and what changes when you swap zip codes.
            </p>
          </div>
        </div>
      </section>

      <!-- ── Thumb zone: inputs ─────────────────────────────────── -->
      <section class="mt-auto px-5 pb-4 pt-6" aria-label="Comparison inputs">
        <!-- From → To read as one route pair; the dashed rail on the left
           threads the From waypoint down into the To waypoint. -->
        <div class="flex flex-col gap-3">
          <PlacePicker
            label="From"
            :metros="c.metros.value"
            :model-value="c.from.value?.id ?? null"
            @update:model-value="c.setFrom"
            @swap="c.swap"
          />

          <PlacePicker
            label="To"
            :metros="c.metros.value"
            :model-value="c.to.value?.id ?? null"
            @update:model-value="c.setTo"
            @swap="c.swap"
          />
        </div>

        <!-- salary is a separate question — give it room to breathe -->
        <div class="mt-7">
          <SalaryInput
            :model-value="c.displaySalary.value"
            :period="c.period.value"
            :hours-per-week="c.hoursPerWeek.value"
            @update:model-value="c.setSalary"
            @update:period="c.setPeriod"
            @update:hours-per-week="c.setHoursPerWeek"
          />
        </div>
      </section>
    </template>

    <!-- ════ EXPLORE doorway ═══════════════════════════════════ -->
    <ExploreView v-else-if="view === 'explore'" :comparison="c" />

    <!-- ════ ABOUT doorway ═════════════════════════════════════ -->
    <AboutView v-else-if="view === 'about'" />

    <!-- ── Pill bottom nav — shares the content column so its edges
         line up with the salary slab above it ─────────────────────── -->
    <div class="fixed inset-x-0 bottom-3 z-30 mx-auto max-w-md px-5">
      <nav
        class="nav-pill relative flex w-full items-center p-1.5"
        :class="{
          'nav-explore': view === 'explore',
          'nav-about': view === 'about',
        }"
        :style="{
          borderRadius: 'var(--radius-pill)',
          // opaque: same tint as --seg-track but composited over the canvas,
          // so content scrolling under the floating bar can't show through
          background:
            'color-mix(in oklch, var(--color-ink) 7%, var(--color-canvas))',
          border: '1px solid var(--seg-border)',
          boxShadow:
            'inset 0 1px 2px rgba(var(--shadow-base), 0.1), var(--shadow-sheet-lifted)',
        }"
        aria-label="App sections"
      >
        <!-- sliding active pill — same motion + lift as the toggles -->
        <span class="nav-thumb" aria-hidden="true" />
        <button
          type="button"
          @click="view = 'compare'"
          :aria-current="view === 'compare' ? 'page' : undefined"
          class="font-display relative z-10 flex flex-1 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5"
          :class="view === 'compare' ? 'font-black' : 'font-bold'"
          :style="{
            color:
              view === 'compare'
                ? 'var(--seg-label)'
                : 'var(--seg-label-muted)',
            opacity: view === 'compare' ? 1 : 1,
            transition:
              view === 'compare'
                ? 'color 160ms ease 210ms, opacity 160ms ease 210ms'
                : 'color 160ms ease 0ms, opacity 160ms ease 0ms',
          }"
        >
          <Scale
            class="h-[18px] w-[18px]"
            :stroke-width="2"
            aria-hidden="true"
          />
          <span class="text-[0.625rem] uppercase leading-none tracking-[0.08em]"
            >Compare</span
          >
        </button>
        <button
          type="button"
          @click="view = 'explore'"
          :aria-current="view === 'explore' ? 'page' : undefined"
          class="font-display relative z-10 flex flex-1 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5"
          :class="view === 'explore' ? 'font-black' : 'font-bold'"
          :style="{
            color:
              view === 'explore'
                ? 'var(--seg-label)'
                : 'var(--seg-label-muted)',
            opacity: view === 'explore' ? 1 : 1,
            transition:
              view === 'explore'
                ? 'color 160ms ease 210ms, opacity 160ms ease 210ms'
                : 'color 160ms ease 0ms, opacity 160ms ease 0ms',
          }"
        >
          <Telescope
            class="h-[18px] w-[18px]"
            :stroke-width="2"
            aria-hidden="true"
          />
          <span class="text-[0.625rem] uppercase leading-none tracking-[0.08em]"
            >Explore</span
          >
        </button>
        <button
          type="button"
          @click="view = 'about'"
          :aria-current="view === 'about' ? 'page' : undefined"
          class="font-display relative z-10 flex flex-1 min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5"
          :class="view === 'about' ? 'font-black' : 'font-bold'"
          :style="{
            color:
              view === 'about' ? 'var(--seg-label)' : 'var(--seg-label-muted)',
            opacity: view === 'about' ? 1 : 1,
            transition:
              view === 'about'
                ? 'color 160ms ease 210ms, opacity 160ms ease 210ms'
                : 'color 160ms ease 0ms, opacity 160ms ease 0ms',
          }"
        >
          <Info
            class="h-[18px] w-[18px]"
            :stroke-width="2"
            aria-hidden="true"
          />
          <span class="text-[0.625rem] uppercase leading-none tracking-[0.08em]"
            >About</span
          >
        </button>
      </nav>
    </div>
  </main>
</template>

<style scoped>
/* bottom-nav active pill — slides between Compare / Explore like the toggles.
   Three equal (flex-1) items, so the pill is one third and translates 100%
   of its own width to land under the next item. */
.nav-thumb {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 6px;
  z-index: 0;
  width: calc((100% - 12px) / 3);
  border-radius: var(--radius-pill);
  background: var(--seg-thumb);
  box-shadow: var(--seg-thumb-shadow);
  transform: translateX(0);
  transition: transform 380ms cubic-bezier(0.34, 1.3, 0.5, 1);
}
.nav-pill.nav-explore .nav-thumb {
  transform: translateX(100%);
}
.nav-pill.nav-about .nav-thumb {
  transform: translateX(200%);
}
@media (prefers-reduced-motion: reduce) {
  .nav-thumb {
    transition: none;
  }
}
</style>
