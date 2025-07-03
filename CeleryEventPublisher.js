const celery = require('celery-node');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const logger = require('pino')({ level: LOG_LEVEL, name: 'CeleryEventPublisher' });

const EventPublisher = require('./EventPublisher');

class CeleryEventPublisher extends EventPublisher {

   constructor() {
    super();

    // TODO: take proper env vars
    const rabbitUrl = process.env.AAN_AMQP_URI;
    const redisUrl = process.env.AAN_REDIS_URI;


    this.client = celery.createClient(
        rabbitUrl, 
        redisUrl        
    );

      // 打印更新后的配置
    logger.info({
      event: 'celery_updated_config',
      config: this.client.conf
    });

    // name of the celery task
    this.task = this.client.createTask("aan_extensions.DispatcherAgent.tasks.process_transcript");
    logger.debug('CeleryEventPublisher: established celery client');
    return this;
  }

  /* eslint-disable class-methods-use-this */
  publish(topic, message, parentSpanCtx) {
    logger.debug('CeleryEventPublisher: publishing message: ' + message + ' on topic: ' + topic);
    
    // 简化的消息发送，移除复杂的 tracer 逻辑
    this.task.applyAsync([topic, message]);
    
    logger.debug('CeleryEventPublisher: message sent successfully');
  }

  destroy() {
    //  Force the shutdown of the client connection.
    this.client.disconnect()  
  }
}
module.exports = CeleryEventPublisher;
