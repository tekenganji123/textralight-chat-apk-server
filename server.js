const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const localStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const SECRET_TOKEN = process.env.SECRET_TOKEN;

//////middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(express.static("uploads"));

const jwt = require("jsonwebtoken");

mongoose
  .connect("mongodb://127.0.0.1:27017")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("Error connecting to data base", err));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const User = require("./models/user");
const Message = require("./models/message");

// === Multer Config (store temporarily first) ===
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/tmp"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage: tempStorage });

///// to create token for user

const createToken = (userId) => {
  const payLoad = {
    userId: userId,
  };
  const token = jwt.sign(payLoad, SECRET_TOKEN, { expiresIn: "1h" });
  return token;
};

//// generate token

/////end piont for register

// app.post("/signup",  upload.single('profilePic'),  async(req, res) => {
//     console.log(req.body);
//     // console.log('File:', req.file);
//     const { name, email, password} = req.body;
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//         console.log("User already exists:", existingUser);
//         return res.status(409).json({ error: 'User already exists' });
//       }
//     //   const profile = req.file ? `/uploads/${req.file.filename}` : '';
//       const hashPassword = await bcrypt.hash(password, 10);
//         console.log(hashPassword);
//     //   console.log(profile);

//     // Creating a new user object
//     const newUser = new User({
//         name:name,
//         email:email,
//         password:hashPassword,
//         image: '',
//     });

//     // Saving the user to the database
//    newUser.save()
//         .then(async() => {

//             if (req.file) {
//                 const fileName = `${savedUser._id}-${req.file.originalname}`;
//                 const filePath = path.join(__dirname, 'uploads', fileName);

//                 fs.writeFileSync(filePath, req.file.buffer);

//                 // ✅ 4. Update user with image path
//                 savedUser.profilePic = `/uploads/${fileName}`;
//                 await savedUser.save();
//               }
//             res.status(200).json({
//                 message: "User created successfully",
//             });
//         })
//         .catch((err) => {
//             console.error("Error saving user:", err);
//             res.status(500).json({
//                 message: "Error creating user!",
//                 error: err,
//             });
//         });
// });

// === Register Route ===
app.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (req.file) fs.unlinkSync(req.file.path); // Remove uploaded file
      return res.status(400).json({ error: "Email already registered" });
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Move image from /tmp to /uploads
    const timestamp = Date.now();
    const finalImagePath = `uploads/${timestamp}-${req.file.originalname}`;
    fs.renameSync(req.file.path, finalImagePath);

    // Hash password and save user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      image: `${timestamp}-${req.file.originalname}`,
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Error during registration:", err);
    res
      .status(500)
      .json({ error: "An unexpected error occurred during registration" });
  }
});


async function moveFriendToTop(userId, friendId) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      console.log('User not found');
      return;
    }

    const friendObjectId = new mongoose.Types.ObjectId(friendId);
    const index = user.freinds.findIndex(id => id.equals(friendObjectId));

    if (index !== -1) {
      user.freinds.splice(index, 1);           // Remove friend
      user.freinds.unshift(friendObjectId);    // Add to start
      await user.save();
      // console.log('Friend moved to top of the list');
    } else {
      console.log('Friend not found in the array');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
//////login endpoint

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  // console.log(user._id);

  if (!user) {
    return res.status(401).json({ error: "Invalid email " });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid password" });
  } else {
    const token = createToken(user._id);
    // console.log("users", token);
    res.status(200).json({ token });
  }
});

/////get all the users

app.get("/users/:userId", async(req, res) => {
  const loginUserId = req.params.userId;
  // const loginUserId = '6808c3b1c1270949ebd9c3cd'
  const userId = (loginUserId);

  // User.find({ _id: { $ne: loginUserId } })
  //   .then((users) => {
  //     // console.log(users);

  //     res.status(200).json(users);
  //   })
    // .catch((err) => {
    //   console.log(err);
    //   res.status(500).json({ message: "Error get the users" });
    // });

    const user = await User.findOne({_id: userId })
    const yourFreinds = user.freinds;
    const yourSentFreindRequest = user.sentFreindRequests;
    const yourFreindRequest = user.freindRequests;

    const users = await User.find({
        _id:{
            $nin :[...yourFreinds, ...yourSentFreindRequest, ...yourFreindRequest, userId]
        }
    })

    res.json(users)
});

