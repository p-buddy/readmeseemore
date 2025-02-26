# Tests As Documentation Utility

Capture [vitetest]()

## Usage

### Tutorial

#### 1. Add Reporter to `test.reporters` in vite.config.ts

Inside of your vite.config.ts, add the Reporter to the reporters array.

```ts
import { defineConfig } from 'vitest/config';
import Reporter from '@readme-see-more/tests-as-documentation/Reporter';

export default defineConfig({
  ...,
  test: {
    ...,
    reporters: ["verbose", new Reporter()],
  }
});
```

Or reference the Reporter file directly:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  ...,
  test: {
    ...,
    reporters: ["verbose", "@readme-see-more/tests-as-documentation/Reporter"],
  }
});
```

#### 2. Define a codeblock target in your README.md and give it an `#id`


```md
# My README

... other content ...

\`\`\`ts #my-codeblock-target
// All content within codeblock will be overwritten by the "Tests As Documentation" Reporter
\`\`\`
```

#### 3. Write a test that 'populates' the codeblock target

```ts
import { test, expect, expectTypeOf } from "vitest";
import { populates } from "@readme-see-more/tests-as-documentation";
import { someExport } from "./src/some-module";

test("my-test" + populates("#my-codeblock-target"), () => {
  // All of the content within this callback (including this comment) will fill the codeblock target
  expect(1).toBe(1);
  expectTypeOf<typeof x>().toBeNumber();
  someExport();
});
```

**Note:** Assume that our package's [exports](https://nodejs.org/api/packages.html#exports) field is defined as `{ ".": "./src/some-module.ts" }` and our package's [name](https://nodejs.org/api/packages.html#name) is `my-package`.

#### 4. Run your tests

```bash
vitest
```

##### 5. Inspect output in README.md

The Reporter will overwrite the codeblock target with the content of the test callback, with the following modifications:
- local imports are remapped to their associated entry in the package's `exports` field (and/or `main` field)
- `expect` is sourced from the "expect" package instead of "vitest" to enable direct execution (e.g. via [tsx](https://www.npmjs.com/package/tsx))
- `expectTypeOf` is sourced from the "expect-type" package instead of "vitest" to enable direct execution (e.g. via [tsx](https://www.npmjs.com/package/tsx))

```ts #my-codeblock-target
import { expect } from "expect";
import { expectTypeOf } from "expect-type";
import { someExport } from "my-package";

// All of the content within this callback (including this comment) will fill the codeblock target
expect(1).toBe(1);
expectTypeOf<typeof x>().toBeNumber();
someExport();
```

### Advanced