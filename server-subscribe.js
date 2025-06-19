const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require("mongodb");
const platformClient = require('purecloud-platform-client-v2');
const WebSocket = require('ws');
const EventPublisher = require('./EventPublisher');
const CeleryEventPublisher = require('./CeleryEventPublisher');
const cors = require('cors');
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

// Define root topic
const rootTopic = "agent-assist/";
const rootSessionTopic = rootTopic + "session";

// Initialize Express app
const app = express();

// Configure CORS
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Genesys client
const client = platformClient.ApiClient.instance;
client.setEnvironment(config.region);
const notificationsApi = new platformClient.NotificationsApi();
const conversationsApi = new platformClient.ConversationsApi();

// Add global variable for customer connected time
let conversationStartTime = null;

// Add global Set to track sent message IDs
const sentMessageIds = new Set();

// Add reconnection configuration
const MAX_RECONNECT_ATTEMPTS = 3;
let reconnectAttempts = 0;

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
    let heartbeatInterval;
    let reconnectTimeout;

    // Setup heartbeat
    function startHeartbeat() {
      // Clear any existing interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      // Send heartbeat every 30 seconds
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log('Sending heartbeat ping...');
          ws.send(JSON.stringify({ message: 'ping' }));
        }
      }, 30000);
    }

    // Handle reconnection
    async function reconnect() {
      console.log('Attempting to reconnect...');
      try {
        // Check if we've exceeded max attempts
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('Max reconnection attempts reached, giving up...');
          return;
        }

        // Clear any existing timeout
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }

        // Create new notification channel
        const newChannel = await notificationsApi.postNotificationsChannels();
        const newWebsocketUri = newChannel.connectUri;

        // Close existing connection
        ws.close();

        // Create new WebSocket connection
        const newWs = new WebSocket(newWebsocketUri);
        
        // Copy event handlers to new WebSocket
        newWs.on('open', ws.onopen);
        newWs.on('message', ws.onmessage);
        newWs.on('error', ws.onerror);
        newWs.on('close', ws.onclose);

        // Start heartbeat for new connection
        startHeartbeat();

        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
        console.log('Reconnected successfully');
      } catch (error) {
        console.error('Reconnection failed:', error);
        // Increment reconnect attempts
        reconnectAttempts++;
        console.log(`Reconnection attempt ${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS}`);
        // Try again in 5 seconds
        reconnectTimeout = setTimeout(reconnect, 5000);
      }
    }

    ws.on('open', async () => {
      console.log('WebSocket connected. Subscribing...');
      // Subscribe to all messages first, we'll get the specific userId after subscription confirmation
      const topic = `v2.users.${userId}.conversations.messages`;
      await notificationsApi.putNotificationsChannelSubscriptions(channelId, [{ id: topic }]);
      console.log(`Subscribed to topic: ${topic}`);
      
      // Start heartbeat after connection is established
      startHeartbeat();
    });

    ws.on('message', async msg => {
      try {
        const message = JSON.parse(msg);      
        
        // Print non-heartbeat messages
        if (message.topicName !== 'channel.metadata') {
          console.log("========Received message=======");
          console.log(JSON.stringify(message, null, 2));
        }
        
        // Handle heartbeat response
        if (message.topicName === 'channel.metadata') {
          if (message.eventBody?.message === 'pong') {
            console.log('Received heartbeat pong');
          }
          return;
        }

        // Handle WebSocket closing notification
        if (message.topicName === 'v2.system.socket_closing') {
          console.log('Received WebSocket closing notification:', message.eventBody?.message);
          // Start reconnection process
          reconnect();
          return;
        }

        // Handle subscription confirmation and initial setup
        if (message.topicName?.startsWith('v2.users.')) {
          // Get fresh conversation data
          const freshConversation = await conversationsApi.getConversation(conversationId);
          console.log('Fresh conversation data:', JSON.stringify(freshConversation, null, 2));

          // Find customer participant and save connected time
          const customerParticipant = freshConversation.participants.find(p => p.purpose === 'customer');
          if (customerParticipant && customerParticipant.connectedTime) {
            conversationStartTime = customerParticipant.connectedTime;
            console.log('Customer connected time saved:', conversationStartTime);
          }
          
          // Check if this is the earliest moment of conversation
          checkAndHandleConversationStart(customerParticipant, conversationId, rootSessionTopic);

          // Check if conversation has ended
          if (customerParticipant && 
              (customerParticipant.state === 'disconnected' || 
               customerParticipant.state === 'terminated')) {
            sendSessionEndEvent(conversationId, rootTopic + conversationId);
          }

          // Get message history with fresh conversation data
          try {
            let result = await fetchMessageHistory(conversationId, freshConversation);
            console.log('Message history fetched:', result);
          } catch (error) {
            console.error('Error fetching message history:', error);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('error', err => {
      console.error('WebSocket error:', err);
      // Send session ended event on error
      sendSessionEndEvent(conversationId, rootTopic + conversationId);
      
      // Attempt to reconnect on error
      reconnect();
    });

    ws.on('close', () => {
      console.warn('WebSocket connection closed');
      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      
      // Send session ended event on close
      sendSessionEndEvent(conversationId, rootTopic + conversationId);
      
      // Attempt to reconnect
      reconnect();
    });

  } catch (error) {
    console.error('Error in subscribeToConversation:', error);
    throw error;
  }
}

/**
 * Check if this is the earliest moment of conversation and send start event if needed
 * @param {Object} customerParticipant - The customer participant object
 * @param {string} conversationId - The conversation ID
 * @param {string} topic - The topic to publish to
 * @returns {boolean} - True if this is the start of conversation, false otherwise
 */
function checkAndHandleConversationStart(customerParticipant, conversationId, topic) {
  if (customerParticipant && 
      (customerParticipant.state === 'alerting' || 
       customerParticipant.state === 'offering' || 
       customerParticipant.initialState === 'alerting' || 
       customerParticipant.initialState === 'offering')) {
    
    // Send session started event
    const sessionStartEvent = {
      'type': 'session_started',
      'parameters': {
        'session_id': conversationId,
        'customer_ani': customerParticipant.address || 'unknown',
        'customer_name': customerParticipant.name || 'unknown',
        'dnis': customerParticipant.address || 'unknown',
        'direction': customerParticipant.direction || 'unknown',
        'state': customerParticipant.state || 'unknown',
        'initial_state': customerParticipant.initialState || 'unknown',
        'provider': customerParticipant.provider || 'unknown',
        'type': customerParticipant.type || 'unknown'
      },
      'conversationid': conversationId,
      'conversationStartTime': conversationStartTime,
      'conversationEndTime': 'unknown'
    };

    // Print session start event details
    console.log('\n=== Session Start Event to be published ===');
    console.log('Topic:', topic);
    console.log('Event:', JSON.stringify(sessionStartEvent, null, 2));
    console.log('===========================\n');

    // Publish the event
    eventPublisher.publish(topic, JSON.stringify(sessionStartEvent));
    return true;
  }
  return false;
}

/**
 * Get message IDs from conversation participants
 * @param {Object} conversation - The conversation object
 * @returns {Array} Array of message IDs
 */
function getMessageIds(conversation) {
  let messageIds = [];
  conversation.participants.forEach(participant => {
    if (participant.purpose === 'customer') {
      participant.messages[0].messages.forEach(msg => {
        if (msg.messageMetadata.type === 'Text') {
          messageIds.push(msg.messageId);
        }
      });
    }
    if (participant.purpose === 'agent') {
      participant.messages[0].messages.forEach(msg => {
        messageIds.push(msg.messageId);
      });
    }
  });
  return messageIds;
}

/**
 * Fetch message history for a conversation
 * @param {string} conversationId - The conversation ID
 * @param {Object} conversation - The conversation object
 */
async function fetchMessageHistory(conversationId, conversation) {
  try {
    const messageIds = getMessageIds(conversation);
    console.log('Message IDs to fetch:', messageIds);

    const opts = {
      "useNormalizedMessage": true,
      "body": messageIds
    };

    // Get messages in batch and ensure synchronous execution
    const messages = await conversationsApi.postConversationsMessageMessagesBulk(conversationId, opts);
    console.log('Fetched message history:', messages);

    // Filter messages to only include those matching the conversation ID
    const filteredMessages = messages.entities.filter(msg => msg.conversationId === conversationId);
    console.log('Filtered messages for conversation:', conversationId);
    console.log('Filtered message count:', filteredMessages.length);

    // Process each filtered message
    for (const msg of filteredMessages) {
      // Skip if message was already sent
      if (sentMessageIds.has(msg.id)) {
        console.log('Message already sent, skipping:', msg.id);
        continue;
      }

      console.log('\n=== Historical Message ===');
      console.log('Message ID:', msg.id);
      console.log('Conversation ID:', msg.conversationId);
      console.log('Type:', msg.normalizedMessage?.type || 'N/A');
      console.log('Content:', msg.normalizedMessage?.text || 'N/A');
      console.log('Sender:', msg.fromAddress || 'N/A');
      console.log('Timestamp:', msg.timestamp || 'N/A');
      console.log('===========================\n');

      // Publish historical message to Celery
      const event = {
        'type': 'transcription',
        'parameters': {
          'source': msg.direction === 'inbound' ? 'external' : 'internal',
          'text': msg.normalizedMessage?.text || '',
          'seq': msg.id,
          'timestamp': msg.timestamp
        },
        'conversationid': msg.conversationId
      };

      const topic = rootTopic + msg.conversationId + "/transcription";
      
      // Print message details
      console.log('\n=== Historical Message to be published ===');
      console.log('Topic:', topic);
      console.log('Event:', JSON.stringify(event, null, 2));
      console.log('===========================\n');

      eventPublisher.publish(topic, JSON.stringify(event));
      
      // Add message ID to sent set
      sentMessageIds.add(msg.id);
    }

    return filteredMessages;
  } catch (error) {
    console.error('Error fetching message history:', error);
    throw error;
  }
}

/**
 * Send session end event
 * @param {string} conversationId - The conversation ID
 * @param {string} topic - The topic to publish to
 */
function sendSessionEndEvent(conversationId, topic) {
  const sessionEndEvent = {
    'type': 'session_ended',
    'parameters': {
      'session_id': conversationId
    },
      'conversationid': conversationId,
      'conversationStartTime': conversationStartTime,
      'conversationEndTime': new Date().toISOString()
  };

  // Print session end event details
  console.log('\n=== Session End Event to be published ===');
  console.log('Topic:', topic);
  console.log('Event:', JSON.stringify(sessionEndEvent, null, 2));
  console.log('===========================\n');

  // Publish the event
  eventPublisher.publish(topic, JSON.stringify(sessionEndEvent));
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