////send a freind request

app.post("/friendRequest", async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;
  // console.log(req.body);

  try {
    // Validate input
    if (
      !mongoose.isValidObjectId(currentUserId) ||
      !mongoose.isValidObjectId(selectedUserId)
    ) {
      return res.status(400).json({ error: "Invalid user IDs" });
    }

    // Check if users exist
    const currentUser = await User.findById(currentUserId);
    const selectedUser = await User.findById(selectedUserId);

    if (!currentUser || !selectedUser) {
      return res.status(404).json({ error: "One or both users not found" });
    }

    // Send friend request
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { freindRequests: currentUserId },
    });

    // Update current user's sent requests
    await User.findByIdAndUpdate(currentUserId, {
      $push: { sentFreindRequests: selectedUserId },
    });

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

/////get freind request

app.get("/freindsRequests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    // console.log(userId);

    // const user = await User.findById(userId)
    //   .populate("freindRequests", "name email image")
    //   .lean();

    // const freindRequests = user.freindRequests;



    
    const user = await User.findOne({_id: userId})
    const freindRequests = user.freindRequests;
    const freinds = user.freinds
    const data = await User.find({_id: {$in: freindRequests, $nin :freinds }})

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

///accept freind request

app.post("/accept/FreindRequest", async (req, res) => {
  const { senderId, recepientId } = req.body;
  // console.log(req.body);

  try {
    // Validate input

    const sender = await User.findById(senderId);
    const recepient = await User.findById(recepientId);

    sender.freinds.push(recepientId);
    recepient.freinds.push(senderId);

    recepient.freindRequests = recepient.freindRequests.filter(
      (request) => request.toString() !== senderId.toString()
    );

    sender.sentFreindRequests = sender.sentFreindRequests.filter(
      (request) => request.toString() !== recepientId.toString()
    );

    await sender.save();
    await recepient.save();

    res.status(200).json({ message: "freind request accepted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

///get my freinds

app.get("/friends/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    // console.log(userId);

    const user = await User.findById(userId).populate(
      "freinds",
      "name email image activeStatus"
    );
    const freind = user.freinds;
    res.json(freind);
  } catch (error) {
    console.log("Error ", error);
  res.status(500).json({ error: "Internal server error" });
  }


 
});

////send message

app.post("/sendMessage", async (req, res) => {
  // console.log(req.body);
  // console.log(req.file);
  // const timestamp = Date.now();
  //   const finalImagePath = `uploads/${timestamp}-${req.file.originalname}`;
  //   fs.renameSync(req.file.path, finalImagePath);

  try {
    const { senderId, recepientId, messageType, message } = req.body;
    const newMessage = new Message({
      senderId,
      recepientId,
      messageType,
      message,
      timestamp: new Date(),
      imageUrl:  null,
      isRead:false,
    });


    moveFriendToTop(senderId, recepientId)
    moveFriendToTop(recepientId,senderId)
    
    res.status(200).json({ message: "Message sent successfully" });
    await newMessage.save();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.post("/sendMessage/file", upload.single("imagefile"), async (req, res) => {
  // console.log(req.body);
  // console.log(req.file);
  const timestamp = Date.now();
    // console.log(`${timestamp}-${req.file.originalname}`);
    

  try {
    const { senderId, recepientId, messageType, message } = req.body;
    const newMessage = new Message({
      senderId,
      recepientId,
      messageType,
      message,
      timestamp: new Date(),
      imageUrl:`${timestamp}-${req.file.originalname}`,
      isRead:false,
    });


    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Move image from /tmp to /uploads
    const finalImagePath = `uploads/${timestamp}-${req.file.originalname}`;
    fs.renameSync(req.file.path, finalImagePath);

    moveFriendToTop(senderId, recepientId)
    moveFriendToTop(recepientId,senderId)
    

    res.status(200).json({ message: "Message sent successfully" });
    await newMessage.save();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/changeProfile", upload.single("imagefile"), async(req, res) =>{
  // console.log(req.body);
  // console.log(req.file);
  const timestamp = Date.now();
    // console.log(`${timestamp}-${req.file.originalname}`);
    

  try {
    const { userId } = req.body;
 const update = await User.updateOne(
      {_id: userId},
      {
        $set:{
          image:`${timestamp}-${req.file.originalname}`,
        },
      }
    )
//  console.log(`${timestamp}-${req.file.originalname}`);
 

    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Move image from /tmp to /uploads
    const finalImagePath = `uploads/${timestamp}-${req.file.originalname}`;
    fs.renameSync(req.file.path, finalImagePath);



    const user = await User.findOne({_id:userId})
    // console.log(user);
    // console.log(update);
    
    
    res.status(200).json({ message: "profile change successfully" });
   
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
})

app.post("/sendMessage/audio", upload.single("audiofile"), (req, res) => {
  const { senderId, recepientId, messageType } = req.body;
  const audioPath = req.file.path; // Path to the uploaded audio file
  const timestamp = Date.now();
  // console.log(`${timestamp}-${req.file.originalname}`);
  // Save the message to the database
  // const newMessage = new Message({
  //   senderId,
  //   recepientId,
  //   messageType,
  //   imageUrl: `${timestamp}-${req.file.originalname}`,
  // });
  const newMessage = new Message({
    senderId,
    recepientId,
    messageType,
    timestamp: new Date(),
    imageUrl:  `${timestamp}-${req.file.originalname}`,
    isRead:false,
  });
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Move image from /tmp to /uploads
    const finalImagePath = `uploads/${timestamp}-${req.file.originalname}`;
    fs.renameSync(req.file.path, finalImagePath);

    moveFriendToTop(senderId, recepientId)
    moveFriendToTop(recepientId,senderId)
    

  newMessage.save()
    .then(() => res.status(200).json({ message: "Audio message sent successfully" }))
    .catch((err) => res.status(500).json({ error: "Failed to send message", details: err }));
});
/////get user detail for chatroom

app.get("/user/:userId", async (req, res) => {
  const userId = req.params.userId;
  // console.log(userId);

  try {
    const user = await User.findById(userId);
    res.status(200).json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/////get messages
app.get("/getmessages/:senderId/:recepientId", async (req, res) => {
  const { senderId, recepientId } = req.params;
  // console.log(senderId, recepientId);

  try {
    const messages = await Message.find({
      $or: [
        { senderId, recepientId },
        { senderId: recepientId, recepientId: senderId },
      ],
    }).populate("senderId", "_id name").sort({ timestamp: 1 });
    // console.log(messages);

  
    
    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/read', async(req,res) =>{
  const { senderId, recepientId } = req.body;
  try {
    // console.log(req.body);
    
     await Message.updateMany({senderId:recepientId, recepientId: senderId, isRead: false}, {$set:{isRead: true}})
     res.status(200).json({msg:'read'})
  } catch (error) {
    console.log(error);
    
  }


})


/////delating messages

app.post("/deleteMessages", async(req, res) =>{
  // console.log(req.body);
  
  try {
    const {messages} = req.body
    // console.log(messages);
    
    if(!Array.isArray(messages) || messages.length === 0){
      return res.status(400).json({message:"Invalid request body!"})
    }
    await Message.deleteMany({_id:{
      $in:messages
    }})
    res.json({message:"Messages deleted successfully"})
  } catch (error) {
    console.log(error)
    res.status(500).json({error:"Internal server error"})
  }
})


/////set online status

app.post("/onLineStatus", async(req, res) =>{
  const {userId, state} = req.body
  console.log(req.body);
  try {
    await User.updateOne({_id: userId}, {$set:{activeStatus: state}})
  } catch (error) {
    console.log(error);
    
  }
  res.json(req.body)
  
})