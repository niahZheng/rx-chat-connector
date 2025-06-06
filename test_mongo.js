const { MongoClient } = require("mongodb");

const uri = "mongodb://rx-cosmos-db:nyZR13NoS0nP6H5TvLiVSSwv8Ydn27q3Gtl5OzyljZjWqZV5kvwdMCUvE9aZt7km4YBwnfDnzuwQACDbLIrfoA==@rx-cosmos-db.mongo.cosmos.azure.com:10255/?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@rx-cosmos-db@";

async function run() {
  const client = new MongoClient(uri);

  try {
    console.log("🚀 Connecting to CosmosDB Mongo...");
    await client.connect();

    const db = client.db("testdb");
    const collection = db.collection("testCollection");

    // 插入文档
    await collection.insertOne({ message: "Hello Cosmos from rewritten code", time: new Date() });

    // 查询文档
    const docs = await collection.find({}).toArray();
    console.log("📄 Fetched Docs:", docs);

  } catch (err) {
    console.error("❌ Mongo connection failed:", err);
  } finally {
    await client.close();
  }
}

run();
