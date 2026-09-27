declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';

    PORT: string;
    APP_NAME?: string;
    API_PREFIX?: string;
    API_VERSION?: string;
    
    OBSERVE_APP_KEY: string;
    OBSERVE_APP_SECRET: string;
    OBSERVE_SERVICE_ID: string;

    // DATABASE_HOST: string;
    // DATABASE_PORT: number;
    // DATABASE_NAME: string;
    // DATABASE_USER: string;
    // DATABASE_PASSWORD: string;
    DATABASE_URL: string;

    TWO_FACTOR_ENABLED?: 'true' | 'false';
    TWO_FACTOR_ENCRYPTION_KEY: string;
    TWO_FACTOR_ISSUER?: string;

    CACHE_BACKEND?: 'redis' | 'valkey' | 'memory';
    CACHE_URL: string;
    CACHE_KEY_PREFIX?: string;
    CACHE_DEFAULT_TTL?: string;
    CACHE_EMPTY_TTL?: string;
    CACHE_CONNECT_TIMEOUT?: string;

    JWT_SECRET: string;
    JWT_EXPIRES_IN: number | StringValue;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: number | StringValue;
    
    SWAGGER_ENABLED?: 'true' | 'false';
    SWAGGER_TITLE?: string;
    SWAGGER_DESCRIPTION?: string;
    SWAGGER_VERSION?: string;
    SWAGGER_PATH?: string;
  }
}