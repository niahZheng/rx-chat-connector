const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require("mongodb");
const platformClient = require('purecloud-platform-client-v2');
const WebSocket = require('ws');
const EventPublisher = require('./EventPublisher');
const CeleryEventPublisher = require('./CeleryEventPublisher');
require('dotenv').config();

// Configuration from environment variables
const config = {
  clientId: process.env.GENESYS_CLIENT_ID,
  clientSecret: process.env.GENESYS_CLIENT_SECRET,
  region: process.env.GENESYS_REGION,
  mongoUri: process.env.MONGODB_URI
};

// Initialize event publisher
const eventPublisher = new CeleryEventPublisher();

// Initialize Express app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Genesys client
const client = platformClient.ApiClient.instance;
client.setEnvironment(config.region);
const notificationsApi = new platformClient.NotificationsApi();
const conversationsApi = new platformClient.ConversationsApi();

/**
 * 订阅会话消息的端点
 * 用于初始化 WebSocket 连接并订阅特定会话的消息
 */
app.post('/subscribe-conversation', async (req, res) => {
  try {
    console.log("Subscription request received:", req.body);
    const conversationId = req.body.conversationId;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    await subscribeToConversation(conversationId);
    console.log("Successfully subscribed to conversation:", conversationId);

    res.status(200).json({
      status: 'success',
      message: 'Successfully subscribed to conversation',
      conversationId
    });
  } catch (error) {
    console.error('Error processing subscription request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Subscribe to conversation notifications and handle messages
 * @param {string} conversationId - The ID of the conversation to subscribe to
 */
async function subscribeToConversation(conversationId) {
  try {
    // Authenticate with Genesys
    await client.loginClientCredentialsGrant(config.clientId, config.clientSecret);

    // Get conversation details
    const conversation = await conversationsApi.getConversation(conversationId);
    const agentParticipant = conversation.participants.find(p => p.purpose === 'agent');

    if (!agentParticipant?.userId) {
      throw new Error('Agent userId not found in conversation participants');
    }

    const userId = agentParticipant.userId;
    console.log('Agent userId:', userId);

    // Create notification channel
    const channel = await notificationsApi.postNotificationsChannels();
    const channelId = channel.id;
    const websocketUri = channel.connectUri;

    // Initialize WebSocket connection
    const ws = new WebSocket(websocketUri);

    ws.on('open', async () => {
      console.log('WebSocket connected. Subscribing...');
      const topic = `v2.users.${userId}.conversations.messages`;
      await notificationsApi.putNotificationsChannelSubscriptions(channelId, [{ id: topic }]);
      console.log(`Subscribed to topic: ${topic}`);
    });

    ws.on('message', async msg => {
      try {
        const message = JSON.parse(msg);
        if (message?.eventBody) {
          await handleNewMessage(message);
          // await saveMessageToDatabase(message, conversationId);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('error', err => {
      console.error('WebSocket error:', err);
    });

    ws.on('close', () => {
      console.warn('WebSocket connection closed');
    });

  } catch (error) {
    console.error('Error in subscribeToConversation:', error);
    throw error;
  }
}

/**
 * Handle new message from conversation and output to terminal
 * @param {Object} message - The message object
 */
async function handleNewMessage(message) {
  try {
    // Handle heartbeat messages
    if (message.topicName === 'channel.metadata') {
      console.log('\n=== WebSocket Heartbeat ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('===========================\n');
      return;
    }

    // Handle conversation messages
    if (message.topicName?.startsWith('v2.users.')) {
      console.log('\n=== New Conversation Message ===');
      console.log('Topic:', message.topicName);

      if (message.eventBody) {
        const msg = message.eventBody;
        console.log('Message ID:', msg.id || 'N/A');
        console.log('Conversation ID:', msg.conversation?.id || 'N/A');
        console.log('Type:', msg.type || 'N/A');
        console.log('Content:', msg.text || msg.content || 'N/A');
        console.log('Sender:', msg.sender?.id || 'N/A');
        console.log('Timestamp:', new Date().toISOString());

        // Publish message to Celery
        const topic = `genesys/conversation/${msg.conversation?.id || 'unknown'}`;
        const messageData = {
          type: 'conversation_message',
          parameters: {
            message_id: msg.id,
            conversation_id: msg.conversation?.id,
            message_type: msg.type,
            content: msg.text || msg.content,
            sender_id: msg.sender?.id,
            timestamp: new Date().toISOString()
          }
        };

        eventPublisher.publish(topic, JSON.stringify(messageData));
      }
      console.log('===========================\n');
      return;
    }

    // Handle other types of messages
    console.log('\n=== Other Message Type ===');
    console.log('Topic:', message.topicName || 'N/A');
    console.log('Raw Message:', JSON.stringify(message, null, 2));
    console.log('Timestamp:', new Date().toISOString());
    console.log('===========================\n');

  } catch (error) {
    console.error('Error handling message:', error);
    throw error;
  }
}

/**
 * Save message to database
 * @param {Object} message - The message object
 * @param {string} conversationId - The conversation ID
 */
async function saveMessageToDatabase(message, conversationId) {
  const mongoClient = new MongoClient(config.mongoUri);

  try {
    await mongoClient.connect();
    const db = mongoClient.db("testdb");
    const collection = db.collection("MessageCollection");

    const msg = message.eventBody;
    const existingDoc = await collection.findOne({
      msgId: msg.id,
      conversationId: msg.conversationId
    });

    if (!existingDoc) {
      await collection.insertOne({
        conversationId: msg.conversationId,
        msgId: msg.id,
        timestamp: new Date()
      });
      console.log('Message saved to database:', msg.id);
    }

  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}

// Start server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    eventPublisher.destroy();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    eventPublisher.destroy();
    process.exit(0);
  });
});  
