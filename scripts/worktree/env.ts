export function rewriteEnvLine(content: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, 'gm');
  if (re.test(content)) {
    return content.replace(re, `${key}=${value}`);
  }
  const sep = content.endsWith('\n') ? '' : '\n';
  return content + sep + `${key}=${value}\n`;
}

export function buildWorktreeEnv(
  rootEnv: string,
  worktreeName: string,
  dbName: string,
  ports: { app: number; api: number; sites: number },
): string {
  // Parse root DATABASE_URL to build isolated URL
  const dbMatch = rootEnv.match(/^DATABASE_URL=(.+)$/m);
  if (!dbMatch) throw new Error('DATABASE_URL not found in root .env');
  const parsed = dbMatch[1].match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!parsed) throw new Error('Invalid DATABASE_URL in root .env');
  const [, user, password, host, port] = parsed;
  const isolatedUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;
  const appUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}_app`;

  let env = rootEnv;
  env = rewriteEnvLine(env, 'DATABASE_URL', isolatedUrl);
  env = rewriteEnvLine(env, 'DATABASE_URL_APP', appUrl);
  env = rewriteEnvLine(env, 'BETTER_AUTH_URL', `http://localhost:${ports.api}/api/v1/auth`);
  env = rewriteEnvLine(env, 'BETTER_AUTH_TRUSTED_ORIGINS', `http://localhost:${ports.app}`);
  env = rewriteEnvLine(env, 'API_URL', `http://localhost:${ports.api}`);
  return env;
}
