import vm from "vm";
import ts from "typescript";
import {
  PreparedReviewInput,
  PreparedReviewOption,
  ReviewGeneratedUiInput,
  ReviewOptionInput,
  ReviewSourceType,
} from "../types";
import { sanitizeHtml, validateReviewHtml } from "./sanitize";

const RENDER_TIMEOUT_MS = 250;
const MODULE_FILENAME = "review-generated-ui.input.tsx";

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const FRAGMENT = Symbol("reviewGeneratedUiFragment");

type JsxChild = string | number | boolean | null | undefined | JsxChild[];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function renderStyleValue(style: unknown): string {
  if (typeof style === "string") {
    return style.trim();
  }

  if (!style || typeof style !== "object") {
    return "";
  }

  return Object.entries(style as Record<string, unknown>)
    .filter(([, raw]) => raw !== null && raw !== undefined && raw !== false)
    .map(([key, raw]) => `${kebabCase(key)}:${String(raw)}`)
    .join(";");
}

function flattenChildren(children: JsxChild[]): JsxChild[] {
  const flattened: JsxChild[] = [];
  children.forEach((child) => {
    if (Array.isArray(child)) {
      flattened.push(...flattenChildren(child));
      return;
    }
    flattened.push(child);
  });
  return flattened;
}

function renderNode(node: unknown): string {
  if (node === null || node === undefined || node === false) {
    return "";
  }

  if (Array.isArray(node)) {
    return flattenChildren(node).map((child) => renderNode(child)).join("");
  }

  if (typeof node === "string" || typeof node === "number") {
    return escapeHtml(String(node));
  }

  throw new Error(
    "review_generated_ui TypeScript prototypes must export an HTML string, JSX tree, or a render() function that returns one.",
  );
}

function renderAttributes(props: Record<string, unknown> | null | undefined): string {
  if (!props) {
    return "";
  }

  const attributes: string[] = [];
  for (const [key, rawValue] of Object.entries(props)) {
    if (
      key === "children" ||
      rawValue === null ||
      rawValue === undefined ||
      rawValue === false
    ) {
      continue;
    }

    if (key === "dangerouslySetInnerHTML") {
      continue;
    }

    const attrName = key === "className" ? "class" : key === "htmlFor" ? "for" : key;
    if (key === "style") {
      const styleValue = renderStyleValue(rawValue);
      if (styleValue) {
        attributes.push(` style="${escapeHtml(styleValue)}"`);
      }
      continue;
    }

    if (rawValue === true) {
      attributes.push(` ${attrName}`);
      continue;
    }

    attributes.push(` ${attrName}="${escapeHtml(String(rawValue))}"`);
  }

  return attributes.join("");
}

function createJsxFactory() {
  const jsx = (
    tag: unknown,
    props: Record<string, unknown> | null,
    ...children: JsxChild[]
  ): string => {
    const flattenedChildren = flattenChildren(children);

    if (tag === FRAGMENT) {
      return flattenedChildren.map((child) => renderNode(child)).join("");
    }

    if (typeof tag === "function") {
      return renderNode(tag({ ...(props ?? {}), children: flattenedChildren }));
    }

    if (typeof tag !== "string") {
      throw new Error("review_generated_ui TypeScript prototypes can only render intrinsic HTML elements or function components.");
    }

    const attributes = renderAttributes(props);
    const innerHtml =
      props && typeof props.dangerouslySetInnerHTML === "object" && props.dangerouslySetInnerHTML !== null
        ? String((props.dangerouslySetInnerHTML as { __html?: unknown }).__html ?? "")
        : flattenedChildren.map((child) => renderNode(child)).join("");

    if (VOID_ELEMENTS.has(tag)) {
      return `<${tag}${attributes}>`;
    }

    return `<${tag}${attributes}>${innerHtml}</${tag}>`;
  };

  return { jsx, fragment: FRAGMENT };
}

function getModuleExport(moduleExports: Record<string, unknown>): unknown {
  if ("default" in moduleExports) {
    return moduleExports.default;
  }

  if (typeof moduleExports.render === "function") {
    return moduleExports.render;
  }

  if (typeof moduleExports.html === "string") {
    return moduleExports.html;
  }

  return moduleExports;
}

