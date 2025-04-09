```json file://package.json
{
  "name": "example",
  "version": "1.0.0"
}
```

```ts file://index.ts
console.log("Hello, world!");
```

```bash rmsm://startup
npm install
npx --yes tsx index.ts
```
