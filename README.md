# Genesys Chat Message Subscription Service

A simple Node.js service for subscribing to Genesys Cloud chat conversation messages and forwarding them to Celery task queue.

## Features

- 🔄 **Chat Message Subscription**: Subscribe to chat conversation messages via Genesys Notifications API
- 🚫 **Audio Conversation Filtering**: Automatically identify and skip audio conversations (text chat only)
- 📤 **Message Forwarding**: Forward chat messages to Celery task queue for processing
- 🔄 **Auto Reconnection**: Automatic reconnection when WebSocket connection is lost
- 📝 **Detailed Logging**: Structured logging using Pino

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Genesys Cloud │───▶│  Chat Message    │───▶│   Celery Task   │
│   (Chat API)    │    │  Subscription    │    │    Queue        │
│                 │    │     Service      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables Configuration
Create a `.env` file in the project root directory:

```env
# Genesys Cloud Configuration
GENESYS_CLIENT_ID=your_client_id_here
GENESYS_CLIENT_SECRET=your_client_secret_here
GENESYS_REGION=your_region_here

# Celery Configuration
AAN_AMQP_URI=amqp://username:password@host:port
REDIS_PASSWORD=your_redis_password

# Server Configuration
PORT=3000
LOG_LEVEL=info
```

### 3. Run Development Server
```bash
# Production mode
npm start

# Development mode (auto-restart)
npm run dev
```

## API Endpoints

### POST /subscribe-conversation
Subscribe to messages from a specific conversation

**Request Body:**
```json
{
  "conversationId": "conversation-uuid-here"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Successfully subscribed to conversation",
  "conversationId": "conversation-uuid-here"
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GENESYS_CLIENT_ID` | Genesys Cloud client ID | ✅ |
| `GENESYS_CLIENT_SECRET` | Genesys Cloud client secret | ✅ |
| `GENESYS_REGION` | Genesys Cloud region (e.g., cac1.pure.cloud) | ✅ |
| `AAN_AMQP_URI` | RabbitMQ connection string | ✅ |
| `REDIS_PASSWORD` | Redis password | ✅ |
| `PORT` | Server port number | ❌ (default: 3000) |
| `LOG_LEVEL` | Log level | ❌ (default: info) |

## Docker Deployment

### Build Image
```bash
docker build -t genesys-chat-service .
```

### Run Container
```bash
docker run -p 3000:3000 \
  -e GENESYS_CLIENT_ID=your_id \
  -e GENESYS_CLIENT_SECRET=your_secret \
  -e GENESYS_REGION=your_region \
  -e AAN_AMQP_URI=your_amqp_uri \
  -e REDIS_PASSWORD=your_redis_password \
  genesys-chat-service
```

## Azure App Service Deployment

Configure the following environment variables in Azure App Service application settings:

- `GENESYS_CLIENT_ID`
- `GENESYS_CLIENT_SECRET`
- `GENESYS_REGION`
- `AAN_AMQP_URI`
- `REDIS_PASSWORD`
- `PORT` (optional)
- `LOG_LEVEL` (optional)

## Important Notes

1. **Security**: Do not commit `.env` files containing actual credentials to version control
2. **Audio Conversations**: The system automatically identifies and skips audio conversations, processing only text chat messages
3. **Reconnection**: WebSocket connections automatically reconnect when disconnected, with a maximum of 3 retry attempts
4. **Logging**: Uses structured logging for easy monitoring and debugging

## Troubleshooting

### Common Issues

1. **Connection Failure**: Check Genesys credentials and region configuration
2. **Messages Not Forwarded**: Check Celery and Redis connection configuration
3. **Audio Conversations Skipped**: This is normal behavior, the system only processes text chats

### Log Viewing
```bash
# View real-time logs
tail -f logs/app.log

# View error logs
grep "ERROR" logs/app.log
```

## Author

**Zheng Li** - zhenglip@cn.ibm.com