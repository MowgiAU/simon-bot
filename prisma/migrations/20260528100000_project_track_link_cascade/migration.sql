-- Change versionId FK on project_track_links from RESTRICT to CASCADE
-- so that deleting a ProjectVersion (e.g. during project cascade delete) also
-- removes any track links pointing to that version.

ALTER TABLE "project_track_links"
    DROP CONSTRAINT "project_track_links_versionId_fkey";

ALTER TABLE "project_track_links"
    ADD CONSTRAINT "project_track_links_versionId_fkey"
    FOREIGN KEY ("versionId")
    REFERENCES "project_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
