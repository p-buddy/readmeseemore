import type { File, Task, Test, Vitest, Suite } from 'vitest';
import type { Reporter as IReporter } from 'vitest/reporters';
import { Project, SourceFile, Node, SyntaxKind, type CallExpression, type ArrowFunction, type FunctionExpression } from "ts-morph";
import { fromMarkdown, } from 'mdast-util-from-markdown';
import { visit, type BuildVisitor, } from 'unist-util-visit';
import { basename, dirname } from "path";
import { readFileSync, writeFileSync } from 'fs';
import type { PackageJson } from "type-fest";
import { type TestAsDocumentationTarget, TestsAsDocumentationConstants } from '.';
import { createReverseExportLookup, tryFindClosestFileMatch, getAbsoluteDirname, getAbsoluteFileCandidates, Regex } from "./utils";

type ErrorCallback = (message: string) => void;

type CallbackNode = ArrowFunction | FunctionExpression;

type MarkdownTree = ReturnType<typeof fromMarkdown>;
type MarkdownCodeNode = Parameters<BuildVisitor<MarkdownTree, "code">>[0];

type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Package<TRequired extends keyof PackageJson = never> = {
  path: string;
  details: WithRequired<PackageJson, TRequired>;
}

export default class Reporter extends TestsAsDocumentationConstants implements IReporter {
  private error: ErrorCallback;

  onInit(ctx: Vitest) {
    ctx.config.includeTaskLocation = true;
    this.error = (message) => ctx.logger.error(message);
  }

  onCollected(files?: File[]) {
    const { Is, ProcessTest, TypescriptNodeLocator, TargetLocator, Validator } = Reporter;

    const { error } = this;

    const project = new Project();

    for (const file of files ?? []) {

      const { filepath } = file;
      const sourceFile = project.getSourceFile(filepath) ?? project.addSourceFileAtPath(filepath);
      const sourceDir = dirname(filepath);
      const nodeLocator = new TypescriptNodeLocator(sourceFile);
      const targetLocator = new TargetLocator(sourceDir, error);

      const pkg = targetLocator.findNearestPackageDefinition();

      if (!pkg) {
        error("Package details not found");
        continue;
      }

      if (!Validator.PackageHasName(pkg)) {
        error("Package name not found");
        continue;
      }

      const localToPackageImport = createReverseExportLookup(pkg);

      for (const suite of file.tasks.filter((x): x is Suite => Is("suite", x)))
        for (const test of suite.tasks.filter((x): x is Test => Is("test", x)))
          try {
            ProcessTest(test, error, sourceDir, localToPackageImport, nodeLocator, targetLocator);
          }
          catch (err) {
            error(`Error processing ${suite.name} -> ${test.name}: ${err} `);
          }

      for (const test of file.tasks.filter((x): x is Test => Is("test", x)))
        try {
          ProcessTest(test, error, sourceDir, localToPackageImport, nodeLocator, targetLocator);
        }
        catch (err) {
          error(`Error processing ${test.name}: ${err} `);
        }

      project.removeSourceFile(sourceFile);
    }
  }

  private static readonly ImportRemap = new Map<string, { from: string, to: string, as?: string }>([
    ["expect", { from: "vitest", to: "expect", }],
    ["expectTypeOf", { from: "vitest", to: "expect-type" }]
  ]);

  private static ProcessTest(
    test: Test,
    error: ErrorCallback,
    sourceDir: string,
    localToPackageImport: Map<string, string>,
    nodeLocator: InstanceType<typeof Reporter["TypescriptNodeLocator"]>,
    targetLocator: InstanceType<typeof Reporter["TargetLocator"]>
  ) {
    const {
      ExtractTargetFromIdentifier, CreateMarkdownTree, GetRelevantImports,
      ImportToLine, GetBodyLinesFromCallbackBody, ImportRemap, Validator
    } = Reporter;

    const validator = new Validator(test, error);

    const target = ExtractTargetFromIdentifier(test.name);

    if (!target || !validator.target(target)) return;

    const node = nodeLocator.getFromLocation(test.location);
    if (!validator.node(node)) return;

    const callExpression = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
    if (!validator.callExpression(callExpression)) return;

    const args = callExpression.getArguments();

    if (!validator.arguments(args)) return;

    const callbackArg = args.find(
      (arg): arg is CallbackNode => Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)
    )

    if (!validator.callbackArg(callbackArg)) return;

    const body = callbackArg.getBody();
    const documentation = targetLocator.findFilePath(target);

