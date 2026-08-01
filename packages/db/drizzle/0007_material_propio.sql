--
-- `pgvector` es la extensión que da el tipo `vector(n)` de
-- `content_material_chunks` (tarea 14 de la ola 2: indexado semántico del
-- material propio de la escuela). Va aquí, en la migración que crea la
-- primera tabla que la usa, para que un despliegue desde cero funcione sin
-- ningún paso manual previo. `IF NOT EXISTS` la hace idempotente.
--
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."material_format" AS ENUM('pdf', 'docx', 'mp3', 'wav', 'mp4', 'jpg', 'png');--> statement-breakpoint
CREATE TABLE "content_material_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"chunk_index" smallint NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"content_unit_id" uuid,
	"format" "material_format" NOT NULL,
	"original_filename" text NOT NULL,
	"original_storage_key" text NOT NULL,
	"original_mime_type" text NOT NULL,
	"original_bytes" integer NOT NULL,
	"processed_storage_key" text,
	"processed_mime_type" text,
	"extracted_text" text,
	"indexed_at" timestamp with time zone,
	"uploaded_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_material_chunks" ADD CONSTRAINT "content_material_chunks_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_material_chunks" ADD CONSTRAINT "content_material_chunks_material_id_content_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."content_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_materials" ADD CONSTRAINT "content_materials_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_materials" ADD CONSTRAINT "content_materials_content_unit_id_content_units_id_fk" FOREIGN KEY ("content_unit_id") REFERENCES "public"."content_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_materials" ADD CONSTRAINT "content_materials_uploaded_by_membership_id_memberships_id_fk" FOREIGN KEY ("uploaded_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_material_chunks_material_index_uq" ON "content_material_chunks" USING btree ("material_id","chunk_index");--> statement-breakpoint
CREATE INDEX "content_material_chunks_school_ix" ON "content_material_chunks" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "content_materials_school_ix" ON "content_materials" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "content_materials_unit_ix" ON "content_materials" USING btree ("content_unit_id");