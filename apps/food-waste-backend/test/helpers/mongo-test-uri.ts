/**
 * Resolves the MongoDB connection string for integration suites.
 *
 * There is deliberately no default. Integration specs used to fall back to
 * `mongodb://admin:password123@localhost:27017/...`, which put a working
 * credential in source and, worse, made that credential load-bearing: the
 * compose stack had to keep using `password123` or the suites broke.
 *
 * docker-compose now reads its Mongo credentials from the repository-root
 * `.env`, so they differ per machine and no literal here could be correct.
 * Requiring the variable also matches what jest-integration.config.js already
 * says about this suite: it requires the database rather than skipping when it
 * is absent, because a suite that quietly skips reports green while proving
 * nothing. The same reasoning applies to the credential.
 */
export function requireMongoTestUri(): string {
  const uri = process.env['MONGO_TEST_URI'];

  if (uri === undefined || uri.trim() === '') {
    throw new Error(
      'MONGO_TEST_URI is not set. Integration suites need a live MongoDB replica set.\n' +
        'Start one and point the suite at it, using the credentials from your root .env:\n' +
        '\n' +
        '  docker compose up -d mongodb mongo-init\n' +
        '  MONGO_TEST_URI="mongodb://$MONGO_ROOT_USERNAME:$MONGO_ROOT_PASSWORD@localhost:27017/admin?replicaSet=rs0&directConnection=true" \\n' +
        '    pnpm --filter @foodwaste/backend test:db\n' +
        '\n' +
        'There is no default on purpose - see .env.example.',
    );
  }

  return uri;
}
