import React, { useEffect } from "react";
import { reactify } from "@p-buddy/svelte-preprocess-react";
import Button from "./Button.svelte";
import { useRef } from "react";

const RButton = reactify(Button);

function MyComponent() {
  let hi = useRef<() => void>();
  useEffect(() => {
    hi.current?.();
  }, [hi.current]);
  return <RButton hi={hi.current}>Click me</RButton>;
}
