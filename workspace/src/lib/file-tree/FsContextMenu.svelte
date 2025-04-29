<script lang="ts">
  import { close, register, type Items } from "$lib/context-menu/index.js";
  import { type OnClick } from "$lib/utils/index.js";
  import type EditableName from "./EditableName.svelte";
  import type { TTreeItem } from "./Tree.svelte";

  type Props = {
    nameUI?: EditableName;
    target?: HTMLElement;
    atCursor?: boolean;
    beforeAction?: () => void;
  } & Partial<Pick<TTreeItem, "name" | "remove">> &
    Partial<Record<"open" | "copy" | "addFile" | "addFolder", OnClick>>;

  let {
    nameUI,
    open,
    copy,
    addFile,
    addFolder,
    remove,
    name,
    target,
    atCursor,
    beforeAction,
  }: Props = $props();

  const onMenuClick =
    (fn: OnClick): OnClick =>
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      beforeAction?.();
      fn(event);
      close();
    };

  const items: Items = $derived(
    (
      [
        [open, opener],
        [copy, duplicate],
        [addFile, file],
        [addFolder, folder],
        [
          name
            ? () => nameUI?.edit(true, name.split(".")[0].length)
            : undefined,
          renamer,
        ],
        [remove, deleter],
      ] as const
    )
      .filter(([fn]) => fn)
      .map(([fn, content]) => ({
        content,
        onclick: onMenuClick(fn as OnClick),
      })),
  );

  $effect(() => {
    if (!target) return;
    register(
      target,
      {
        props: () => ({ items }),
        notAtCursor: () => !atCursor,
      },
      {
        onMount: () => nameUI?.highlight(true),
        onClose: () => nameUI?.highlight(false),
      },
    );
  });

  let strokeWidth = 1.5;
</script>