    if (!validator.documentationFile(documentation)) return;

    const tree = CreateMarkdownTree(documentation);
    if (!validator.markdownTree(tree)) return;

    const blocks = targetLocator.findCode(target, tree);
    if (!validator.codeBlocks(blocks)) return;

    const [block] = blocks;
    if (!validator.codeBlock(block)) return;

    const { position: { start, end } } = block;
    const documentationLines = readFileSync(documentation, "utf-8").split("\n");

    const imports = GetRelevantImports(body, nodeLocator);
    const importRemap = new Map<string, string[]>();

    for (const _import of imports) {
      const { path, names } = _import;

      if (path.startsWith("."))
        for (const candidate of getAbsoluteFileCandidates(path, sourceDir))
          if (localToPackageImport.has(candidate)) {
            _import.path = localToPackageImport.get(candidate)!;
            break;
          }

      for (let index = names.length - 1; index >= 0; index--) {
        const name = names[index];
        const remap = ImportRemap.get(name);
        if (remap?.from !== path) continue;
        const { to, as } = remap;
        importRemap.get(to)?.push(as ?? name) ?? importRemap.set(to, [as ?? name]);
        names.splice(index, 1);
      }
    }

    documentationLines.splice(
      start.line,
      end.line - start.line - 1,
      ...imports.filter(({ names }) => names.length > 0).map(ImportToLine),
      ...Array.from(importRemap.entries()).map(([path, names]) => ({ path, names })).map(ImportToLine),
      "",
      ...GetBodyLinesFromCallbackBody(body)
    );

