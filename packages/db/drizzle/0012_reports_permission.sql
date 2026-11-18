-- Custom data migration: the owner's reports permission. New installs get it from the seed; this adds it to existing ones.
INSERT INTO "permission" ("code", "description") VALUES ('reports.read', 'Overdue and collection reports')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "role" r, "permission" p WHERE r."name" = 'root_admin' AND p."code" = 'reports.read'
ON CONFLICT DO NOTHING;