{#snippet renamer()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width={strokeWidth}
    stroke="currentColor"
    class="size-5"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
    />
  </svg>

  Rename
{/snippet}

{#snippet opener()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width={strokeWidth}
    stroke="currentColor"
    class="size-5"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
    />
  </svg>

  Open
{/snippet}

{#snippet deleter()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width={strokeWidth}
    stroke="currentColor"
    class="size-5"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </svg>

  Delete
{/snippet}

{#snippet duplicate()}
  <svg fill="#000000" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg"
    ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
      id="SVGRepo_tracerCarrier"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></g><g id="SVGRepo_iconCarrier">
      <path
        d="M0 1919.887h1467.88V452.008H0v1467.88ZM1354.965 564.922v1242.051H112.914V564.922h1242.051ZM1920 0v1467.992h-338.741v-113.027h225.827V112.914H565.035V338.74H452.008V0H1920ZM338.741 1016.93h790.397V904.016H338.74v112.914Zm0 451.062h790.397v-113.027H338.74v113.027Zm0-225.588h564.57v-112.913H338.74v112.913Z"
        fill-rule="evenodd"
      ></path>
    </g></svg
  >

  Copy
{/snippet}

{#snippet file()}
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="#000000"
    class="size-5"
  >
    <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
    <g
      id="SVGRepo_tracerCarrier"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
    </g>
    <g id="SVGRepo_iconCarrier">
      <title></title>
      <g id="Complete">
        <g id="add-square">
          <g>
            <rect
              data-name="--Rectangle"
              fill="none"
              height="20"
              id="_--Rectangle"
              rx="2"
              ry="2"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={strokeWidth}
              width="20"
              x="2"
              y="2"
            ></rect>
            <line
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={strokeWidth}
              x1="15.5"
              x2="8.5"
              y1="12"
              y2="12"
            ></line>
            <line
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width={strokeWidth}
              x1="12"
              x2="12"
              y1="15.5"
              y2="8.5"
            ></line>
          </g>
        </g>
      </g>
    </g></svg
  >

  Add File
{/snippet}

{#snippet folder()}
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="size-5"
    ><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g
      id="SVGRepo_tracerCarrier"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></g><g id="SVGRepo_iconCarrier">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M6.85929 1.25001C6.88904 1.25001 6.91919 1.25002 6.94976 1.25002L6.98675 1.25001C7.33818 1.24999 7.56433 1.24998 7.78542 1.27065C8.7367 1.35961 9.63905 1.73337 10.3746 2.34313C10.5456 2.48485 10.7055 2.64477 10.954 2.89329L11.5303 3.46969C12.3761 4.3154 12.7012 4.6311 13.0768 4.84005C13.2948 4.96134 13.526 5.05713 13.766 5.12552C14.1793 5.24333 14.6324 5.25002 15.8284 5.25002L16.253 5.25002C17.526 5.25 18.5521 5.24998 19.364 5.35206C20.2054 5.45784 20.9204 5.68358 21.5077 6.21185C21.6061 6.30032 21.6997 6.39394 21.7882 6.49231C22.3165 7.07965 22.5422 7.79459 22.648 8.63601C22.75 9.4479 22.75 10.4741 22.75 11.747V14.0564C22.75 15.8942 22.75 17.3498 22.5969 18.489C22.4393 19.6615 22.1071 20.6104 21.3588 21.3588C20.6104 22.1071 19.6615 22.4393 18.489 22.5969C17.3498 22.75 15.8942 22.75 14.0564 22.75H9.94361C8.10584 22.75 6.65021 22.75 5.51099 22.5969C4.33857 22.4393 3.38962 22.1071 2.64126 21.3588C1.8929 20.6104 1.56078 19.6615 1.40315 18.489C1.24999 17.3498 1.25 15.8942 1.25002 14.0564L1.25002 6.94976C1.25002 6.91919 1.25001 6.88904 1.25001 6.85929C1.2499 6.06338 1.24982 5.55685 1.33237 5.11935C1.6949 3.19788 3.19788 1.6949 5.11935 1.33237C5.55685 1.24982 6.06338 1.2499 6.85929 1.25001ZM6.94976 2.75002C6.03312 2.75002 5.67873 2.75329 5.39746 2.80636C4.08277 3.05441 3.05441 4.08277 2.80636 5.39746C2.75329 5.67873 2.75002 6.03312 2.75002 6.94976V14C2.75002 15.9068 2.75161 17.2615 2.88978 18.2892C3.02504 19.2953 3.27871 19.8749 3.70192 20.2981C4.12513 20.7213 4.70478 20.975 5.71087 21.1103C6.73853 21.2484 8.0932 21.25 10 21.25H14C15.9068 21.25 17.2615 21.2484 18.2892 21.1103C19.2953 20.975 19.8749 20.7213 20.2981 20.2981C20.7213 19.8749 20.975 19.2953 21.1103 18.2892C21.2484 17.2615 21.25 15.9068 21.25 14V11.7979C21.25 10.4621 21.2486 9.5305 21.1597 8.82312C21.0731 8.13448 20.9141 7.76356 20.6729 7.49539C20.6198 7.43637 20.5637 7.3802 20.5046 7.32712C20.2365 7.08592 19.8656 6.92692 19.1769 6.84034C18.4695 6.75141 17.538 6.75002 16.2021 6.75002H15.8284C15.7912 6.75002 15.7545 6.75002 15.7182 6.75003C14.6702 6.75025 13.9944 6.75038 13.3548 6.56806C13.0041 6.46811 12.6661 6.32811 12.3475 6.15083C11.7663 5.82747 11.2885 5.3495 10.5476 4.60833C10.522 4.58265 10.496 4.55666 10.4697 4.53035L9.91943 3.98009C9.63616 3.69682 9.52778 3.58951 9.41731 3.49793C8.91403 3.08073 8.29664 2.825 7.64576 2.76413C7.50289 2.75077 7.35038 2.75002 6.94976 2.75002ZM12 11.25C12.4142 11.25 12.75 11.5858 12.75 12V13.25H14C14.4142 13.25 14.75 13.5858 14.75 14C14.75 14.4142 14.4142 14.75 14 14.75H12.75V16C12.75 16.4142 12.4142 16.75 12 16.75C11.5858 16.75 11.25 16.4142 11.25 16V14.75H10C9.5858 14.75 9.25002 14.4142 9.25002 14C9.25002 13.5858 9.5858 13.25 10 13.25H11.25V12C11.25 11.5858 11.5858 11.25 12 11.25Z"
        fill="currentColor"
      ></path>
    </g></svg
  >

  Add Folder
{/snippet}
