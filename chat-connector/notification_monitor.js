const platformClient = require('purecloud-platform-client-v2');
const WebSocket = require('ws');

const clientId = '47046fb7-aaad-45e3-8b38-f4f6f2e49080';
const clientSecret = 'BHgIgBRTbjaaOvDxtWGj-1YcVw4mqxoFSTUWqBWrKBs';
const region = 'cac1.pure.cloud';
const conversationId = '645dbba6-2baf-4712-bb4c-5e07e1fbc82c';

const client = platformClient.ApiClient.instance;
client.setEnvironment(region);

const notificationsApi = new platformClient.NotificationsApi();
const conversationsApi = new platformClient.ConversationsApi();

async function start() {
  try {
    // 登录
    await client.loginClientCredentialsGrant(clientId, clientSecret);

    // 获取 conversation 详情
    const conversation = await conversationsApi.getConversation(conversationId);

    // 提取 agent 的 userId
    const agentParticipant = conversation.participants.find(p => p.purpose === 'agent');
    if (!agentParticipant || !agentParticipant.userId) {
      throw new Error('Agent userId not found in conversation participants.');
    }

    const userId = agentParticipant.userId;
    console.log('👤 Agent userId:', userId);

    // 创建通知通道
    const channel = await notificationsApi.postNotificationsChannels();
    const channelId = channel.id;
    const websocketUri = channel.connectUri;

    // 创建 WebSocket 连接
    const ws = new WebSocket(websocketUri);

    ws.on('open', async () => {
      console.log('✅ WebSocket connected. Subscribing...');

      // 构造订阅主题
      const topic = `v2.users.${userId}.conversations.messages`;

      // 订阅
      await notificationsApi.putNotificationsChannelSubscriptions(channelId, [{ id: topic }]);
      console.log(`🔔 Subscribed to topic: ${topic}`);
    });

    ws.on('message', msg => {
      const message = JSON.parse(msg);
      if (message && message.eventBody) {
        console.log('📩 Message event received:', JSON.stringify(message.eventBody, null, 2));
      }
    });

    ws.on('error', err => {
      console.error('❌ WebSocket error:', err);
    });

    ws.on('close', () => {
      console.warn('⚠️ WebSocket closed.');
    });

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

start();
