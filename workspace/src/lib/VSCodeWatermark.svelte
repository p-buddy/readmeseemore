<script lang="ts">
  import type { AuxiliaryDockPanelProps } from "@p-buddy/dockview-svelte";

  let props: AuxiliaryDockPanelProps["watermark"] = $props();
</script>

<div class="watermark">
  <div class="letterpress"></div>
  <div class="shortcuts"></div>
</div>

<style>
  .watermark {
    height: 100%;
    max-width: 290px;
    margin: auto;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
  }

  .letterpress {
    width: 100%;
    max-height: 100%;
    aspect-ratio: 1/1;
    background-size: 100%;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 40 40'%3E%3Cpath fill='%23000' fill-rule='evenodd' d='M30.235 39.884a2.491 2.491 0 01-1.781-.73L12.7 24.78l-3.46 2.624-3.406 2.582a1.665 1.665 0 01-1.082.338 1.664 1.664 0 01-1.046-.431l-2.2-2a1.666 1.666 0 010-2.463L7.458 20 4.67 17.453 1.507 14.57a1.665 1.665 0 010-2.463l2.2-2a1.665 1.665 0 012.13-.097l6.863 5.209L28.452.844a2.488 2.488 0 011.841-.729c.351.009.699.091 1.019.245l8.236 3.961a2.5 2.5 0 011.415 2.253V33.42a2.501 2.501 0 01-1.416 2.257l-8.235 3.961a2.492 2.492 0 01-1.077.246zm.716-28.947l-11.948 9.062 11.952 9.065-.004-18.127z' clip-rule='evenodd' opacity='.3'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position-x: center;
  }
</style>
