const {
  usersCollection,
  chatroomsCollection,
  msgCollection,
  friendCollection,
  ObjectId,
} = require("./config/db");
const path = require("path");
const fs = require("fs");

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "July",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

String.prototype.toTitleCase = function () {
  return this.toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const auth = async (req, res) => {
  const login = req.body.login;
  const signup = req.body.signup;
  const checkSession = req.body.checkSession;
  const logout = req.body.logout;

  if (checkSession) {
    if (!(req.session && req.session?.userdata?._id)) {
      console.log("User failed to use a session");
      return res.json({ error: "No session found" });
    }
    const _id = checkSession._id;
    if (_id !== req.session?.userdata?._id) {
      return res.json({ error: "Invalid session ID!" });
    }
    return res.json(req.session.userdata);
  }

  if (login) {
    let { uid, pwd } = login;
    uid = uid.toLowerCase();
    if (!uid || !pwd) {
      return res.json({ error: "Please fill in username and password!" });
    }

    const data = await usersCollection.findOne({ username: uid });

    if (!data) {
      return res.json({ error: "User does not exist!" });
    }

    if (pwd !== data.password) {
      return res.json({ error: "Password incorrect!" });
    }

    const userdata = {
      _id: data._id,
      username: data.username,
      fullname: data.fullname.toTitleCase(),
      email: data.email,
      role: data.role,
      perms: data.perms,
    };
    req.session.userdata = userdata;
    return res.json(req.session.userdata);
  }

  if (signup) {
    const { firstname, lastname, email, uid, pwd, confirmPwd } = signup;
    if (pwd !== confirmPwd) {
      return res.json({ error: "Password does not match!" });
    }
    if (!firstname || !lastname || !email || !uid || !pwd || !confirmPwd) {
      return res.json({ error: "Please fill in everything" });
    }

    const userExist = await usersCollection.findOne({ username: uid });
    if (userExist) {
      return res.json({ error: "Username already exist" });
    }

    const newUser = new usersCollection({
      fullname: `${firstname.toUpperCase()} ${lastname.toUpperCase()}`,
      username: uid.toLowerCase(),
      email: email.toLowerCase(),
      password: pwd,
      isOnline: false,
      created_at: new Date(),
      role: "user",
      perms: { sendChat: true, banned: false },
    });

    try {
      await newUser.save();
      return res.json({ success: "User created successfully" });
    } catch (error) {
      console.log("Error while creating user:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  }

  if (logout) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(501).json({ error: "Error in destroying session" });
      }

      return res.json({ success: "You have logged out!" });
    });
  }
};

