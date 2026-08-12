export interface SpeakerCsvRow {
  name: string;
  email: string;
  bio: string | null;
  company: string | null;
  title: string | null;
}

function cells(line: string): string[] {
  const out: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { out.push(value.trim()); value = ""; }
    else value += char;
  }
  out.push(value.trim());
  return out;
}

export function parseSpeakerCsv(csv: string): SpeakerCsvRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV must include a header and at least one speaker.");
  const headers = cells(lines[0] ?? "").map((header) => header.toLowerCase().replace(/[^a-z]/g, ""));
  const indexOf = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const nameIndex = indexOf(["name", "fullname", "speakername"]);
  const emailIndex = indexOf(["email", "emailaddress"]);
  if (nameIndex < 0 || emailIndex < 0) throw new Error("CSV needs Name and Email columns.");
  const bioIndex = indexOf(["bio", "biography"]);
  const companyIndex = indexOf(["company", "organization", "organisation"]);
  const titleIndex = indexOf(["title", "role", "jobtitle"]);
  const seen = new Set<string>();
  return lines.slice(1).map((line, rowIndex) => {
    const row = cells(line);
    const name = row[nameIndex]?.trim() ?? "";
    const email = (row[emailIndex]?.trim() ?? "").toLowerCase();
    if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error(`Row ${rowIndex + 2} needs a valid name and email.`);
    }
    if (seen.has(email)) throw new Error(`Row ${rowIndex + 2} duplicates ${email}.`);
    seen.add(email);
    const optional = (index: number) => index >= 0 && row[index]?.trim() ? row[index].trim() : null;
    return { name, email, bio: optional(bioIndex), company: optional(companyIndex), title: optional(titleIndex) };
  });
}
