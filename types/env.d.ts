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

    REDIS_HOST: string;
    REDIS_PORT: string;

    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: string;
  }
}