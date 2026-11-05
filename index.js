
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
} = require("discord.js");

// ====================================
// CHANNEL CONFIGURATION
// ====================================

const SOURCE = process.env.SOURCE_CHANNEL_ID;
const RELEVANT = process.env.RELEVANT_CHANNEL_ID;
const IRRELEVANT = process.env.IRRELEVANT_CHANNEL_ID;

// Only these status codes are irrelevant
// when they occur in a CLICK interface.
const IRRELEVANT_STATUS_PATTERN =
  /\bstatuscode\s*:\s*(403|500)(?!\d)/i;

// ====================================
// CREATE DISCORD CLIENT
// ====================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ====================================
// EXTRACT MESSAGE AND EMBED TEXT
// ====================================

function getMessageText(message) {
  const parts = [message.content];

  for (const embed of message.embeds) {
    parts.push(
      embed.title,
      embed.description,
      embed.author?.name,
      embed.footer?.text
    );

    for (const field of embed.fields) {
      parts.push(field.name, field.value);
    }
  }

  return parts.filter(Boolean).join("\n");
}

// ====================================
// IDENTIFY CLICK INTERFACES
// ====================================

function isClickInterface(message) {

  // First check the iFlow field in embeds.
  const iflowNames = [];

  for (const embed of message.embeds) {
    for (const field of embed.fields) {
      if (/^i\s*flow$/i.test(field.name.trim())) {
        iflowNames.push(field.value);
      }
    }
  }

  // Match CLICK as an underscore-separated
  // interface name segment, e.g.
  // IF_15002_11_X40_CLICK_SIE_SMS_SM...
  const CLICK_SEGMENT = /(?:^|_)CLICK(?:_|$)/i;

  if (iflowNames.length > 0) {
    return iflowNames.some((name) =>
      CLICK_SEGMENT.test(name.trim())
    );
  }

  // Fallback: check interface names in message
  // content or embed titles.
  const text = [
    message.content,
    ...message.embeds.map((embed) => embed.title),
  ].filter(Boolean).join("\n");

  const interfaceNames =
    text.match(/\bIF_[A-Z0-9_-]+/gi) || [];

  return interfaceNames.some((name) =>
    CLICK_SEGMENT.test(name)
  );
}

// ====================================
// COPY ORIGINAL EMBEDS
// ====================================

function copyEmbed(embed) {
  const data = {};

  if (embed.title) {
    data.title = embed.title;
  }

  if (embed.description) {
    data.description = embed.description;
  }

  if (embed.url) {
    data.url = embed.url;
  }

  if (embed.color != null) {
    data.color = embed.color;
  }

  if (embed.fields?.length) {
    data.fields = embed.fields.map((field) => ({
      name: field.name,
      value: field.value,
      inline: field.inline,
    }));
  }

  if (embed.footer?.text) {
    data.footer = {
      text: embed.footer.text,
    };

    if (embed.footer.iconURL) {
      data.footer.icon_url = embed.footer.iconURL;
    }
  }

  if (embed.author?.name) {
    data.author = {
      name: embed.author.name,
    };

    if (embed.author.url) {
      data.author.url = embed.author.url;
    }

    if (embed.author.iconURL) {
      data.author.icon_url = embed.author.iconURL;
    }
  }

  if (embed.thumbnail?.url) {
    data.thumbnail = {
      url: embed.thumbnail.url,
    };
  }

  if (embed.image?.url) {
    data.image = {
      url: embed.image.url,
    };
  }

  if (embed.timestamp) {
    data.timestamp = embed.timestamp;
  }

  return data;
}

// ====================================
// BOT READY
// ====================================

client.once(Events.ClientReady, () => {
  console.log("--------------------------------");
  console.log(`Bot connected as ${client.user.tag}`);
  console.log("Alert Router is running...");
  console.log("--------------------------------");
});

// ====================================
// PROCESS WEBHOOK ALERTS
// ====================================

client.on(Events.MessageCreate, async (message) => {

  // Only monitor the source channel.
  if (message.channelId !== SOURCE) return;

  // Only process webhook-generated messages.
  if (!message.webhookId) return;

  // Extract complete alert text.
  const alertText = getMessageText(message);

  // Identify whether it is a CLICK interface.
  const isClick = isClickInterface(message);

  // Check whether statusCode is 403 or 500.
  const statusMatch =
    alertText.match(IRRELEVANT_STATUS_PATTERN);

  const statusCode = statusMatch
    ? statusMatch[1]
    : null;

  // An alert is irrelevant ONLY when:
  // 1. Interface is CLICK
  // 2. statusCode is 403 or 500
  const isIrrelevant =
    isClick && statusCode !== null;

  // Select destination channel.
  const destinationId = isIrrelevant
    ? IRRELEVANT
    : RELEVANT;

  const category = isIrrelevant
    ? "IRRELEVANT"
    : "RELEVANT";

  try {
    const destinationChannel =
      await client.channels.fetch(destinationId);

    if (
      !destinationChannel?.isTextBased() ||
      typeof destinationChannel.send !== "function"
    ) {
      throw new Error("Invalid destination channel");
    }

    // Copy original rich embeds.
    const embeds = message.embeds
      .filter((embed) =>
        !embed.type || embed.type === "rich"
      )
      .map(copyEmbed)
      .filter((embed) =>
        Object.keys(embed).length > 0
      );

    // Skip messages without supported content.
    if (!message.content && embeds.length === 0) {
      console.log(
        `Skipped unsupported/empty message: ${message.id}`
      );
      return;
    }

    // Forward without additional labels or links.
    await destinationChannel.send({
      content: message.content || undefined,
      embeds,
      allowedMentions: {
        parse: [],
      },
    });

    // Log routing details in terminal only.
    console.log(
      `[${category}] ` +
      `CLICK=${isClick} ` +
      `Status=${statusCode || "Other"} ` +
      `Message=${message.id}`
    );

  } catch (error) {
    console.error(
      `Forwarding error for ${message.id}:`,
      error
    );
  }
});

// ====================================
// VALIDATE ENVIRONMENT
// ====================================

const requiredVariables = [
  "DISCORD_BOT_TOKEN",
  "SOURCE_CHANNEL_ID",
  "RELEVANT_CHANNEL_ID",
  "IRRELEVANT_CHANNEL_ID",
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    console.error(
      `Missing configuration: ${variable}`
    );
    process.exit(1);
  }
}

if (
  new Set([SOURCE, RELEVANT, IRRELEVANT]).size !== 3
) {
  console.error(
    "All three channel IDs must be different."
  );
  process.exit(1);
}

// ====================================
// START BOT
// ====================================

client.login(process.env.DISCORD_BOT_TOKEN)
  .catch((error) => {
    console.error("Bot login failed:", error);
    process.exit(1);
  });
