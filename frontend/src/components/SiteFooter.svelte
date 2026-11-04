<script lang="ts">
  import MessagesSquareIcon from '@lucide/svelte/icons/messages-square';

  const repository = 'https://github.com/tariquesani/baghban';
  const discussions = 'https://github.com/tariquesani/baghban/discussions/';
</script>

<footer class="site-footer">
  <p>
    <span>Baghban</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>A garden management system</span>
    <span class="dot" aria-hidden="true">·</span>
    <a href={repository} target="_blank" rel="noreferrer">
      <svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
      </svg>
      GitHub
      <span class="sr-only"> (opens in a new tab)</span>
    </a>
    <span class="dot" aria-hidden="true">·</span>
    <a href={discussions} target="_blank" rel="noreferrer">
      <MessagesSquareIcon size={14} aria-hidden="true" />
      Discussions
      <span class="sr-only"> (opens in a new tab)</span>
    </a>
  </p>
</footer>

<style>
  .site-footer {
    flex: 0 0 auto;
    padding: 8px 24px;
    border-top: 1px solid rgba(25, 29, 23, 0.12);
    color: #4a6b4b;
    font-family: Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.4;
  }

  p {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: inherit;
    text-decoration: none;
  }

  a:hover,
  a:focus-visible {
    text-decoration: underline;
  }

  .mark {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .dot {
    color: #6b8c6c;
  }
</style>
