<script lang="ts">
  import { Workspace } from "@readmeseemore/workspace";
</script>

<div class="w-screen h-screen">
  <Workspace
    status={(status) => {
      console.log(status);
    }}
  />
</div>
