type Typography = {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
};

type DesignTokens = {
  colors: Record<string, string>;
  typography: Record<string, Typography>;
  spacing: Record<string, string>;
  rounded: Record<string, string>;
  components: Record<string, Record<string, string>>;
};

const TYPOGRAPHY_FIELDS = ["fontFamily", "fontSize", "fontWeight", "lineHeight"] as const;

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function indentOf(line: string): number {
  const match = line.match(/^( *)/);
  return match ? match[1].length : 0;
}

export function parseDesignFrontMatter(markdown: string): DesignTokens {
  const fence = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fence) {
    throw new Error("DESIGN.md is missing YAML front matter.");
  }

  const tokens: DesignTokens = {
    colors: {},
    typography: {},
    spacing: {},
    rounded: {},
    components: {},
  };
  let section = "";
  let block = "";

  for (const line of fence[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const indent = indentOf(line);
    const field = line.trim().match(/^([\w-]+):(.*)$/);
    if (!field) {
      throw new Error(`DESIGN.md has an unreadable line: ${line.trim()}`);
    }
    const key = field[1];
    const raw = unquote(field[2] ?? "");

    if (indent === 0) {
      section = key;
      block = "";
      continue;
    }

    if (indent === 2 && (section === "typography" || section === "components")) {
      block = key;
      if (section === "typography") tokens.typography[block] = {
        fontFamily: "",
        fontSize: "",
        fontWeight: "",
        lineHeight: "",
      };
      if (section === "components") tokens.components[block] = {};
      continue;
    }

    if (indent === 2 && section === "colors") tokens.colors[key] = raw;
    else if (indent === 2 && section === "spacing") tokens.spacing[key] = raw;
    else if (indent === 2 && section === "rounded") tokens.rounded[key] = raw;
    else if (indent === 4 && section === "typography" && block) {
      tokens.typography[block][key as keyof Typography] = raw;
    } else if (indent === 4 && section === "components" && block) {
      tokens.components[block][key] = raw;
    }
  }

  for (const [name, type] of Object.entries(tokens.typography)) {
    for (const field of TYPOGRAPHY_FIELDS) {
      if (!type[field]) {
        throw new Error(`Typography token ${name} is missing ${field}.`);
      }
    }
  }

  return tokens;
}

function cssReference(value: string): string {
  const reference = value.match(/^\{([^}]+)\}$/);
  if (!reference) return value;
  const [group, name] = reference[1].split(".");
  if (!name) throw new Error(`DESIGN.md reference ${value} is incomplete.`);
  if (group === "colors") return `var(--color-${name})`;
  if (group === "rounded") return `var(--radius-${name})`;
  if (group === "spacing") return `var(--${name})`;
  throw new Error(`DESIGN.md reference ${value} cannot be a single CSS variable.`);
}

const COMPONENT_PROPERTIES: Record<string, string> = {
  backgroundColor: "background",
  textColor: "color",
  rounded: "radius",
  padding: "padding",
  height: "height",
  width: "width",
  size: "size",
};

export function designTokensToCss(markdown: string): string {
  const tokens = parseDesignFrontMatter(markdown);
  const lines = [":root {"];

  for (const [name, value] of Object.entries(tokens.colors)) {
    lines.push(`  --color-${name}: ${value};`);
  }
  for (const [name, type] of Object.entries(tokens.typography)) {
    lines.push(`  --font-${name}-family: ${type.fontFamily};`);
    lines.push(`  --font-${name}-size: ${type.fontSize};`);
    lines.push(`  --font-${name}-weight: ${type.fontWeight};`);
    lines.push(`  --font-${name}-line: ${type.lineHeight};`);
  }
  for (const [name, value] of Object.entries(tokens.spacing)) {
    lines.push(`  --${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(tokens.rounded)) {
    lines.push(`  --radius-${name}: ${value};`);
  }

  for (const [name, properties] of Object.entries(tokens.components)) {
    for (const [property, value] of Object.entries(properties)) {
      if (property === "typography") {
        const reference = value.match(/^\{typography\.([\w-]+)\}$/);
        if (!reference) throw new Error(`Component ${name} has an unreadable typography reference.`);
        const typeName = reference[1];
        lines.push(`  --${name}-font-family: var(--font-${typeName}-family);`);
        lines.push(`  --${name}-font-size: var(--font-${typeName}-size);`);
        lines.push(`  --${name}-font-weight: var(--font-${typeName}-weight);`);
        lines.push(`  --${name}-font-line: var(--font-${typeName}-line);`);
        continue;
      }
      const cssName = COMPONENT_PROPERTIES[property];
      if (!cssName) throw new Error(`Component ${name} uses an unknown property ${property}.`);
      lines.push(`  --${name}-${cssName}: ${cssReference(value)};`);
    }
  }

  lines.push("}");
  return lines.join("\n");
}