    writeFileSync(documentation, documentationLines.join("\n"));
  }

  private static CreateMarkdownTree(mdfile: string) {
    try { return fromMarkdown(readFileSync(mdfile, "utf-8")); }
    catch (err) { return undefined }
  }

  private static GetBodyLinesFromCallbackBody(body: ReturnType<CallbackNode["getBody"]>) {
    const { MatchSurroundingBracesAndWhitespace, CaptureLeadingWhitespace } = Regex;
    const text = body.getText();
    const sanitized = Node.isBlock(body) ? text.replace(MatchSurroundingBracesAndWhitespace(), "") : text;
    const initialWhitespace = CaptureLeadingWhitespace().exec(sanitized)?.[1] ?? "";
    return sanitized.split("\n").map(x => x.replace(initialWhitespace, ""));
  }

  private static GetRelevantImports(
    body: ReturnType<CallbackNode["getBody"]>,
    { importDeclarations }: InstanceType<typeof Reporter["TypescriptNodeLocator"]>,
  ) {
    const usedIdentifiers = new Set<string>();
    body.forEachDescendant(
      node => { if (Node.isIdentifier(node)) usedIdentifiers.add(node.getText()) });

    return importDeclarations
      .map(declaration => {
        const names = declaration
          .getNamedImports()
          .map(named => named.getName())
          .filter(name => usedIdentifiers.has(name));

        return names.length > 0 ? { path: declaration.getModuleSpecifierValue(), names } : null;
      })
      .filter((imp): imp is NonNullable<typeof imp> => imp !== null);
  }

  private static readonly ImportToLine = ({ names, path }: ReturnType<typeof Reporter["GetRelevantImports"]>[number]) =>
    `import { ${names.join(", ")} } from "${path}";`;


  private static readonly Is = <Type extends Task["type"]>(
    type: Type, task: Task
  ): task is Extract<Exclude<Task, File>, { type: Type }> =>
    task.type === type;

  private static readonly TypescriptNodeLocator = class TypescriptNodeLocator {
    readonly importDeclarations: ReturnType<SourceFile["getImportDeclarations"]>;

    private readonly lines: string[];

    constructor(readonly sourceFile: SourceFile) {
      this.lines = sourceFile.getFullText().split("\n");
      this.importDeclarations = sourceFile.getImportDeclarations();
    }

    getFromLocation(location: Task["location"]) {
      if (!this.valid(location)) return;

      const { line, column } = location;
      let position = 0;
      for (let i = 0; i < line - 1; i++) position += this.lines[i].length + 1;
      return this.sourceFile.getDescendantAtPos(position + column - 1);
    }

    private valid(location: Task["location"]): location is Required<Task>["location"] {
      const { lines } = this;
      if (!location) return false;

      const { line, column } = location;
      if (line < 1 || line > lines.length) return false;
      if (column < 1 || column > lines[line - 1].length + 1) return false;

      return true;
    }
  }

  private static readonly Validator = class Validator {
    constructor(private readonly test: Test, private readonly onFailure: ErrorCallback) { }

    private validate(condition: boolean, message: string) {
      if (!condition) this.onFailure(`${this.test.name}: ${message}`);
      return condition;
    }

    target(target?: TestAsDocumentationTarget): target is NonNullable<TestAsDocumentationTarget> {
      return this.validate(Boolean(target!.id), "Target ID not found");
    }

    node(node?: Node): node is NonNullable<Node> {
      return this.validate(Boolean(node), "Node not found");
    }

    callExpression(callExpression?: CallExpression): callExpression is NonNullable<CallExpression> {
      return this.validate(Boolean(callExpression), "Call expression not found");
    }

    arguments(args: Node[]): args is [Node, ...([Node] | [Node, Node])] {
      return this.validate(args.length >= 2 && args.length <= 3,
        `Invalid number of arguments. Expected 2-3, got ${args.length}`);
    }

    callbackArg(callbackArg?: CallbackNode): callbackArg is NonNullable<CallbackNode> {
      return this.validate(Boolean(callbackArg), "Callback argument is not a function");
    }

    documentationFile(readme?: string): readme is string {
      return this.validate(Boolean(readme), "Readme file not found");
    }

    markdownTree(tree?: MarkdownTree): tree is MarkdownTree {
      return this.validate(Boolean(tree), "Markdown tree failed");
    }

    codeBlocks(codeBlocks: MarkdownCodeNode[]): codeBlocks is [MarkdownCodeNode] {
      return this.validate(codeBlocks.length > 0, "No code blocks found")
        && this.validate(codeBlocks.length === 1, "Multiple code blocks found");
    }

    codeBlock(codeBlock: MarkdownCodeNode): codeBlock is WithRequired<MarkdownCodeNode, "position"> {
      return this.validate(Boolean(codeBlock.position), "Code block not found");
    }

    static PackageHasName(pkg: Package): pkg is Package<"name"> {
      return Boolean(pkg.details.name);
    }
  }

  protected static readonly TargetLocator = class TargetLocator {
    /** File locations are cached (per testFile) to avoid multiple filesystem searches 
     * (**but** file contents are not cached to enable dynamic content changes to be reflected) 
     * */
    readonly cache = {
      fileByTarget: new Map<string | undefined, string | undefined>(),
      packageJsonPath: undefined as string | undefined,
    }

    constructor(readonly srcFileDir: string, readonly error: ErrorCallback) { }

    findFilePath({ file }: TestAsDocumentationTarget) {
      const { README_FILENAMES } = TargetLocator;
      const { srcFileDir, error, cache: { fileByTarget } } = this;

      if (!fileByTarget.has(file))
        fileByTarget.set(file, tryFindClosestFileMatch({
          startingPointDir: file ? getAbsoluteDirname(file, srcFileDir) : srcFileDir,
          specifiers: file ? [basename(file)] : README_FILENAMES,
          error
        }));

      return fileByTarget.get(file);
    }

    findNearestPackageDefinition(): Package | undefined {
      const { PACKAGE_JSON_FILENAMES } = TargetLocator;
      const { srcFileDir, error, cache: { packageJsonPath } } = this;

      const path = packageJsonPath ?? tryFindClosestFileMatch(
        { startingPointDir: srcFileDir, specifiers: PACKAGE_JSON_FILENAMES, error }
      );

      if (!path) return undefined;

      try {
        this.cache.packageJsonPath = path;
        const details = JSON.parse(readFileSync(path!, "utf-8"));
        return { path, details }
      }
      catch (err) {
        this.error(`Failed to parse package.json at ${path}: ${err}`);
        return undefined;
      }
    }

    findCode({ id }: TestAsDocumentationTarget, tree: MarkdownTree): MarkdownCodeNode[] {
      const { CaptureHashtagID } = Regex;
      const matchingNodes = new Array<MarkdownCodeNode>();
      const nonmatchingIDs = new Array<string>();
      visit(tree, 'code', (node) => {
        const matches = CaptureHashtagID().exec(node.meta ?? "");
        if (!matches) return;
        matches[1] === id ? matchingNodes.push(node) : nonmatchingIDs.push(matches[1]);
      });
      if (matchingNodes.length === 0)
        this.error(`No code block found for ${id}. Found: ${nonmatchingIDs.join(", ")}`);
      return matchingNodes;
    }

    static readonly README_FILENAMES = ["README.md", "README", "README.txt"];
    static readonly PACKAGE_JSON_FILENAMES = ["package.json"];
  }
}