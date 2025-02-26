import { Regex } from "./utils";

export type TestAsDocumentationTarget = {
  id: string;
  file?: string;
}

export class TestsAsDocumentationConstants {
  static readonly FormIdentifier = ({ file, id }: TestAsDocumentationTarget) => {
    const { IdentifierWrapper, TargetPlaceholder } = TestsAsDocumentationConstants;

    if (file && !Regex.MatchAnchoredPath().test(file)) file = "./" + file;

    const url = new URL(`file://${file ?? ""}`);
    url.hash = "#" + id.replace(Regex.MatchLeadingHashtag(), "");
    return IdentifierWrapper.replace(TargetPlaceholder, url.href);
  }

  protected static ExtractTargetFromIdentifier(identifier: string): TestAsDocumentationTarget | undefined {
    const matches = TestsAsDocumentationConstants.TargetMatcherRegex().exec(identifier);
    const content = matches?.[1];

    if (!content) return undefined;

    const url = new URL(content);
    const { pathname, href, hash } = url;
    const file = href.slice("file://".length, href.indexOf(pathname) + pathname.length);
    const id = hash.replace(Regex.MatchLeadingHashtag(), "");

    return {
      id: id.replace(Regex.MatchLeadingHashtag(), ""),
      file: Boolean(file) ? file : undefined
    };
  }

  protected static readonly TargetPlaceholder = "_";
  protected static readonly IdentifierWrapper = `[(test-as-documentation) ${TestsAsDocumentationConstants.TargetPlaceholder}]`;

  private static readonly TargetMatcherRegex = () => {
    const { EscapeSpecial, CaptureAllString } = Regex;
    const { IdentifierWrapper, TargetPlaceholder } = TestsAsDocumentationConstants;
    return new RegExp(EscapeSpecial(IdentifierWrapper).replace(TargetPlaceholder, CaptureAllString));
  }
}

export const populates = (target: `#${string}`): string => {
  return " " + TestsAsDocumentationConstants.FormIdentifier({ id: target });
}