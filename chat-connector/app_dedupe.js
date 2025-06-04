const platformClient = require("purecloud-platform-client-v2");
const Redis = require("ioredis");
const mongoose = require("mongoose");

// ==== Redis 和 MongoDB 初始化 ====
const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined
});

mongoose.connect(process.env.MONGO_URI);        // Cosmos DB (MongoDB API)

// MongoDB 消息 Schema
const messageSchema = new mongoose.Schema({
  _id: String, // messageId
  conversationId: String,
  from: String,
  text: String,
  timestamp: Date
});
const MessageModel = mongoose.model('Message', messageSchema);

// ==== Genesys Config ====
const client = platformClient.ApiClient.instance;
client.setEnvironment('cac1.pure.cloud');
const clientId = '47046fb7-aaad-45e3-8b38-f4f6f2e49080';
const clientSecret = 'BHgIgBRTbjaaOvDxtWGj-1YcVw4mqxoFSTUWqBWrKBs';
const conversationId = "645dbba6-2baf-4712-bb4c-5e07e1fbc82c";

main();

async function main() {
  try {
    await client.loginClientCredentialsGrant(clientId, clientSecret);
    const api = new platformClient.ConversationsApi();
    const conversation = await api.getConversation(conversationId);
    const messageIds = getMessageIDs(conversation);
    
    const newMessageIds = await filterNewMessageIds(conversationId, messageIds);

    if (newMessageIds.length === 0) {
      console.log("No new messages to process.");
      return;
    }

    const messages = await api.postConversationsMessageMessagesBulk(conversationId, {
      useNormalizedMessage: true,
      body: newMessageIds
    });

    for (const msg of messages.entities) {
      const user = msg.direction === "inbound" ? "Guest" : "Agent";
      const time = convertTimestampToTimeText(msg.timestamp);
      const text = msg.normalizedMessage?.text;

      if (!text) continue;

      console.log(`${user} - ${time}: ${text}`);

      // 保存到 MongoDB
      await MessageModel.create({
        _id: msg.id,
        conversationId,
        from: user,
        text,
        timestamp: msg.timestamp
      });

      // 写入 Redis，防止重复处理
      await redis.sadd(`processed_messages:${conversationId}`, msg.id);
    }

    // 设置 Redis 过期
    await redis.expire(`processed_messages:${conversationId}`, 86400); // 保留一天

  } catch (err) {
    console.error("❌ ERROR:", err);
  }
}

function getMessageIDs(data) {
  const arrmsgs = [];
  data.participants.forEach(participant => {
    if (!participant.messages) return;
    participant.messages[0].messages.forEach(msg => {
      if (msg.messageMetadata?.type === 'Text') {
        arrmsgs.push(msg.messageId);
      }
    });
  });
  return arrmsgs;
}

async function filterNewMessageIds(conversationId, messageIds) {
  const redisKey = `processed_messages:${conversationId}`;
  const results = await Promise.all(messageIds.map(id => redis.sismember(redisKey, id)));
  return messageIds.filter((id, i) => results[i] === 0);
}

function convertTimestampToTimeText(timestamp) {
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}
