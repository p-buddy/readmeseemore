# index.ts

```ts
import { add } from "./utils";
import { multiply } from "./math";
console.log(add(1, 2));
console.log(multiply(2, 3));
```

# utils.ts

```ts
export const add = (a: number, b: number) => a + b;
```

# math.ts

```ts
export const multiply = (a: number, b: number) => a * b;
```
