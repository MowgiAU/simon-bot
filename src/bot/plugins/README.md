# Plugin System

Simon Bot uses a file-based plugin discovery system. All plugins live in `src/bot/plugins` and must implement the `IPlugin` interface.

## Creating a Plugin

1. Create a `.ts` file in `src/bot/plugins`.
2. Export a class that implements `IPlugin`.
3. The API will automatically detect it based on the `id`, `name`, and `description` properties found in the file source.

### Example

```typescript
import { IPlugin } from '../types/plugin';

export class MyNewPlugin implements IPlugin {
    // These properties are regex-matched by the API for the dashboard list
    id = 'my-new-plugin';
    name = 'My New Plugin';
    description = 'Does amazing things';
    
    version = '1.0.0';
    author = 'You';
    
    // ... logic
}
```

## Dashboard Integration

*   **Discovery**: The dashboard asks `/api/plugins/list`, which scans this folder.
*   **Settings**: Each plugin can have a `configSchema` (Zod) on the backend.
*   **Frontend**: To add a custom settings page in the dashboard, you currently need to add a new route in `dashboard/src/App.tsx` and a corresponding page component, matching the `id`.

## Production Feedback Plugin

This is a core plugin that handles:
1.  **Thread Creation**: Deducts currency.
2.  **Audio Attachments**: Intercepts `mp3/wav` in replies.
3.  **Review Logic**:
    *   Deletes original message.
    *   Reposts audio to a "Review Channel".
    *   Adds "Approve/Deny" buttons.
    *   On Approve: Reposts to original thread via Webhook (to look like the user) with a native audio player.
