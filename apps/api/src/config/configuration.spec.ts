import {
  appConfig,
  databaseConfig,
  jwtConfig,
  mediaConfig,
  redisConfig,
} from './configuration';

describe('configuration', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('loads app defaults', () => {
    delete process.env.NODE_ENV;
    delete process.env.API_PORT;
    delete process.env.API_HOST;
    delete process.env.CORS_ORIGIN;
    const cfg = appConfig();
    expect(cfg.port).toBe(3001);
    expect(cfg.host).toBe('0.0.0.0');
    expect(cfg.corsOrigin).toBe('http://localhost:4321');
  });

  it('loads app overrides', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_PORT = '4000';
    process.env.API_HOST = '127.0.0.1';
    process.env.CORS_ORIGIN = 'https://example.com';
    const cfg = appConfig();
    expect(cfg).toMatchObject({
      nodeEnv: 'production',
      port: 4000,
      host: '127.0.0.1',
      corsOrigin: 'https://example.com',
    });
  });

  it('loads database config', () => {
    process.env.DATABASE_HOST = 'db';
    process.env.DATABASE_PORT = '5433';
    process.env.DATABASE_USER = 'u';
    process.env.DATABASE_PASSWORD = 'p';
    process.env.DATABASE_NAME = 'n';
    expect(databaseConfig()).toEqual({
      host: 'db',
      port: 5433,
      username: 'u',
      password: 'p',
      name: 'n',
    });
  });

  it('loads redis defaults', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    expect(redisConfig()).toEqual({ host: 'localhost', port: 6379 });
  });

  it('loads jwt and media configs', () => {
    process.env.JWT_ACCESS_SECRET = 'a';
    process.env.JWT_REFRESH_SECRET = 'b';
    process.env.JWT_ACCESS_EXPIRES_IN = '1m';
    process.env.JWT_REFRESH_EXPIRES_IN = '1d';
    process.env.S3_ENDPOINT = 'e';
    process.env.S3_BUCKET = 'bucket';
    process.env.S3_ACCESS_KEY = 'ak';
    process.env.S3_SECRET_KEY = 'sk';
    process.env.S3_REGION = 'auto';
    process.env.MEDIA_LOCAL_PATH = '/tmp/media';
    expect(jwtConfig().accessSecret).toBe('a');
    expect(mediaConfig().localPath).toBe('/tmp/media');
    expect(mediaConfig().s3Bucket).toBe('bucket');
  });

  it('uses jwt and media defaults when unset', () => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ACCESS_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY;
    delete process.env.S3_SECRET_KEY;
    delete process.env.S3_REGION;
    delete process.env.MEDIA_LOCAL_PATH;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_NAME;
    expect(jwtConfig().accessExpiresIn).toBe('15m');
    expect(mediaConfig().s3Endpoint).toBe('');
    expect(databaseConfig().host).toBe('localhost');
  });
});
