import sys
from celery_app import app
import os
sys.path.append(os.path.abspath(__file__))
print(os.path.abspath(__file__))

if __name__ == '__main__':
    # 打印配置信息
    print("=" * 50)
    print(f"启动 Celery Worker")
    print(f"队列: {app.conf.broker_transport_options['queue_name']}")
    print(f"并发数: {os.cpu_count() or 4}")
    print("=" * 50)
    
    # 启动 worker
    app.worker_main(
        argv=[
            'worker',
            '--loglevel=info',
            f'--concurrency={os.cpu_count() or 4}',
            '--pool=gevent',  # 使用协程提高性能
            '--without-heartbeat',
            '--without-gossip',
            '--without-mingle'
        ]
    )