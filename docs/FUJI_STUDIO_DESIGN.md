# Fuji Studio: Cloud-Based Sample Manager (Architectural Design)

## 1. Core Architecture Strategy
To protect the main 50k-user community, we will use a **"Storage Guild"** pattern. All sample audio (WAV/MP3) and descriptive metadata will be hosted on a separate, private Discord server.

### Recommended Tech Stack
- **Frontend**: React 18 + Vite (Existing Dashboard Integration)
- **Backend**: Node.js + Express (Existing API) + **Socket.io** (for Real-time Sync/Indexing)
- **Database**: Prisma + PostgreSQL (for Metadata indexing and User collections)
- **Proxy**: Node.js Stream-through (to bypass Discord CORS and hide source URLs)

---

## 2. Feature Implementation Outlines

### A. Sample Libraries & Collections
Users can organize samples into "Collections" (Folders).
- **Metadata**: Each sample indexed by the bot stores: `Filename`, `Size`, `Duration`, `BPM` (inferred), and `Key`.
- **User Collections**: Since samples are on Discord, users can "Save" samples to their personal library which just creates a reference in our PostgreSQL.
- **Identification**: Samples are tagged with metadata (Discord Attachment ID).

### B. The "Scanner" (Sample Indexing)
A Background Worker (part of the Bot) monitors specific "Sample Drop" channels on the secondary server.
1. **Event**: User drops a `.wav` in Discord.
2. **Indexing**: Bot extracts: `Filename`, `Size`, `Duration` (via metadata parser), and `Attachment ID`.
3. **Storage**: Key metadata is stored in our PostgreSQL `Sample` table for instant global searching (much faster than searching Discord).

### C. Audio Proxying & Link Refreshing
Discord's `cdn.discordapp.com` links now expire (Signature headers).
1. **The Proxy Endpoint**: UI calls `GET /api/fuji/stream/:attachmentId`.
2. **Signature Refresh**: The API uses the Bot to fetch the latest `url` for that `attachmentId` via the Discord REST API.
3. **CORS Bypass**: The API fetches the audio buffer from Discord and pipes it directly to the browser: 
   `axios.get(discordUrl, { responseType: 'stream' }).then(res => res.data.pipe(expressRes))`.

### D. Real-time Search & Cursors
Using **Socket.io**, we can show who is currently browsing the same packs:
- **Active Browsers**: See who else is "previewing" from a library in real-time.

---

## 3. Proposed API Structure

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/fuji/libraries` | `GET` | List all indexed sample libraries/channels. |
| `/api/fuji/samples/search`| `GET` | Search the PostgreSQL index of samples (fast). |
| `/api/fuji/samples/:id` | `GET` | Get detailed metadata for a specific sample. |
| `/api/fuji/stream/:id` | `GET` | The authenticated proxy that refreshes links and pipes audio. |
| `/api/fuji/collections` | `POST` | Create a user-specific folder for organizing samples. |

---

## 4. Next Steps
1. **Database Schema**: Update `schema.prisma` to include `Project` and `SampleIndex` models.
2. **Socket Setup**: Initialize Socket.io in the Express server.
3. **Storage Guild**: Setup a dedicated Discord server and get its IDs for the `.env`.

Shall we start by defining the **Database Schema** for the projects and samples?
