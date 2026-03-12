import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: { id: string; username: string; discriminator: string; avatar: string | null };
    guilds?: { id: string; name: string; icon?: string }[];
    mutualAdminGuilds?: { id: string; name: string; icon?: string }[];
  }
}
