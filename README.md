# Discord Alert Router

A Discord bot that forwards webhook alerts from a source channel into relevant
and irrelevant channels, preserving message text and rich embeds. CLICK interface
alerts with status codes 403 or 500 go to the irrelevant channel; other alerts go
to the relevant channel.

## Setup

1. Install Node.js 22.12 or newer and run `npm ci`.
2. Copy `.env.example` to `.env` and fill in the bot token and three distinct
   channel IDs. Keep `.env` private.
3. Enable the Message Content intent for the bot in the Discord Developer Portal
   and give it access to read the source channel and send messages and embeds in
   the destination channels.
4. Run `node index.js`.

## Clone on Windows

After authenticating Git with GitHub, run in PowerShell:

```powershell
git clone https://github.com/Piyush-71/discord-alert-router.git D:\discord-alert-router
cd D:\discord-alert-router
npm ci
Copy-Item .env.example .env
```

Fill in `.env` before running `node index.js`. The real `.env` and installed
dependencies are excluded from Git.
