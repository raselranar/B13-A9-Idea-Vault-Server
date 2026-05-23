import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
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

// // verify token
// const verifyToken = async (req, res, next) => {
//   const authHeader = req?.headers?.authorization;
//   if (!authHeader) {
//     return res.status(401).json({ error: "Unauthorized" });
//   }
//   const token = authHeader.split(" ")[1];
//   if (!token) {
//     return res.status(401).json({ error: "Unauthorized" });
//   }

//   try {
//     const JWKS = createRemoteJWKSet(
//       new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
//     );
//     console.log({ jwks: JWKS, token: token });
//     const { payload } = await jwtVerify(token, JWKS);
//     console.log("payload", payload);
//     next();
//   } catch (error) {
//     console.error("Token validation failed:", error);
//     throw error;
//   }
// };

// new

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ error: "Invalid or expired token" }); // ✅ throw না করে response দাও
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const database = client.db("IDEAVAULT");
    const ideasCollection = database.collection("ideas");
    // Send a ping to confirm a successful connection
    // await database.command({ ping: 1 });
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
    // get idea by id
    app.get("/ideas/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const idea = await ideasCollection.findOne({ _id: new ObjectId(id) });
      if (!idea) return res.json({});
      res.send(idea);
    });
    // add new idea route
    app.post("/ideas", verifyToken, async (req, res) => {
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
    app.post("/ideas/:id/comments", verifyToken, async (req, res) => {
      const { id } = req.params;
      // console.log("Idea ID:", id);
      const { user, text, date, commentId, userId } = req.body;

      const result = await ideasCollection.updateOne(
        { _id: new ObjectId(id) },
        { $push: { comments: { user, text, date, commentId, userId } } },
      );

      if (!result.acknowledged) return res.json({});
      res.send(result);
    });
    // update idea route
    app.put("/ideas/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { title, description, category } = req.body;

      const updateFields = {};
      if (title) updateFields.title = title;
      if (description) updateFields.description = description;
      if (category) updateFields.category = category;

      if (Object.keys(updateFields).length === 0) {
        return res
          .status(400)
          .json({ error: "No fields provided for update." });
      }

      const result = await ideasCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields },
      );

      if (!result.acknowledged || result.matchedCount === 0) {
        return res.status(404).json({ error: "Idea not found." });
      }

      res.json(result);
    });
    // delete idea route
    app.delete("/ideas/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await ideasCollection.deleteOne({ _id: new ObjectId(id) });

      if (!result.acknowledged || result.deletedCount === 0) {
        return res.status(404).json({ error: "Idea not found." });
      }

      res.json(result);
    });
    // edit comment route
    app.put(
      "/ideas/:ideaId/comments/:commentId",
      verifyToken,
      async (req, res) => {
        const { ideaId, commentId } = req.params;
        const { text } = req.body;

        const commentIdValue = Number(commentId);

        const result = await ideasCollection.updateOne(
          { _id: new ObjectId(ideaId), "comments.commentId": commentIdValue },
          { $set: { "comments.$.text": text } },
        );
        if (!result.acknowledged) return res.json({});
        res.json(result);
      },
    );
    // delete comment route
    app.delete(
      "/ideas/:ideaId/comments/:commentId",
      verifyToken,
      async (req, res) => {
        const { ideaId, commentId } = req.params;

        const commentIdValue = Number(commentId);
        const result = await ideasCollection.updateOne(
          { _id: new ObjectId(ideaId) },
          { $pull: { comments: { commentId: commentIdValue } } },
        );
        if (!result.acknowledged) return res.json({});
        res.json(result);
      },
    );
    // add my-ideas route
    app.get("/my-ideas", verifyToken, async (req, res) => {
      const { name } = req.query;
      console.log("name", name);
      const cursor = ideasCollection.find({ author: name });
      const myIdeas = await cursor.toArray();
      if (!myIdeas) return res.json({});
      res.send(myIdeas);
    });
    // get commented ideas route
    app.get("/commented-ideas", verifyToken, async (req, res) => {
      const { id } = req.query;
      console.log("id", id);
      const cursor = ideasCollection.find({ "comments.userId": id });
      const commentedIdeas = await cursor.toArray();
      if (!commentedIdeas) return res.json({});
      res.send(commentedIdeas);
    });
    // search ideas route
    app.get("/search-ideas", async (req, res) => {
      const { search } = req.query;
      const cursor = ideasCollection.find({
        $or: [{ title: { $regex: search, $options: "i" } }],
      });
      const searchResults = await cursor.toArray();
      if (!searchResults) return res.json({});
      res.send(searchResults);
    });
    // filter ideas by category route
    app.get("/filter-ideas", async (req, res) => {
      const { category } = req.query;
      const cursor = ideasCollection.find({ category });
      const filteredIdeas = await cursor.toArray();
      if (!filteredIdeas) return res.json({});
      res.send(filteredIdeas);
    });

    // index.js-এ এই route add করো temporarily
    app.get("/debug-env", async (req, res) => {
      const clientUrl = process.env.CLIENT_URL;
      let jwksStatus = null;
      let jwksError = null;

      try {
        const response = await fetch(`${clientUrl}/api/auth/jwks`);
        jwksStatus = response.status;
      } catch (e) {
        jwksError = e.message;
      }

      res.json({
        CLIENT_URL: clientUrl ?? "❌ NOT SET",
        JWKS_status: jwksStatus, // এটা 200 হওয়া লাগবে
        JWKS_error: jwksError,
      });
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
