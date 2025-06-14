const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require("mongodb");
const platformClient = require('purecloud-platform-client-v2');
require('dotenv').config();

// Configuration from environment variables
const config = {
  clientId: process.env.GENESYS_CLIENT_ID,
  clientSecret: process.env.GENESYS_CLIENT_SECRET,
  region: process.env.GENESYS_REGION,
  mongoUri: process.env.MONGODB_URI,
  webhookUrl: process.env.WEBHOOK_URL || 'https://your-webhook-url.com/conversation-webhook'
};

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Genesys client
const client = platformClient.ApiClient.instance;
client.setEnvironment(config.region);
const conversationsApi = new platformClient.ConversationsApi();
const webhooksApi = new platformClient.WebhooksApi();

/**
 * 注册 Webhook
 * @param {string} conversationId - 会话ID
 */
async function registerWebhook(conversationId) {
  try {
    // 认证
    await client.loginClientCredentialsGrant(config.clientId, config.clientSecret);

    // 创建 webhook 配置
    const webhookConfig = {
      name: `Conversation Webhook - ${conversationId}`,
      url: config.webhookUrl,
      topic: `v2.conversations.${conversationId}.messages`,
      matchingHeaders: {
        'X-Conversation-ID': conversationId
      },
      status: 'active'
    };

    // 注册 webhook
    const webhook = await webhooksApi.postWebhooks(webhookConfig);
    console.log('Webhook registered successfully:', webhook.id);
    return webhook;
  } catch (error) {
    console.error('Error registering webhook:', error);
    throw error;
  }
}

/**
 * Webhook 注册端点
 */
app.post('/register-webhook', async (req, res) => {
  try {
    console.log("Webhook registration request received:", req.body);
    const conversationId = req.body.conversationId;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const webhook = await registerWebhook(conversationId);
    console.log("Successfully registered webhook for conversation:", conversationId);

    res.status(200).json({
      status: 'success',
      message: 'Successfully registered webhook',
      conversationId,
      webhookId: webhook.id
    });
  } catch (error) {
    console.error('Error processing webhook registration:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Webhook 接收端点
 */
app.post('/conversation-webhook', async (req, res) => {
  try {
    console.log("Webhook received:", req.body);
    
    // 验证 webhook 签名（如果需要）
    // const signature = req.headers['x-genesys-signature'];
    // if (!verifyWebhookSignature(signature, req.body)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    // 处理消息
    await handleNewMessage(req.body);

    // 保存到数据库
    await saveMessageToDatabase(req.body);

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * 处理新消息
 * @param {Object} message - 消息对象
 */
async function handleNewMessage(message) {
  try {
    console.log('\n=== New Conversation Message ===');
    console.log('Message ID:', message.id || 'N/A');
    console.log('Conversation ID:', message.conversation?.id || 'N/A');
    console.log('Type:', message.type || 'N/A');
    console.log('Content:', message.text || message.content || 'N/A');
    console.log('Sender:', message.sender?.id || 'N/A');
    console.log('Timestamp:', new Date().toISOString());
    console.log('===========================\n');
  } catch (error) {
    console.error('Error handling message:', error);
    throw error;
  }
}

/**
 * 保存消息到数据库
 * @param {Object} message - 消息对象
 */
async function saveMessageToDatabase(message) {
  const mongoClient = new MongoClient(config.mongoUri);

  try {
    await mongoClient.connect();
    const db = mongoClient.db("testdb");
    const collection = db.collection("MessageCollection");

    const existingDoc = await collection.findOne({
      msgId: message.id,
      conversationId: message.conversation?.id
    });

    if (!existingDoc) {
      await collection.insertOne({
        conversationId: message.conversation?.id,
        msgId: message.id,
        timestamp: new Date(),
        content: message.text || message.content,
        type: message.type,
        sender: message.sender?.id
      });
      console.log('Message saved to database:', message.id);
    }
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}

// 启动服务器
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);
}); 