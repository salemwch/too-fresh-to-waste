import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreDependencies: [
    '@types/multer', // Ambient Express.Multer.File types — no direct import
    'mongodb', // Used in seed scripts via require('mongodb').MongoClient
    'express-rate-limit', // Used in payment-security.middleware.ts
    'joi', // Used in env.validation.ts for config validation
  ],
  entry: [
    'src/main.ts',
    'src/app.module.ts',
    'src/**/*.module.ts',
    'src/**/*.controller.ts',
    'src/**/*.service.ts',
    'src/**/*.guard.ts',
    'src/**/*.interceptor.ts',
    'src/**/*.middleware.ts',
    'src/**/*.decorator.ts',
    'src/**/*.schema.ts',
    'src/**/*.strategie.ts',
    'src/**/*.processor.ts',
    'src/**/*.listener.ts',
    'src/**/*.filter.ts',
    'src/**/*.task.ts',
    'src/**/*.presenter.ts',
    'src/**/*.mapper.ts',
    'src/**/*.adapter.ts',
    'src/**/*.util.ts',
    'src/**/*.constant.ts',
    'src/**/*.constants.ts',
    'src/**/*.config.ts',
    'src/**/*.interface.ts',
    'src/**/*.events.ts',
    'src/**/*.types.ts',
    'src/seeds/**/*.ts',
  ],
  project: ['src/**/*.ts'],
  jest: {
    config: ['jest.config.js'],
    entry: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'test/**/*.ts'],
  },
};

export default config;
