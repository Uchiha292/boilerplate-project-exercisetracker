const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const req = require('express/lib/request');

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.json());
app.use('/api/users', bodyParser.json());
app.use('/api/users/:_id/exercises', bodyParser.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const exerciseSchema = new mongoose.Schema({
  description: String,
  duration: Number,
  date: {type: Date, default: Date.now},
  userId: String
});


const userSchema = new mongoose.Schema({
  username: String,
  count: {type: Number, default: 0}
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema)

// check if username exists
const checkUserName = async (userName) => {
  try {
    return await User.exists({username: userName});
  }
  catch(err){
    console.error(err);
    return false;
  }
};

// creating new user
app.post('/api/users', async (req,res) => {
  const userName = req.body.username;
  if (!userName){
    return res.json({error: 'No user input'});
  }

  const userExists = await checkUserName(userName);
  if (userExists){
    return res.json({error: 'User already exists'})
  }
  const newUser = new User({
    username: userName
  });
  newUser.save();
  res.json({username: newUser.username, _id: newUser._id});
});


// adding exercises
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res.json({ error: 'description or duration missing' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.json({ error: 'User not found' });
  }

  const exerciseDate = date ? new Date(date) : new Date();

  const newExercise = new Exercise({
    description,
    duration: parseInt(duration),
    date: exerciseDate,
    userId: user._id
  });

  await newExercise.save();

  // update user's exercise count
  user.count += 1;
  await user.save();

  res.json({
    username: user.username,
    description: newExercise.description,
    duration: newExercise.duration,
    date: newExercise.date.toDateString(),
    _id: user._id
  });
});



// getting all users
app.get('/api/users', async (req,res) => {
  const allUsers = await User.find({});
  if (!allUsers){
    return res.json({error: 'No User Exists'})
  }
  res.json(allUsers);
});


// get user logs
app.get('/api/users/:_id/logs', async (req, res) => {
  const userid = req.params._id;
  const { from, to, limit } = req.query;

  const user = await User.findById(userid);
  if (!user) {
    return res.json({ error: 'User not found' });
  }

  const filter = { userId: userid };

  if (from || to) {
    filter.date = {};
    if (from) {
      filter.date.$gte = new Date(from);
    }
    if (to) {
      filter.date.$lte = new Date(to);
    }
  }

  let exercisesQuery = Exercise.find(filter);

  if (limit) {
    exercisesQuery = exercisesQuery.limit(parseInt(limit));
  }

  const exercises = await exercisesQuery.exec();

  const formattedLog = exercises.map(e => ({
    description: e.description,
    duration: e.duration,
    date: e.date.toDateString()
  }));

  res.json({
    username: user.username,
    count: exercises.length,
    _id: user._id,
    log: formattedLog
  });
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