const rooms = async (req, res) => {
  const getRoom = req.body.getRoom;
  const getMessages = req.body.getMessages;
  const getInbox = req.body.getInbox;

  if (getInbox) {
    const user_id = getInbox.user_id;
    if (!user_id) {
      return res.json({ error: "Invalid user id" });
    }

    const data = await chatroomsCollection.find({
      members: new ObjectId(user_id),
    });

    if (!data || data.length < 0) {
      return res.json({ error: "No chatroom found!" });
    }

    let inbox = [];
    for (let key in data) {
      let msg = await msgCollection
        .findOne({ chatroom_id: data[key]._id })
        .sort({ timestamp: -1 });

      if (!msg) {
        continue;
      }

      const person_id =
        data[key].members[0].toString() !== user_id
          ? data[key].members[0]
          : data[key].members[1];

      let person = await usersCollection.findOne({ _id: person_id });
      if (!person) {
        continue;
      }
      inbox.push({
        _id: msg._id,
        chatroom_id: msg.chatroom_id,
        person_id: person_id,
        fullname: person.fullname.toTitleCase(),
        content: msg.content,
        seen: msg.seen,
        sender_id: msg.sender_id,
        timestamp: msg.timestamp,
      });
    }

    return res.json(inbox);
  }

  if (getRoom) {
    const sender_id = getRoom.user_id;
    const receiver_id = getRoom.person_id;

    if (sender_id.length !== 24 || receiver_id.length !== 24) {
      return res.json({ error: "ID Must only be 24 characters!" });
    }

    const recieverExist = await usersCollection.findOne({ _id: receiver_id });
    const senderExist = await usersCollection.findOne({ _id: sender_id });

    if (!recieverExist) {
      return res.json({ error: "You can't send to unknown user!" });
    }
    if (!senderExist) {
      return res.json({ error: "You don't exist as a user!" });
    }

    const query = {
      $or: [
        {
          members: [new ObjectId(sender_id), new ObjectId(receiver_id)],
        },
        {
          members: [new ObjectId(receiver_id), new ObjectId(sender_id)],
        },
      ],
    };

    let data = await chatroomsCollection.findOne(query);

    if (data) {
      data = {
        _id: data._id,
        name: data.name,
        members: data.members,
        created_at: data.created_at,
        person_name: recieverExist.fullname.toTitleCase(),
      };
      return res.json(data);
    }

    const newChatRoom = new chatroomsCollection({
      name: "Private",
      members: [new ObjectId(sender_id), new ObjectId(receiver_id)],
      created_at: new Date(),
    });

    data = {
      _id: newChatRoom._id,
      name: newChatRoom.name,
      members: newChatRoom.members,
      created_at: newChatRoom.created_at,
      person_name: recieverExist.fullname.toTitleCase(),
    };

    try {
      await newChatRoom.save();
      // data = await chatroomsCollection.findOne(query);
      console.log("success: New chatroom created");
      return res.json(data);
    } catch (error) {
      console.error("Error while creating chatroom:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  }

  if (getMessages) {
    const chatroom_id = getMessages.room_id;
    if (!chatroom_id) {
      return res.json({ error: "Invalid chatroom id!" });
    }
    const data = await msgCollection.find({ chatroom_id: chatroom_id });
    return res.json(data);
  }
};

const users = async (req, res) => {
  const search = req.body.search;
  const friendRequests = req.body.friendRequests;
  const fetchFriends = req.body.fetchFriends;
  const acceptRequest = req.body.acceptRequest;
  const rejectRequest = req.body.rejectRequest;
  const getUsers = req.body.getUsers;
  const muteUser = req.body.muteUser;
  const unmuteUser = req.body.unmuteUser;
  const ban = req.body.ban;
  const unban = req.body.unban;

  if (search) {
    if (search.searchValue <= 0) {
      return res.json([]);
    }

    const query = [
      { fullname: { $regex: new RegExp(search.searchValue), $options: "i" } },
      { username: { $regex: new RegExp(search.searchValue), $options: "i" } },
    ];
    const usersdata = await usersCollection.find(
      {
        $or: query,
      },
      { password: 0 }
    );

    const data =
      usersdata.length > 0
        ? usersdata.map((user) => {
            user.fullname = user.fullname.toTitleCase();
            return user;
          })
        : [];
    // console.log(data);
    return res.json(data);
  }

  if (fetchFriends) {
    const { user_id } = fetchFriends;
    if (!user_id) {
      return "Annonymous!";
    }

    const data = await friendCollection.find({
      $and: [
        { $or: [{ user_id1: user_id }, { user_id2: user_id }] },
        { status: "FRIENDS" },
      ],
    });

    const response = [];
    for (const d of data) {
      const person_id =
        d.user_id1.toString() === user_id ? d.user_id2 : d.user_id1;
      const person = await usersCollection.findOne({ _id: person_id });
      response.push({
        fullname: person.fullname.toTitleCase(),
        _id: person._id,
      });
    }
    return res.json(response);
  }

  if (friendRequests) {
    const user_id = friendRequests.user_id;
    if (!user_id) {
      return res.json({ error: "Annonymous!" });
    }

    const data = await friendCollection.find({
      $or: [{ user_id1: user_id }, { user_id2: user_id }],
    });

    const response = [];
    for (const d of data) {
      if (d.status === "PENDING" && d.user_id1.toString() !== user_id) {
        const person_id =
          d.user_id1.toString() === user_id ? d.user_id2 : d.user_id1;
        const person = await usersCollection.findOne({ _id: person_id });
        response.push({
          fullname: person.fullname.toTitleCase(),
          person_id: person_id,
          timestamp: data.timestamp,
        });
      }
    }
    return res.json(response);
  }

  if (acceptRequest) {
    const { user_id, person_id } = acceptRequest;

    const query = {
      $or: [
        {
          $and: [
            { user_id1: new ObjectId(user_id) },
            { user_id2: new ObjectId(person_id) },
          ],
        },
        {
          $and: [
            { user_id1: new ObjectId(person_id) },
            { user_id2: new ObjectId(user_id) },
          ],
        },
      ],
    };

    if (!query) {
      return res.json({ error: "No request found!" });
    }
    await friendCollection.updateOne(query, {
      $set: { status: "FRIENDS" },
    });
    return res.json({ success: "You are now friends with this person!" });
  }
  if (rejectRequest) {
    const { user_id, person_id } = rejectRequest;

    const query = {
      $or: [
        {
          $and: [
            { user_id1: new ObjectId(user_id) },
            { user_id2: new ObjectId(person_id) },
          ],
        },
        {
          $and: [
            { user_id1: new ObjectId(person_id) },
            { user_id2: new ObjectId(user_id) },
          ],
        },
      ],
    };

    if (!query) {
      return res.json({ error: "No request found!" });
    }
    await friendCollection.updateOne(query, {
      $set: { status: "NONE" },
    });
    return res.json({ success: "You rejected this person's friend request" });
  }

  if (getUsers) {
    const data = await usersCollection.find({});
    return res.json(data);
  }

  if (muteUser) {
    const user_id = muteUser.user_id;

    const data = await usersCollection.findOneAndUpdate(
      { _id: user_id },
      { $set: { "perms.sendChat": false } },
      { new: true }
    );

    if (!data) {
      return res.json({ error: "Internal server error" });
    }

    console.log(data);

    return res.json({ success: "You have muted user " + muteUser.user_id });
  }
  if (unmuteUser) {
    const user_id = unmuteUser.user_id;

    const data = await usersCollection.findOneAndUpdate(
      { _id: user_id },
      { $set: { "perms.sendChat": true } },
      { new: true }
    );

    if (!data) {
      return res.json({ error: "Internal server error" });
    }

    console.log(data);

    return res.json({ success: "You have unmuted user " + user_id });
  }
  if (ban) {
    const user_id = ban.user_id;

    const data = await usersCollection.findOneAndUpdate(
      { _id: user_id },
      { $set: { "perms.banned": true } },
      { new: true }
    );

    if (!data) {
      return res.json({ error: "Internal server error" });
    }

    console.log(data);

    return res.json({ success: "You have banned user " + user_id });
  }
  if (unban) {
    const user_id = unban.user_id;

    const data = await usersCollection.findOneAndUpdate(
      { _id: user_id },
      { $set: { "perms.banned": false } },
      { new: true }
    );

    if (!data) {
      return res.json({ error: "Internal server error" });
    }

    console.log(data);

    return res.json({ success: "You have unbanned user " + user_id });
  }
};

const uploadFile = async (req, res) => {
  if (!req?.file) {
    return res.send("Failed to upload the file");
  }
  res.send(req.file);
};

const downloadFile = async (req, res) => {
  const { id, filename } = req.params;
  const filePath = path.join(
    __dirname,
    "..",
    "uploads",
    "chatrooms",
    id,
    filename
  );

  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    res.status(404).send("File not found");
  }
};

const fetchImages = async (req, res) => {
  const { id } = req.params;
  const directoryPath = path.join(__dirname, "..", "uploads", "chatrooms", id);

  // Read all files in the directory
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return res.json({ error: "Internal server error" });
    }

    // Filter only image files
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif|jfif)$/i.test(file)
    );

    const imageDataArray = imageFiles.map((file) => {
      const imagePath = path.join(directoryPath, file);
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = Buffer.from(imageBuffer).toString("base64");
      const imageData = `data:image/png;base64,${imageBase64}`;

      const details = {
        filename: file,
        description: "Description of the image",
      };

      return { imageData, details };
    });

    res.json(imageDataArray);
  });
};

