const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require("mongodb");

const app = express();
const port = 3000;
const fs = require("fs")

const platformClient = require('purecloud-platform-client-v2');
const WebSocket = require('ws');
const clientId = '47046fb7-aaad-45e3-8b38-f4f6f2e49080';
const clientSecret = 'BHgIgBRTbjaaOvDxtWGj-1YcVw4mqxoFSTUWqBWrKBs';
const region = 'cac1.pure.cloud';
// const conversationId = '645dbba6-2baf-4712-bb4c-5e07e1fbc82c';
const client = platformClient.ApiClient.instance;
client.setEnvironment(region);
const notificationsApi = new platformClient.NotificationsApi();
const conversationsApi = new platformClient.ConversationsApi();
const uri = "mongodb://rx-cosmos-db:nyZR13NoS0nP6H5TvLiVSSwv8Ydn27q3Gtl5OzyljZjWqZV5kvwdMCUvE9aZt7km4YBwnfDnzuwQACDbLIrfoA==@rx-cosmos-db.mongo.cosmos.azure.com:10255/?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@rx-cosmos-db@";


// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 测试接口
app.post('/test', (req, res) => {
  console.log(req.body)
  const { name, age, conversationId } = req.body;

// call notification once receive conversation
  notification(req, res, conversationId)

  console.log("conversationID:" + conversationId)
  // 模拟业务处理
  const response = {
    status: 'success',
    message: '测试接口调用成功',
    data: {
      name,
      age,
      greeting: `你好，${name}！你今年${age}岁了。`,
      timestamp: new Date().toISOString()
    }
  };

});

async function notification(req, res, conversationId) {
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

      // get message once there is new message
      // if (message && message.eventBody) {
      if (true) {
        // console.log('📩 Message event received:', JSON.stringify(message.eventBody, null, 2));
        console.log("========i am here=======")
        loginClient(req, res, ws, conversationId)
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

// login client
function loginClient(req, res, ws, conversationId){
  try {
      client.loginClientCredentialsGrant(clientId, clientSecret)
          .then(loadMsgsIds(req, res, ws, conversationId)).catch((err) => {
              console.log("There was a failure calling login");
              console.error(err);
          })

  } catch (error) {
      console.error(err);
  }
}

function loadMsgsIds(req, res, ws, conversationId) {
    let apiInstance = new platformClient.ConversationsApi();
    apiInstance.getConversation(conversationId)
        .then((data) => {
            console.log(`getConversation success! data: ${JSON.stringify(data, null, 2)}`);
            fs.writeFileSync('./conversationdetails.json', JSON.stringify(data, null, 2));
            fetchMessages(req, res, ws, data, conversationId)
        })
        .catch((err) => {
            console.log("There was a failure calling getConversation");
            console.error(err);
        });
}

function fetchMessages(req, res, ws, data, conversationId) {

    let apiInstance = new platformClient.ConversationsApi();
    let opts = {
        "useNormalizedMessage": true, // Boolean | If true, response removes deprecated fields (textBody, media, stickers)
        "body": getMessageIDS(data)//['86c781a8b6b58e22c8f1af3997e2ffdc','e60df890ec5f5360a4d286738fb41455','bca8dbebe5b94dc66dbd6f96a5c406f3','e3ee072c1449401858821a033619ade4','ff068e507cde52a87b2847f1f203a159',] // [String] | messageIds
    };


    // Get messages in batch
    apiInstance.postConversationsMessageMessagesBulk(conversationId, opts)
        .then((data) => {
          messageCheck(req, res, ws, data)
            
            //console.log(`postConversationsMessageMessagesBulk success! data: ${JSON.stringify(data, null, 2)}`);
        })
        .catch((err) => {
            console.log("There was a failure calling postConversationsMessageMessagesBulk");
            console.error(err);
        });
}

function getMessageIDS(data) {
    let arrmsgs = [];
    data.participants.forEach(participant => {
        if (participant.purpose == 'customer') {

            participant.messages[0].messages.forEach(msg => {
                if (msg.messageMetadata.type == 'Text') {
                    arrmsgs.push(msg.messageId)
                }

            })

        }
        if (participant.purpose == 'agent') {

            participant.messages[0].messages.forEach(msg => {
                arrmsgs.push(msg.messageId)
            })

        }
    })
    return arrmsgs;
}


function convertTimestampToTimeText(timestamp) {
    const date = new Date(timestamp);

    // Extract hours and minutes
    let hours = date.getHours();
    const minutes = date.getMinutes();

    // Determine AM or PM
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // hour 0 should be 12

    // Pad minutes with leading zero if needed
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;

    return `${hours}:${minutesStr} ${ampm}`;
}


async function messageCheck(req, res, ws, message) {
  const client = new MongoClient(uri);
  console.log("🚀 Connecting to CosmosDB Mongo...");
  await client.connect();

  try {
    const db = client.db("testdb");
    const collection = db.collection("MessageCollection");

    // 使用 for...of 循环替代 forEach
    for (const msg of message.entities) {
      console.log("================================");
      console.log(msg);
      
      // 查询文档
      const docs = await collection.find({
        $and: [
          { msgId: msg.id },
          { conversationId: msg.conversationId }
        ]
      }).toArray();
      
      // 如果文档不存在，则插入新文档
      if (docs.length === 0) {
        await collection.insertOne({ 
          conversationId: msg.conversationId, 
          msgId: msg.id 
        });

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(msg);
        ws.close(1000, '正常关闭');
        break;
      }
    }

  } catch (err) {
    console.error("❌ 数据库操作失败:", err);
    res.status(500).json({ error: '内部服务器错误' });
  } finally {
    await client.close();
  }
}


// 启动服务器
app.listen(port, () => {
  console.log(`Server Port ${port}`);
  console.log('Testing Address://localhost:3000/test');
});  
