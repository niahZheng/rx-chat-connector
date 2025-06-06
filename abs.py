from azure.servicebus import ServiceBusClient, ServiceBusMessage

abs_key="8sfeS7/kQR43wjkUC9vFqDd1FAv2ULaXm+ASbFni2iU=" 
CONNECTION_STR = "Endpoint=sb://celery.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=8sfeS7/kQR43wjkUC9vFqDd1FAv2ULaXm+ASbFni2iU="
AMQP_STR = "amqps://RootManageSharedAccessKey:8sfeS7%2FkQR43wjkUC9vFqDd1FAv2ULaXm%2BASbFni2iU%3D@celery.servicebus.windows.net:5671/?verify=verify_none"
QUEUE_NAME = "<your-queue-name>"


servicebus_client = ServiceBusClient.from_connection_string(conn_str=CONNECTION_STR)
print("Connection established.")



import uamqp

message = uamqp.Message(b"Hello via AMQP 1.0")

sender = uamqp.SendClient(AMQP_STR)
sender.send_message(message)
sender.close()