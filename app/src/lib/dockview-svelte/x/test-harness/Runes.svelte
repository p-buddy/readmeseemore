<script lang="ts">
  let props: {
    stringProp: string;
    numberProp: number;
    optionalRecordProp?: Record<string, any>;
  } = $props();

  export const exportedVariable = "hello";
  export const exportedFunction = (): typeof exportedVariable =>
    exportedVariable;
</script>

<div>
  <h1>Runes</h1>
  <p>{props.stringProp}</p>
  <p>{props.numberProp}</p>
  <p>{props.optionalRecordProp?.hello}</p>
</div>
