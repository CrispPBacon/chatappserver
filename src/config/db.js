const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = mongoose.Types.ObjectId;

async function connect() {
  const url =
    "mongodb+srv://crisppbacon:Blacks132@cluster0.rarepeo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  try {
    await mongoose.connect(url, { dbName: "chatapp" });
    console.log(`MongoDB Connected!`);
  } catch (err) {
    console.error("Connection Error", err);
    process.exit(1);
  }
  const connectionDb = mongoose.connection;
  connectionDb.once("open", (_) => console.log(`Connected to ${url}`));
  connectionDb.on("error", (err) =>
    console.log(`ERROR Connecting on mongodb`, err)
  );
}
connect();

const userSchema = mongoose.Schema(
  {
    fullname: String,
    username: String,
    email: String,
    password: String,
  },
  { versionKey: false }
);

const chatroomSchema = mongoose.Schema(
  {
    name: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    created_at: Date,
  },
  { versionKey: false }
);

const msgSchema = mongoose.Schema(
  {
    chatroom_id: { type: mongoose.Schema.Types.ObjectId, ref: "chatrooms" },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    content: String,
    seen: Boolean,
    timestamp: Date,
  },
  { versionKey: false }
);

const friendSchema = mongoose.Schema(
  {
    user_id1: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    user_id2: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    status: String,
    timestamp: Date,
  },
  { versionKey: false }
);

const usersCollection = mongoose.model("users", userSchema);
const chatroomsCollection = mongoose.model("chatrooms", chatroomSchema);
const msgCollection = mongoose.model("messages", msgSchema);
const friendCollection = mongoose.model("friends", friendSchema);

module.exports = {
  usersCollection,
  chatroomsCollection,
  msgCollection,
  friendCollection,
  ObjectId,
};
