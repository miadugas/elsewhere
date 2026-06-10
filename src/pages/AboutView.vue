<script setup lang="ts">
// Static informational view — presentation only, no logic.
</script>

<template>
  <section
    class="reveal-stack flex flex-col gap-[var(--space-stack)] px-5 pb-4 pt-4"
  >
    <!-- ── Header ─────────────────────────────────────────────── -->
    <header class="px-1 pt-2">
      <p
        class="text-[length:var(--text-eyebrow)] uppercase opacity-70"
        style="letter-spacing: var(--text-eyebrow--letter-spacing)"
      >
        About
      </p>
      <h2
        class="font-display mt-2 font-black"
        style="
          font-size: var(--text-display);
          line-height: var(--text-display--line-height);
          letter-spacing: var(--text-display--letter-spacing);
        "
      >
        One honest<br />number.
      </h2>
      <p class="mt-3 text-[length:var(--text-body)] opacity-80">
        Elsewhere answers a single question: if you move from one city to
        another, what salary keeps your life the same?
      </p>
    </header>

    <!-- ── Cards ──────────────────────────────────────────────── -->
    <article class="about-card">
      <p class="about-eyebrow">How it works</p>
      <p class="about-body">
        It's built on <strong>regional price parity</strong> — how far a dollar
        stretches in each metro versus the national average (100). Your pay is
        rescaled by the ratio between your two cities. No accounts, no tracking;
        it runs entirely on your device, even offline.
      </p>
    </article>

    <article class="about-card">
      <p class="about-eyebrow">The data</p>
      <p class="about-body">
        384 U.S. metro areas, from the
        <strong>U.S. Bureau of Economic Analysis</strong> Regional Price
        Parities (2024). Population figures from the U.S. Census Bureau. Typical
        rent is the <strong>Zillow Observed Rent Index</strong> (ZORI, all
        homes) —
        <a
          href="https://www.zillow.com/research/data/"
          target="_blank"
          rel="noopener noreferrer"
          class="underline underline-offset-2"
          >data provided by Zillow Group</a
        >.
      </p>
    </article>

    <article class="about-card">
      <p class="about-eyebrow">An honest limit</p>
      <p class="about-body">
        RPP is a metro-wide average — your real costs shift with neighborhood
        and lifestyle. Treat the number as a strong starting point, not a quote.
      </p>
    </article>

    <p
      class="px-1 pt-1 text-[length:var(--text-eyebrow)] uppercase opacity-60"
      style="letter-spacing: var(--text-eyebrow--letter-spacing)"
    >
      Elsewhere · Cost-of-living parity
    </p>
  </section>
</template>

<style scoped>
.about-card {
  padding: 1.25rem;
  border-radius: var(--radius-sheet);
  background: var(--color-paper);
  border: 1px solid var(--color-contour);
  box-shadow: var(--shadow-sheet);
}
.about-eyebrow {
  font-size: var(--text-eyebrow);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--text-eyebrow--letter-spacing);
  opacity: 0.7;
}
.about-body {
  margin-top: 0.5rem;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}
.about-body strong {
  font-weight: 700;
}
</style>
