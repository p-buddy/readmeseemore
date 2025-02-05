<script lang="ts">
  export let stringProp: string;
  export let numberProp: number;
  export let optionalRecordProp: Record<string, any> = {};

  export const exportedVariable = "hello";
  export const exportedFunction = (): typeof exportedVariable =>
    exportedVariable;
</script>

<div>
  <h1>Legacy</h1>
  <p>{stringProp}</p>
  <p>{numberProp}</p>
  <p>{optionalRecordProp}</p>
</div>
