import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);

  const enabled = configService.get<boolean>('swagger.enabled', true);

  if (!enabled) {
    return;
  }

  const title = configService.get<string>(
    'swagger.title',
    'NestJS Boilerplate API',
  );
  const description = configService.get<string>(
    'swagger.description',
    'Production-ready NestJS boilerplate API documentation',
  );
  const version = configService.get<string>('swagger.version', '1.0.0');
  const path = configService.get<string>('swagger.path', 'docs');

  const documentConfig = new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'access-token',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Admin', 'Admin scoped endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
