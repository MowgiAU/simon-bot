-- Switch include flags default to false (melodics vote will set them)
ALTER TABLE "h2h_matches" ALTER COLUMN "includeBass" SET DEFAULT false;
ALTER TABLE "h2h_matches" ALTER COLUMN "includeMelody" SET DEFAULT false;
ALTER TABLE "h2h_matches" ALTER COLUMN "includeChords" SET DEFAULT false;

-- Per-player melodics vote
ALTER TABLE "h2h_matches" ADD COLUMN "melodicsVoteDeadline" TIMESTAMP(3);
ALTER TABLE "h2h_matches" ADD COLUMN "challengerVoteBass"   BOOLEAN;
ALTER TABLE "h2h_matches" ADD COLUMN "challengerVoteMelody" BOOLEAN;
ALTER TABLE "h2h_matches" ADD COLUMN "challengerVoteChords" BOOLEAN;
ALTER TABLE "h2h_matches" ADD COLUMN "opponentVoteBass"     BOOLEAN;
ALTER TABLE "h2h_matches" ADD COLUMN "opponentVoteMelody"   BOOLEAN;
ALTER TABLE "h2h_matches" ADD COLUMN "opponentVoteChords"   BOOLEAN;
