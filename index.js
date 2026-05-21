import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
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
    // await client.connect();
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
    // idea by id route
    app.get("/ideas/:id", async (req, res) => {
      const { id } = req.params;
      const idea = await ideasCollection.findOne({ _id: new ObjectId(id) });
      if (!idea) return res.json({});
      res.send(idea);
    });
    // add new idea route
    app.post("/ideas", async (req, res) => {
      const newIdea = req.body;
      console.log(newIdea);
      const result = await ideasCollection.insertOne(newIdea);
      if (!result.acknowledged) return res.json({});
      res.send(result);
    });

    // Trending Ideas route
    app.get("/trending-ideas", async (req, res) => {
      const cursor = ideasCollection.find().limit(6);
      const trendingIdeas = await cursor.toArray();

      if (!trendingIdeas) return res.json({});
      res.send(trendingIdeas);
    });

    // add comment route
    app.post("/ideas/:id/comments", async (req, res) => {
      const { id } = req.params;
      console.log("Idea ID:", id);
      const { user, text, date, commentId } = req.body;

      const result = await ideasCollection.updateOne(
        { _id: new ObjectId(id) },
        { $push: { comments: { user, text, date, commentId } } },
      );

      if (!result.acknowledged) return res.json({});
      res.send(result);
    });
    // edit comment route
    app.put("/ideas/:ideaId/comments/:commentId", async (req, res) => {
      const { ideaId, commentId } = req.params;
      const { text } = req.body;

      const commentIdValue = Number(commentId);

      const result = await ideasCollection.updateOne(
        { _id: new ObjectId(ideaId), "comments.commentId": commentIdValue },
        { $set: { "comments.$.text": text } },
      );
      if (!result.acknowledged) return res.json({});
      res.json(result);
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
