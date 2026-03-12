import 'express-session';

export interface SessionUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    guilds?: { id: string; name: string; icon?: string }[];
    mutualAdminGuilds?: { id: string; name: string; icon?: string }[];
  }
}
