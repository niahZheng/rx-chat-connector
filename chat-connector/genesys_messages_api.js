const platformClient = require('purecloud-platform-client-v2');

// Create API client instance
const client = platformClient.ApiClient.instance;

// Set environment
client.setEnvironment('cac1.pure.cloud');

// Configuration
const clientId = '47046fb7-aaad-45e3-8b38-f4f6f2e49080';
const clientSecret = 'BHgIgBRTbjaaOvDxtWGj-1YcVw4mqxoFSTUWqBWrKBs';
const agentId = 'YOUR_AGENT_ID'; // Replace with actual Agent ID
const queueId = 'YOUR_QUEUE_ID'; // Replace with actual Queue ID

// Main function
async function getMessages() {
    try {
        // 1. Authentication
        await client.loginClientCredentialsGrant(clientId, clientSecret);
        console.log('Authentication successful');

        // 2. Get agent's active conversations
        const conversationsApi = new platformClient.ConversationsApi();
        const userConversations = await conversationsApi.getUserConversations(agentId, {
            state: 'active'  // Only get active conversations
        });
        console.log('Number of active conversations:', userConversations.entities.length);

        // 3. Iterate through each conversation to get messages
        for (const conversation of userConversations.entities) {
            console.log('\nProcessing conversation:', conversation.id);
            
            // 4. Get all messages for the conversation
            const messages = await conversationsApi.getConversationMessages(conversation.id);
            console.log('Number of messages in conversation:', messages.entities.length);

            // 5. Get detailed information for each message
            for (const message of messages.entities) {
                const messageDetails = await conversationsApi.getConversationMessage(
                    conversation.id,
                    message.id
                );
                console.log('\nMessage details:');
                console.log('Message ID:', messageDetails.id);
                console.log('Sent time:', messageDetails.dateCreated);
                console.log('Sender:', messageDetails.sender);
                console.log('Message content:', messageDetails.textBody);
                console.log('------------------------');
            }
        }

        // 6. Get queue's active conversations
        const queueConversations = await conversationsApi.getRoutingQueueConversations(queueId, {
            state: 'active'
        });
        console.log('\nNumber of active queue conversations:', queueConversations.entities.length);

        // 7. Process queue conversation messages
        for (const conversation of queueConversations.entities) {
            console.log('\nProcessing queue conversation:', conversation.id);
            
            const messages = await conversationsApi.getConversationMessages(conversation.id);
            console.log('Number of messages in queue conversation:', messages.entities.length);

            for (const message of messages.entities) {
                const messageDetails = await conversationsApi.getConversationMessage(
                    conversation.id,
                    message.id
                );
                console.log('\nQueue message details:');
                console.log('Message ID:', messageDetails.id);
                console.log('Sent time:', messageDetails.dateCreated);
                console.log('Sender:', messageDetails.sender);
                console.log('Message content:', messageDetails.textBody);
                console.log('------------------------');
            }
        }

    } catch (error) {
        console.error('Failed to get messages:', error);
    }
}

// Start the program
getMessages(); 