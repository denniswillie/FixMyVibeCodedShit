export interface ParsedAwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === "\"") {
      const nextCharacter = line[index + 1];

      if (insideQuotes && nextCharacter === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseIniCredentialsFile(rawContent: string) {
  const sections = new Map<string, Record<string, string>>();
  let activeSection = "default";

  for (const rawLine of rawContent.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

    const sectionMatch = line.match(/^\[(.+)\]$/);

    if (sectionMatch) {
      activeSection = sectionMatch[1].trim();
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    const currentSection = sections.get(activeSection) || {};
    currentSection[key] = value;
    sections.set(activeSection, currentSection);
  }

  const preferredSection = sections.get("default") || sections.values().next().value;

  if (!preferredSection) {
    return null;
  }

  const accessKeyId = String(preferredSection.aws_access_key_id || "").trim();
  const secretAccessKey = String(preferredSection.aws_secret_access_key || "").trim();

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: String(preferredSection.aws_session_token || "").trim(),
  };
}

function parseCsvCredentialsFile(rawContent: string) {
  const lines = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  const row = parseCsvLine(lines[1]);
  const accessKeyIndex = header.findIndex((value) => value === "access key id");
  const secretKeyIndex = header.findIndex((value) => value === "secret access key");
  const sessionTokenIndex = header.findIndex((value) => value === "session token");

  if (accessKeyIndex === -1 || secretKeyIndex === -1) {
    return null;
  }

  const accessKeyId = String(row[accessKeyIndex] || "").trim();
  const secretAccessKey = String(row[secretKeyIndex] || "").trim();

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: sessionTokenIndex === -1 ? "" : String(row[sessionTokenIndex] || "").trim(),
  };
}

export function parseAwsCredentialsFile(rawContent: string): ParsedAwsCredentials {
  const normalizedContent = String(rawContent || "").trim();

  if (!normalizedContent) {
    throw new Error("Upload an AWS credentials file with an access key and secret key.");
  }

  const parsed =
    parseIniCredentialsFile(normalizedContent) ||
    parseCsvCredentialsFile(normalizedContent);

  if (!parsed) {
    throw new Error(
      "Could not parse that file. Upload an AWS CLI credentials file or the IAM access key CSV."
    );
  }

  return parsed;
}
