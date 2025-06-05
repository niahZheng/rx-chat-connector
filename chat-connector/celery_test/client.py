from celery_app import app
from tasks import process_data, generate_report, test_connection
import random
import time

def send_demo_tasks():
    """发送演示任务"""
    # 1. 测试连接
    test_result = test_connection.delay()
    print(f"测试任务已发送 | ID: {test_result.id}")
    
    # 2. 发送数据处理任务
    data_tasks = []
    for i in range(10):
        data = f"data-{i}-{random.randint(100,999)}"
        task = process_data.delay(data)
        data_tasks.append(task)
        print(f"数据处理任务已发送 | 数据: {data} | ID: {task.id}")
        time.sleep(0.2)  # 避免洪水发送
    
    # 3. 发送报告任务
    for user_id in [101, 202, 303]:
        task = generate_report.delay(user_id)
        print(f"报告任务已发送 | 用户: {user_id} | ID: {task.id}")
    
    return test_result, data_tasks

def monitor_results(test_result, data_tasks):
    """监控任务结果"""
    print("\n等待任务完成... (Ctrl+C 退出)")
    try:
        # 等待测试任务完成
        test_output = test_result.get(timeout=30)
        print(f"\n🔌 连接测试结果: {test_output}")
        
        # 检查数据处理任务
        success_count = 0
        for task in data_tasks:
            try:
                result = task.get(timeout=10)
                print(f"✅ 任务完成: {result}")
                success_count += 1
            except Exception as e:
                print(f"❌ 任务失败: {task.id} | 错误: {str(e)}")
        
        print(f"\n数据处理任务成功率: {success_count}/{len(data_tasks)}")
        
    except KeyboardInterrupt:
        print("\n监控已终止，Worker 仍在后台处理任务")

if __name__ == '__main__':
    print("=" * 50)
    print("Celery ASB 演示客户端")
    print("=" * 50)
    
    test_res, data_tasks = send_demo_tasks()
    monitor_results(test_res, data_tasks)