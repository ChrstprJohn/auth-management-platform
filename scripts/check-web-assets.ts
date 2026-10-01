import { readFile, readdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const assets = new URL(
  '../apps/gotrue-admin-web/dist/assets/',
  import.meta.url,
);
const filenames = (await readdir(assets)).filter((name) =>
  /\.(js|css)$/.test(name),
);
const contents = (
  await Promise.all(
    filenames.map((name) => readFile(new URL(name, assets), 'utf8')),
  )
).join('\n');
const forbiddenImports = [
  'GOTRUE_ADMIN_TOKEN',
  'ADMIN_DATABASE_URL',
  'SESSION_ENCRYPTION_KEY',
  'GoTrueAdminClient',
  'OPERATOR_UUID_ALLOWLIST',
  'GOTRUE_SMTP_PASS',
];
let safe = forbiddenImports.every((marker) => !contents.includes(marker));
for (const path of [
  '../apps/gotrue-admin-api/.env',
  '../infrastructure/local/.env',
]) {
  let source: string;
  try {
    source = await readFile(new URL(path, import.meta.url), 'utf8');
  } catch {
    continue;
  }
  const values = parseEnv(source);
  for (const [name, value] of Object.entries(values)) {
    if (
      /TOKEN|SECRET|ENCRYPTION_KEY|DATABASE_URL|PASSWORD|SMTP_PASS/.test(
        name,
      ) &&
      value !== undefined &&
      value.length >= 16 &&
      contents.includes(value)
    )
      safe = false;
  }
}
console.log(
  safe
    ? 'Frontend asset scan passed: no server-only markers or configured credential values found.'
    : 'Frontend asset scan failed. No matched values displayed.',
);
if (!safe) process.exitCode = 1;
