export function writeEnvValue(
  environment: string,
  key: string,
  value: string,
): string {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n]/.test(value))
    throw new Error('Invalid environment setting');
  const newline = environment.includes('\r\n') ? '\r\n' : '\n';
  const assignment = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
  let written = false;
  const lines = environment
    .split(/\r?\n/)
    .filter((line) => {
      if (!assignment.test(line)) return true;
      if (written) return false;
      written = true;
      return true;
    })
    .map((line) => (assignment.test(line) ? `${key}=${value}` : line));
  if (!written) {
    if (lines.at(-1) === '') lines.pop();
    lines.push(`${key}=${value}`, '');
  }
  return lines.join(newline);
}
