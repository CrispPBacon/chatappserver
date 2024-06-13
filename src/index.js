const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const fs = require("fs");

const { generateInboxObject } = require("./config/functions");
const {
  auth,
  users,
  rooms,
  uploadFile,
  downloadFile,
  fetchImages,
} = require("./controllers");

const { upload } = require("./config/multerConfig");
const { usersCollection, msgCollection, ObjectId } = require("./config/db");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    methods: ["GET", "POST"],
  },
});

app.use([
  express.static(path.join(__dirname, "..", "/public")),
  express.json(),
  express.urlencoded({ extended: true }),
]);
app.use(cors({ origin: "http://localhost:5173" }));
app.use(
  session({
    secret: "74679e8244cf2b2869902f183ce3d864ba0c63e02585a21f4e10c5fc064eee05",
    resave: false,
    saveUninitialized: false,
  })
);

server.listen(process.env.PORT || 3500, "0.0.0.0", () =>
  console.log(`Connected to PORT ${process.env.PORT || 3500}`)
);

// REFSTFUL API

app.post("/api/auth", auth);
app.post("/api/rooms", rooms);
app.post("/api/users", users);
app.post("/api/upload/users/:id", upload.single("file"), uploadFile);
app.post("/api/upload/chatrooms/:id", upload.single("file"), uploadFile);

app.post("/api/download/:id/:filename", downloadFile);
// app.get("/api/download/:id/:filename", downloadFile);
app.post("/api/fetch_images/:id", fetchImages);

// SOCKET IO

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

  socket.on("join_room", (room_id) => {
    console.log("User joined the room", room_id);
    socket.join(room_id);
  });

  socket.on("leave_room", (room_id) => {
    console.log("User left the room", room_id);
    socket.leave(room_id);
  });

  socket.on("upload_image", async (members) => {
    console.log(members);
    io.to(members).emit("message_sent_response", "Image uploaded");
  });

  socket.on("send_message", async (data, callback) => {
    if (!data.message) {
      console.log("Can't write empty message.");
      return;
    }

    try {
      const newMessage = await msgCollection.create({
        chatroom_id: new ObjectId(data.room_id),
        sender_id: data.sender_id,
        content: data.message,
        seen: false,
        timestamp: new Date(),
      });

      callback(newMessage);
      socket.to(data.room_id).emit("received_message", newMessage);

      const [person1, person2] = await Promise.all([
        usersCollection.findOne({ _id: data.sender_id }),
        usersCollection.findOne({ _id: data.receiver_id }),
      ]);

      const newInbox_Receiver = generateInboxObject(newMessage, person1);
      const newInbox_Sender = generateInboxObject(newMessage, person2);

      io.to(data.receiver_id).emit("new_inbox", newInbox_Receiver);
      io.to(data.sender_id).emit("new_inbox", newInbox_Sender);
    } catch (err) {
      console.error("Error while saving new document:", err);
    }
  });
});
