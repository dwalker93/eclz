-- Disabling a user now deletes their sessions, and so does every status change. Sessions created before that, for accounts that were disabled earlier, were left in
-- place, so re-enabling such an account would accept its old unexpired token without a new sign-in. Remove them now. Only rows of users that are disabled at this
-- moment are removed; an account re-enabled before this migration cannot be told apart from one that signed in afterwards, so its sessions stay.
DELETE FROM "auth_session" WHERE "user_id" IN (SELECT "id" FROM "user" WHERE "status" = 'disabled');
