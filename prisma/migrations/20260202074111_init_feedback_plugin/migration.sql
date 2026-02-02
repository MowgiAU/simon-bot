-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "logChannelId" TEXT,
    "dmUponAction" BOOLEAN NOT NULL DEFAULT true,
    "kickMessage" TEXT,
    "banMessage" TEXT,
    "timeoutMessage" TEXT,

    CONSTRAINT "moderation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_permissions" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "canWarn" BOOLEAN NOT NULL DEFAULT false,
    "canKick" BOOLEAN NOT NULL DEFAULT false,
    "canBan" BOOLEAN NOT NULL DEFAULT false,
    "canTimeout" BOOLEAN NOT NULL DEFAULT false,
    "canPurge" BOOLEAN NOT NULL DEFAULT false,
    "canViewLogs" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "moderation_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "executorId" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "searchableText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_comments" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notes" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "repostEnabled" BOOLEAN NOT NULL DEFAULT true,
    "excludedChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "filter_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_groups" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "replacementText" TEXT,
    "replacementEmoji" TEXT,
    "useEmoji" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_words" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filter_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_stats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "channel_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_stats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "newBans" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "server_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "plugin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_access" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "allowedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "dashboard_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_accounts" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "lastDaily" TIMESTAMP(3),
    "lastWeekly" TIMESTAMP(3),

    CONSTRAINT "economy_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "currencyName" TEXT NOT NULL DEFAULT 'Coins',
    "currencyEmoji" TEXT NOT NULL DEFAULT '🪙',
    "messageReward" INTEGER NOT NULL DEFAULT 5,
    "messageCooldown" INTEGER NOT NULL DEFAULT 60,
    "minMessageLength" INTEGER NOT NULL DEFAULT 10,
    "autoNickname" BOOLEAN NOT NULL DEFAULT false,
    "allowTipping" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "economy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_items" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "metadata" JSONB,
    "stock" INTEGER,
    "maxPerUser" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_inventory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_transactions" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_profiles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "genre" TEXT,
    "daw" TEXT,
    "experience" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_posts" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "threadId" TEXT,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "audioUrl" TEXT,
    "aiScore" INTEGER,
    "aiState" TEXT NOT NULL DEFAULT 'PENDING',
    "aiReason" TEXT,
    "postType" TEXT NOT NULL DEFAULT 'COMMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_settings" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "forumChannelId" TEXT,
    "reviewChannelId" TEXT,
    "currencyReward" INTEGER NOT NULL DEFAULT 1,
    "threadCost" INTEGER NOT NULL DEFAULT 5,
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',

    CONSTRAINT "feedback_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moderation_settings_guildId_key" ON "moderation_settings"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_permissions_settingsId_roleId_key" ON "moderation_permissions"("settingsId", "roleId");

-- CreateIndex
CREATE INDEX "action_logs_guildId_createdAt_idx" ON "action_logs"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "log_comments_logId_idx" ON "log_comments"("logId");

-- CreateIndex
CREATE INDEX "user_notes_guildId_userId_idx" ON "user_notes"("guildId", "userId");

-- CreateIndex
CREATE INDEX "scheduled_tasks_executeAt_idx" ON "scheduled_tasks"("executeAt");

-- CreateIndex
CREATE UNIQUE INDEX "members_guildId_userId_key" ON "members"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "filter_settings_guildId_key" ON "filter_settings"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "word_groups_guildId_name_key" ON "word_groups"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "filter_words_groupId_word_key" ON "filter_words"("groupId", "word");

-- CreateIndex
CREATE UNIQUE INDEX "channel_stats_guildId_channelId_date_key" ON "channel_stats"("guildId", "channelId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "server_stats_guildId_date_key" ON "server_stats"("guildId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_settings_guildId_pluginId_key" ON "plugin_settings"("guildId", "pluginId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_access_guildId_key" ON "dashboard_access"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "economy_accounts_guildId_userId_key" ON "economy_accounts"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "economy_settings_guildId_key" ON "economy_settings"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "economy_items_guildId_name_key" ON "economy_items"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "economy_inventory_guildId_userId_itemId_key" ON "economy_inventory"("guildId", "userId", "itemId");

-- CreateIndex
CREATE INDEX "economy_transactions_guildId_fromUserId_idx" ON "economy_transactions"("guildId", "fromUserId");

-- CreateIndex
CREATE INDEX "economy_transactions_guildId_toUserId_idx" ON "economy_transactions"("guildId", "toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_profiles_guildId_userId_key" ON "feedback_profiles"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_posts_messageId_key" ON "feedback_posts"("messageId");

-- CreateIndex
CREATE INDEX "feedback_posts_guildId_aiState_idx" ON "feedback_posts"("guildId", "aiState");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_settings_guildId_key" ON "feedback_settings"("guildId");

-- AddForeignKey
ALTER TABLE "moderation_settings" ADD CONSTRAINT "moderation_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_permissions" ADD CONSTRAINT "moderation_permissions_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "moderation_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_comments" ADD CONSTRAINT "log_comments_logId_fkey" FOREIGN KEY ("logId") REFERENCES "action_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_settings" ADD CONSTRAINT "filter_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_groups" ADD CONSTRAINT "word_groups_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_groups" ADD CONSTRAINT "word_groups_settings_fkey" FOREIGN KEY ("guildId") REFERENCES "filter_settings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_words" ADD CONSTRAINT "filter_words_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "word_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_stats" ADD CONSTRAINT "channel_stats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_stats" ADD CONSTRAINT "server_stats_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_settings" ADD CONSTRAINT "plugin_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_access" ADD CONSTRAINT "dashboard_access_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_accounts" ADD CONSTRAINT "economy_accounts_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_settings" ADD CONSTRAINT "economy_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_items" ADD CONSTRAINT "economy_items_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_inventory" ADD CONSTRAINT "economy_inventory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy_transactions" ADD CONSTRAINT "economy_transactions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_profiles" ADD CONSTRAINT "feedback_profiles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_profiles" ADD CONSTRAINT "feedback_profiles_guildId_userId_fkey" FOREIGN KEY ("guildId", "userId") REFERENCES "members"("guildId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_posts" ADD CONSTRAINT "feedback_posts_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_settings" ADD CONSTRAINT "feedback_settings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
