-- H2H Arena win streaks
ALTER TABLE "h2h_ratings" ADD COLUMN "winStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "h2h_ratings" ADD COLUMN "bestWinStreak" INTEGER NOT NULL DEFAULT 0;
