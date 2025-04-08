<script lang="ts">
  import { fade } from "svelte/transition";

  type Props = {
    checked: boolean;
    size?: 2 | 4 | 6 | 8 | 10;
  };

  let { checked, size = 6 }: Props = $props();

  const dimensions =
    size === 2
      ? "w-2 h-2"
      : size === 4
        ? "w-4 h-4"
        : size === 6
          ? "w-6 h-6"
          : size === 8
            ? "w-8 h-8"
            : "w-10 h-10";
</script>

<div class="relative {dimensions}">
  {#if checked}
    <svg
      class="absolute checkmark w-full h-full shadow-green-500"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 52 52"
      transition:fade
    >
      <circle
        class="circle stroke-green-500"
        cx="26"
        cy="26"
        r="25"
        fill="none"
      />
      <path class="check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
    </svg>
  {:else}
    <svg
      transition:fade={{ delay: 200 }}
      aria-hidden="true"
      class="absolute w-full h-full text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
      viewBox="0 0 100 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
  {/if}
</div>

<style>
  .circle {
    stroke-dasharray: 166;
    stroke-dashoffset: 166;
    stroke-width: 2;
    stroke-miterlimit: 10;
    fill: none;
    animation: stroke 0.2s cubic-bezier(0.65, 0, 0.45, 1) forwards;
  }
  .checkmark {
    border-radius: 50%;
    display: block;
    stroke-width: 2;
    stroke: #fff;
    stroke-miterlimit: 10;
    box-shadow: inset 0px 0px 0px;
    animation:
      fill 0.2s ease-in-out 0.3s forwards,
      scale 0.2s ease-in-out 0.4s both;
  }
  .check {
    transform-origin: 50% 50%;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    stroke-width: 6;
    animation: stroke 0.2s cubic-bezier(0.65, 0, 0.45, 1) 0.4s forwards;
  }
  @keyframes stroke {
    100% {
      stroke-dashoffset: 0;
    }
  }
  @keyframes scale {
    0%,
    100% {
      transform: none;
    }
    50% {
      transform: scale3d(1.1, 1.1, 1);
    }
  }
  @keyframes fill {
    100% {
      box-shadow: inset 0px 0px 0px 30px var(--color-green-500);
    }
  }
</style>
