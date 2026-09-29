declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';

    PORT: string;
    APP_NAME?: string;
    API_PREFIX?: string;
    API_VERSION?: string;

    OBSERVE_APP_KEY?: string;
    OBSERVE_APP_SECRET?: string;
    OBSERVE_SERVICE_ID?: string;

    // DATABASE_HOST: string;
    // DATABASE_PORT: number;
    // DATABASE_NAME: string;
    // DATABASE_USER: string;
    // DATABASE_PASSWORD: string;
    DATABASE_URL: string;
    DATABASE_SSL?: 'true' | 'false';
    DATABASE_SCHEMA?: string;

    TWO_FACTOR_ENABLED?: 'true' | 'false';
    TWO_FACTOR_ENCRYPTION_KEY?: string;
    TWO_FACTOR_ISSUER?: string;

    CACHE_BACKEND?: 'redis' | 'valkey' | 'memory';
    CACHE_URL?: string;
    CACHE_KEY_PREFIX?: string;
    CACHE_DEFAULT_TTL?: string;
    CACHE_EMPTY_TTL?: string;
    CACHE_CONNECT_TIMEOUT?: string;

    SECURITY_ENABLED?: string;
    SECURITY_CONTENT_SECURITY_POLICY?: string;
    SECURITY_HSTS_MAX_AGE?: string;
    SECURITY_REFERRER_POLICY?: string;

    CORS_ORIGINS?: string;
    CORS_CREDENTIALS?: string;
    CORS_MAX_AGE?: string;

    THROTTLE_TTL?: string;
    THROTTLE_LIMIT?: string;
    THROTTLE_BLOCK_DURATION?: string;

    // Mail. Every provider package is optional, so only the transport choice and
    // the from address matter to the app; the credentials belong to whichever
    // provider is selected.
    MAIL_TRANSPORT?: 'memory' | 'smtp' | 'ses' | 'sendgrid';
    MAIL_FROM?: string;
    MAIL_FROM_NAME?: string;
    MAIL_REPLY_TO?: string;
    MAIL_SUBJECT_PREFIX?: string;
    MAIL_SMTP_HOST?: string;
    MAIL_SMTP_PORT?: string;
    MAIL_SMTP_SECURE?: 'true' | 'false';
    MAIL_SMTP_USER?: string;
    MAIL_SMTP_PASSWORD?: string;
    MAIL_SENDGRID_API_KEY?: string;
    MAIL_SES_REGION?: string;
    MAIL_CONNECTION_TIMEOUT?: string;
    MAIL_SOCKET_TIMEOUT?: string;

    // Notifications. No channel needs a package, so these are pure
    // configuration. A channel that is off does not need its credentials.
    NOTIFICATION_ENABLED?: 'true' | 'false';
    NOTIFICATION_CONSOLE_ENABLED?: 'true' | 'false';
    NOTIFICATION_TIMEOUT?: string;
    NOTIFICATION_RETRIES?: string;
    NOTIFICATION_RETRY_DELAY?: string;
    NOTIFICATION_THROW_ON_FAILURE?: 'true' | 'false';
    TELEGRAM_ENABLED?: 'true' | 'false';
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    TELEGRAM_TOPIC_ID?: string;
    SLACK_ENABLED?: 'true' | 'false';
    SLACK_WEBHOOK_URL?: string;
    SLACK_CHANNEL?: string;
    DISCORD_ENABLED?: 'true' | 'false';
    DISCORD_WEBHOOK_URL?: string;
    DISCORD_CHANNEL?: string;

    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;

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