function assertNoExternalModules(source: string, sourceType: ReviewSourceType): void {
  const scriptKind = sourceType === "tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    MODULE_FILENAME,
    source,
    ts.ScriptTarget.ES2020,
    true,
    scriptKind,
  );

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      throw new Error(
        "review_generated_ui TypeScript prototypes must be self-contained and cannot use imports. Inline the prototype code and styles in the submitted source.",
      );
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      throw new Error(
        "review_generated_ui TypeScript prototypes cannot re-export from other modules. Inline the prototype code instead.",
      );
    }
  });
}

function renderTypescriptPrototype(source: string, sourceType: ReviewSourceType): string {
  assertNoExternalModules(source, sourceType);

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__reviewJsx",
      jsxFragmentFactory: "__reviewFragment",
      esModuleInterop: true,
    },
    fileName: MODULE_FILENAME,
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics ?? [];
  const errors = diagnostics
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));

  if (errors.length > 0) {
    throw new Error(`review_generated_ui could not transpile the submitted TypeScript: ${errors[0]}`);
  }

  const module = { exports: {} as Record<string, unknown> };
  const { jsx, fragment } = createJsxFactory();
  const context = {
    module,
    exports: module.exports,
    __reviewJsx: jsx,
    __reviewFragment: fragment,
  };

  const script = new vm.Script(transpiled.outputText, { filename: MODULE_FILENAME });
  script.runInNewContext(context, {
    timeout: RENDER_TIMEOUT_MS,
    displayErrors: true,
    contextCodeGeneration: {
      strings: false,
      wasm: false,
    },
  });

  const exported = getModuleExport(module.exports);
  const rendered = typeof exported === "function" ? exported() : exported;

  if (rendered instanceof Promise) {
    throw new Error("review_generated_ui TypeScript prototypes must render synchronously. Export a string, JSX tree, or synchronous render() result.");
  }

  const html = renderNode(rendered).trim();
  if (!html) {
    throw new Error(
      "review_generated_ui TypeScript prototypes rendered an empty result. Export a self-contained HTML document string or JSX tree.",
    );
  }

  return html;
}

function inferInputSource(input: {
  html?: string;
  source?: string;
  sourceType?: ReviewSourceType;
}): { sourceType: ReviewSourceType; source: string } {
  if (input.sourceType) {
    const source = (input.source ?? input.html)?.trim();
    if (!source) {
      throw new Error(`review_generated_ui expected ${input.sourceType} source but no source text was provided.`);
    }
    return { sourceType: input.sourceType, source };
  }

  if (typeof input.html === "string" && input.html.trim()) {
    return { sourceType: "html", source: input.html.trim() };
  }

  if (typeof input.source === "string" && input.source.trim()) {
    throw new Error(
      "review_generated_ui received `source` without `sourceType`. Set sourceType to `html`, `typescript`, or `tsx`.",
    );
  }

  throw new Error("review_generated_ui requires either `html` or a `source` plus `sourceType`.");
}

function prepareOption(input: ReviewOptionInput): PreparedReviewOption {
  const optionId = input.id?.trim();
  const label = input.label?.trim();

  if (!optionId) {
    throw new Error("review_generated_ui option ids must be non-empty strings.");
  }

  if (!label) {
    throw new Error(`review_generated_ui option \"${optionId}\" requires a non-empty label.`);
  }

  const { sourceType, source } = inferInputSource(input);
  const rawHtml = sourceType === "html" ? source : renderTypescriptPrototype(source, sourceType);

  validateReviewHtml(rawHtml);

  return {
    id: optionId,
    label,
    description: input.description?.trim() || undefined,
    html: sanitizeHtml(rawHtml),
    sourceType,
  };
}

export function prepareReviewInput(input: ReviewGeneratedUiInput): PreparedReviewInput {
  if (input.options && (input.html || input.source || input.sourceType)) {
    throw new Error(
      "review_generated_ui received both top-level html/source fields and `options`. Provide either one review artifact or a structured options array, not both.",
    );
  }

  const options = input.options?.length
    ? input.options.map((option) => prepareOption(option))
    : [
        prepareOption({
          id: "default",
          label: "Proposed UI",
          html: input.html,
          source: input.source,
          sourceType: input.sourceType,
        }),
      ];

  const seenIds = new Set<string>();
  for (const option of options) {
    if (seenIds.has(option.id)) {
      throw new Error(`review_generated_ui option ids must be unique. Duplicate id: \"${option.id}\".`);
    }
    seenIds.add(option.id);
  }

  return {
    options,
    defaultOptionId: options[0].id,
    instructions: input.instructions,
    title: input.title,
  };
}