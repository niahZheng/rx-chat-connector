from celery import Celery
from config import Config
import logging

# 创建 Celery 应用
app = Celery(
    'asb_demo',
    broker=Config.CELERY_BROKER_URL,
    broker_transport_options=Config.CELERY_BROKER_TRANSPORT_OPTIONS,
    result_backend=Config.CELERY_RESULT_BACKEND,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
)

# 覆盖连接URI生成方法，避免错误
@app.on_after_configure.connect
def fix_connection_uri(sender, **kwargs):
    """修复ASB连接URI的显示问题"""
    from kombu import Connection
    from kombu.transport.azureservicebus import Transport
    
    # 修复as_uri方法
    def safe_as_uri(self, *args, **kwargs):
        return "azureservicebus://<connection-string-hidden>"
    
    # 应用补丁
    Transport.as_uri = safe_as_uri
    
    # 验证连接
    try:
        with Connection(app.conf.broker_url) as conn:
            conn.connect()
            logging.info("✅ ASB 连接验证成功")
    except Exception as e:
        logging.error(f"❌ ASB 连接失败: {str(e)}")
        raise

# 配置应用
app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
)

# 测试任务
@app.task
def test_connection():
    return {"status": "success", "message": "Connected to Azure Service Bus"}