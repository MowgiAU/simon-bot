import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user: any;
    guilds: any[];
    mutualAdminGuilds: any[];
  }
}
