const platformClient = require("purecloud-platform-client-v2");
const fs = require("fs")

// Create an instance of the API client
const client = platformClient.ApiClient.instance;

client.setEnvironment('cac1.pure.cloud'); // Genesys Cloud region

const clientId = '47046fb7-aaad-45e3-8b38-f4f6f2e49080';
const clientSecret = 'BHgIgBRTbjaaOvDxtWGj-1YcVw4mqxoFSTUWqBWrKBs';
//const conversationId = "645dbba6-2baf-4712-bb4c-5e07e1fbc82c";
//const conversationId = "827627ba-a2df-4bd2-b7bf-73bf4949c8e5";
const conversationId = "186c6c3b-8d11-46dd-b244-e90bc99a7920"

//"userId":0a904021-a9af-4c7a-b8ee-9feeb968e9d0
//queueId: 8683de87-8d6a-44de-a86b-0f723a5eedad

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
            fs.writeFileSync('./conversationdetails.json', JSON.stringify(data, null, 2));
            fetchMessages(data)
        })
        .catch((err) => {
            console.log("There was a failure calling getConversation");
            console.error(err);
        });
}

function fetchMessages(data) {


    let apiInstance = new platformClient.ConversationsApi();


    let opts = {
        "useNormalizedMessage": true, // Boolean | If true, response removes deprecated fields (textBody, media, stickers)
        "body": getMessageIDS(data)//['86c781a8b6b58e22c8f1af3997e2ffdc','e60df890ec5f5360a4d286738fb41455','bca8dbebe5b94dc66dbd6f96a5c406f3','e3ee072c1449401858821a033619ade4','ff068e507cde52a87b2847f1f203a159',] // [String] | messageIds
    };


    // Get messages in batch
    apiInstance.postConversationsMessageMessagesBulk(conversationId, opts)
        .then((data) => {
            data.entities.forEach(msg => {
                console.log(msg)
                console.log((msg.direction == "inbound" ? "Guest" : "Agent") + "- " + convertTimestampToTimeText(msg.timestamp) + ":" + msg.normalizedMessage.text)
            });
            //console.log(`postConversationsMessageMessagesBulk success! data: ${JSON.stringify(data, null, 2)}`);
        })
        .catch((err) => {
            
            console.log("There was a failure calling postConversationsMessageMessagesBulk");
            console.error(err);
        });
}
function convertTimestampToTimeText(timestamp) {
    const date = new Date(timestamp);

    // Extract hours and minutes
    let hours = date.getHours();
    const minutes = date.getMinutes();

    // Determine AM or PM
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // hour 0 should be 12

    // Pad minutes with leading zero if needed
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;

    return `${hours}:${minutesStr} ${ampm}`;
}
function getMessageIDS(data) {
    let arrmsgs = [];
    data.participants.forEach(participant => {
        if (participant.purpose == 'customer') {

            participant.messages[0].messages.forEach(msg => {
                if (msg.messageMetadata.type == 'Text') {
                    arrmsgs.push(msg.messageId)
                }

            })

        }
        if (participant.purpose == 'agent') {

            participant.messages[0].messages.forEach(msg => {
                arrmsgs.push(msg.messageId)
            })

        }
    })
    return arrmsgs;
}