const analytics = async (req, res) => {
  const usersToday = req.body.usersToday;
  const usersx = req.body.users;
  const messagesx = req.body.messages;

  const today = new Date();

  if (usersToday) {
    if (usersToday.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized access" });
    }
    console.log(usersToday);

    const users = await usersCollection.find({}).sort({ created_at: -1 });

    const data = [];
    const dateToday = `${
      months[today.getMonth()]
    } ${today.getDate()} ${today.getFullYear()}`;
    for (const user of users) {
      const created_at = `${
        months[user.created_at.getMonth()]
      } ${user.created_at.getDate()} ${user.created_at.getFullYear()}`;
      if (created_at == dateToday) {
        data.push({
          fullname: user.fullname.toTitleCase(),
          created_at: user.created_at,
        });
      }
    }
    return res.json([{ name: "Today", users: data.length }]);
  }

  if (usersx) {
    if (usersx.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const users = await usersCollection.find({}).sort({ created_at: -1 });
    const data = {};
    for (let i = 0; i < 31; i++) {
      data[i + 1] = [];
    }
    for (const user of users) {
      if (
        today.getFullYear() === user.created_at.getFullYear() &&
        today.getMonth() === user.created_at.getMonth()
      ) {
        data[user.created_at.getDate()].push({
          fullname: user.fullname,
          date: `${
            months[user.created_at.getMonth()]
          } ${user.created_at.getDate()}`,
        });
      }
    }

    const analytic = [];
    for (const key in data) {
      if (data[key].length > 0) {
        analytic.push({ name: data[key][0].date, users: data[key].length });
      }
    }
    res.json(analytic);
  }

  if (messagesx) {
    if (messagesx.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const messages = await msgCollection.find({}).sort({ timestamp: -1 });
    const data = {};
    for (let i = 0; i < 31; i++) {
      data[i + 1] = [];
    }

    for (const msg of messages) {
      if (
        today.getFullYear() === msg.timestamp.getFullYear() &&
        today.getMonth() === msg.timestamp.getMonth()
      ) {
        data[msg.timestamp.getDate()].push({
          fullname: msg.content,
          date: `${
            months[msg.timestamp.getMonth()]
          } ${msg.timestamp.getDate()}`,
        });
      }
    }

    const analytic = [];
    for (const key in data) {
      if (data[key].length > 0) {
        analytic.push({ name: data[key][0].date, messages: data[key].length });
      }
    }
    res.json(analytic);
  }
};

const checkLogin = (req, res, next) => {
  if (!(req.session && req.session?.userdata?._id)) {
    console.log("No session or user data found");
    return res.status(401).json({ error: "Unauthorized access" });
  }
  next();
};

module.exports = {
  auth,
  rooms,
  users,
  uploadFile,
  downloadFile,
  fetchImages,
  analytics,
  checkLogin,
};
