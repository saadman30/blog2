import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|test)\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/tracing.ts',
    '!src/app.module.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.enum.ts',
    '!src/**/*.port.ts',
    '!src/**/*.model.ts',
    '!src/**/*.types.ts',
    '!src/domain/**',
    '!src/database/entities/index.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
    '!src/config/typeorm.data-source.ts',
    '!src/common/metrics/metrics.providers.ts',
    '!src/common/metrics/metrics.constants.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

export default config;
