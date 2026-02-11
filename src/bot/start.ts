
import { SimonBot } from './index';

// Run the bot
const bot = new SimonBot();

bot.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await bot.shutdown();
  process.exit(0);
});
