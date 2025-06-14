# Genesys Conversation API

## 本地开发环境设置

1. 安装依赖
```bash
npm install
```

2. 创建环境变量文件
创建 `.env` 文件在项目根目录，并添加以下配置：

```env
# Genesys Cloud Configuration
GENESYS_CLIENT_ID=your_client_id_here
GENESYS_CLIENT_SECRET=your_client_secret_here
GENESYS_REGION=your_region_here

# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string_here

# Server Configuration
PORT=3000
```

3. 运行开发服务器
```bash
npm start
```

## 环境变量说明

- `GENESYS_CLIENT_ID`: Genesys Cloud 客户端 ID
- `GENESYS_CLIENT_SECRET`: Genesys Cloud 客户端密钥
- `GENESYS_REGION`: Genesys Cloud 区域（例如：cac1.pure.cloud）
- `MONGODB_URI`: MongoDB 连接字符串
- `PORT`: 服务器端口号（默认：3000）

## Azure App Service 部署

在 Azure App Service 中，需要在应用程序设置中配置以下环境变量：

- `GENESYS_CLIENT_ID`
- `GENESYS_CLIENT_SECRET`
- `GENESYS_REGION`
- `MONGODB_URI`
- `PORT`

## 注意事项

1. 不要将包含实际凭据的 `.env` 文件提交到版本控制系统
2. 确保 `.env` 文件已添加到 `.gitignore` 中
3. 在团队中共享配置时，使用 `.env.example` 作为模板