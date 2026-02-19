DO $$ BEGIN
 CREATE TYPE "status" AS ENUM('open', 'closed', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE "group_orders" (
	"id" serial NOT NULL,
	"deliveryCost" integer NOT NULL DEFAULT 0,
	"status" "status" NOT NULL DEFAULT 'open',
	"closedAt" timestamp with time zone,
	"createdAt" timestamp with time zone NOT NULL DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "group_orders_id" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial NOT NULL,
	"groupOrderId" integer NOT NULL,
	"userId" integer NOT NULL,
	"productId" integer NOT NULL,
	"quantity" integer NOT NULL,
	"createdAt" timestamp with time zone NOT NULL DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "order_items_id" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" integer NOT NULL,
	"active" integer NOT NULL DEFAULT 1,
	"createdAt" timestamp with time zone NOT NULL DEFAULT now(),
	"updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "products_id" PRIMARY KEY("id")
);
