import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class InitSchema1720000000000 implements MigrationInterface {
  name = 'InitSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM('ADMIN', 'EDITOR')
    `);
    await queryRunner.query(`
      CREATE TYPE "posts_status_enum" AS ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED')
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'EDITOR',
        "twoFactorSecret" character varying,
        "twoFactorEnabled" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "content" text NOT NULL,
        "summary" text,
        "readingTime" integer NOT NULL DEFAULT 0,
        "status" "posts_status_enum" NOT NULL DEFAULT 'DRAFT',
        "scheduledAt" TIMESTAMPTZ,
        "publishedAt" TIMESTAMPTZ,
        "tags" text array NOT NULL DEFAULT '{}',
        "category" character varying,
        "authorId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_posts_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_posts_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "media" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "url" character varying NOT NULL,
        "key" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "size" bigint NOT NULL,
        "alt" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "content" text NOT NULL,
        "isApproved" boolean NOT NULL DEFAULT false,
        "postId" uuid NOT NULL,
        "authorId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comments_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_author" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "analytics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "views" integer NOT NULL DEFAULT 0,
        "claps" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_analytics_postId" UNIQUE ("postId"),
        CONSTRAINT "PK_analytics" PRIMARY KEY ("id"),
        CONSTRAINT "FK_analytics_post" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "analytics"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "posts_status_enum"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
