import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";
const client = new MongoClient(process.env.MONGO_DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.json({ message: "server is running" }));
//

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const database = client.db("IDEAVAULT");
    const ideasCollection = database.collection("ideas");
    // Send a ping to confirm a successful connection
    await database.command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
    // all ideas route
    app.get("/ideas", async (req, res) => {
      const cursor = ideasCollection.find();
      const allIdeas = await cursor.toArray();
      if (!allIdeas) return res.json({});
      res.send(allIdeas);
    });

    // Trending Ideas route
    app.get("/trending-ideas", async (req, res) => {
      const cursor = ideasCollection.find().limit(6);
      const trendingIdeas = await cursor.toArray();
      if (!trendingIdeas) return res.json({});
      res.send(trendingIdeas);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`✅ Server : http://localhost:${port}`);
});
