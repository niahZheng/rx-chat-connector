from celery_app import app
import time
import random

@app.task(bind=True, max_retries=3)
def process_data(self, data):
    """数据处理任务"""
    try:
        print(f"[Worker {self.request.hostname}] 开始处理: {data}")
        
        # 模拟处理时间 (1-3秒)
        process_time = random.uniform(1, 3)
        time.sleep(process_time)
        
        # 模拟20%的失败率
        if random.random() < 0.2:
            raise ValueError("随机错误: 数据处理失败")
            
        result = f"{data.upper()}-PROCESSED"
        print(f"[Worker {self.request.hostname}] 处理完成: {result}")
        return result
        
    except Exception as exc:
        print(f"[Worker {self.request.hostname}] 任务失败 (重试 {self.request.retries})")
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

@app.task
def generate_report(user_id):
    """报告生成任务"""
    print(f"📊 为用户 {user_id} 生成报告中...")
    time.sleep(random.uniform(2, 5))
    return {
        "user_id": user_id,
        "report_id": f"RPT-{int(time.time())}",
        "status": "completed"
    }