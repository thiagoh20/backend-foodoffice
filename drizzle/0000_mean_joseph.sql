DO $$ BEGIN
 CREATE TYPE "role" AS ENUM('user', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" NOT NULL DEFAULT 'user',
	"createdAt" timestamp with time zone NOT NULL DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
	"lastSignedIn" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "users_id" PRIMARY KEY("id"),
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
