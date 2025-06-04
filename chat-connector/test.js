const platformClient = require("purecloud-platform-client-v2");
const fs=require("fs")

// Create an instance of the API client
const client = platformClient.ApiClient.instance;

client.setEnvironment('cac1.pure.cloud'); // Genesys Cloud region

const clientId = '47046fb7-aaad-45e3-8b38-f4f6f2e49080';
const clientSecret = 'BHgIgBRTbjaaOvDxtWGj-1YcVw4mqxoFSTUWqBWrKBs';
const conversationId = "645dbba6-2baf-4712-bb4c-5e07e1fbc82c";
try {



    client.loginClientCredentialsGrant(clientId, clientSecret)
        .then(loadMsgsIds).catch((err) => {
            console.log("There was a failure calling login");
            console.error(err);
        })





} catch (error) {
    console.error(err);
}

function loadMsgsIds() {
    let apiInstance = new platformClient.ConversationsApi();
    apiInstance.getConversation(conversationId)
        .then((data) => {
            console.log(`getConversation success! data: ${JSON.stringify(data, null, 2)}`);
             fs.writeFileSync('./AgentAssistresponse.json', JSON.stringify(data, null, 2));
            fetchMessages(data)
        })
        .catch((err) => {
            console.log("There was a failure calling getConversation");
            console.error(err);
        });
}

function fetchMessages(data) {

    var token = client.authData.accessToken;
    // Manually set auth token or use loginImplicitGrant(...) or loginClientCredentialsGrant(...) or loginPKCEGrant(...)
    client.setAccessToken(token);

    let apiInstance = new platformClient.ConversationsApi();

    let conversationId = "conversationId_example"; // String | 
    let opts = {
        "useNormalizedMessage": false, // Boolean | If true, response removes deprecated fields (textBody, media, stickers)
        "body": ['2c11b390-e6d8-46a4-8bc9-c00b35c54b8c|925c03db-8197-43f8-a8b9-ea66a5a3e34c|589e4e63-bbcf-42b6-a9d4-392096257dbe|bab1cb6f-0dff-4de7-bebc-80928e87ace3|494f8fdd-131c-464b-9cda-27ab295d1a60'] // [String] | messageIds
    };


    // Get messages in batch
    apiInstance.postConversationsMessageMessagesBulk(conversationId, opts)
        .then((data) => {
            console.log(`postConversationsMessageMessagesBulk success! data: ${JSON.stringify(data, null, 2)}`);
        })
        .catch((err) => {
            console.log("There was a failure calling postConversationsMessageMessagesBulk");
            console.error(err);
        });
}