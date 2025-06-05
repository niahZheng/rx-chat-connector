import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

# 加载 .env 文件
load_dotenv()

class Config:
    # Azure Service Bus 配置
    ASB_CONNECTION_STRING = os.getenv("ASB_CONNECTION_STRING")
    print(f"ASB_CONNECTION_STRING: {ASB_CONNECTION_STRING}")
    ASB_QUEUE_NAME = os.getenv("ASB_QUEUE_NAME", "celery-demo-queue")
    
    # 验证连接字符串是否存在
    if not ASB_CONNECTION_STRING:
        raise ValueError("ASB_CONNECTION_STRING 未在 .env 文件中设置")
    
    # 正确格式的 broker URL
    CELERY_BROKER_URL = f"azureservicebus://?{quote_plus(ASB_CONNECTION_STRING)}"
    
    # 传输选项
    CELERY_BROKER_TRANSPORT_OPTIONS = {
        "queue_name": ASB_QUEUE_NAME,
        "visibility_timeout": 300,  # 5分钟
        "wait_time_seconds": 10,    # 长轮询间隔
    }
    
    # 结果后端（可选）
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", None)
    
    @classmethod
    def validate(cls):
        """验证配置是否完整"""
        if not cls.ASB_CONNECTION_STRING:
            raise ValueError("ASB_CONNECTION_STRING 未在 .env 文件中设置")
        
        # 验证传输是否可用
        try:
            from kombu.transport import TRANSPORT_ALIASES
            if "azureservicebus" not in TRANSPORT_ALIASES:
                raise RuntimeError("Kombu 未安装 Azure Service Bus 传输支持")
        except ImportError:
            pass
            
        print("✅ 配置验证通过")

# 启动时验证配置
Config.validate()