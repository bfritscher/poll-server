/// <reference path="../typings/primus.d.ts" />
import * as http from 'http';
import * as Primus from 'primus';
import { User, Room, Question } from './models';
import * as db from './db';

let PrimusRooms = require('primus-rooms');
let primus;

function handler(req: http.ServerRequest, res: http.ServerResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/primus/primus.js') {
    res.end(primus.library());

  }
  else if (req.url === '/api/course') {
    db.getCourseList().then((result) => {
       res.setHeader('Content-Type', 'application/json');
       res.end(JSON.stringify(result));
    });
  }
  else if (req.url.indexOf('/api/course/') > -1) {
    db.getCourseDetail(req.url.slice('/api/course/'.length)).then((result) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
    });
  }
  else if (req.url === '/headers') {
    res.end(JSON.stringify(req.headers));
  }
  else {
    res.writeHead(404);
    res.end();
  }
}

let server = http.createServer(handler);
primus = new Primus(server, { transformer: 'engine.io' });

// add rooms extension to Primus
primus.plugin('rooms', PrimusRooms);

let rooms: { [key: string]: Room } = {};

primus.on('connection', async function (spark: Primus.ISpark) {
  // give user his user for admin info
  let user = await User.fromHeaders(spark.headers);
  console.log(spark.headers);

  spark.write({ a: 'user', v: user });
  // give room list
  // NEXT: more room info to display
  spark.write({ a: 'rooms', v: Object.keys(rooms) });

  spark.on('leaveroom', (roomName) => {
    if (!user.isAdmin && rooms.hasOwnProperty(roomName)) {
      rooms[roomName].leaveVoters(user);
    }
    primus.room(roomName).write({ a: 'voter_left', v: user.email });
  });

  spark.on('data', (data) => {
    data = data || {};
    let action: string = String(data.a);
    if (!data.r) {
      return;
    }
    let roomName = data.r.replace(/ /g, '-');
    let roomAdminName = `${roomName}-admin`;
    let room: Room;
    if (rooms.hasOwnProperty(roomName)) {
      room = rooms[roomName];
    }

    // SHARED commands

    if (action === 'join') {
      if (!room) {
        // make client exit not existing room
        return spark.write({ a: 'close' });
      }
      spark.join(roomName, () => {
        // NEXT admin of this room?
        spark.write({ a: 'room', v: room.getFilteredRoom() });
        if (user.isAdmin) {
          spark.join(roomAdminName, () => {
            // send full room with list of question to admin
            spark.write({ a: 'room', v: room });
            // since not included in full room send it
            spark.write({ a: 'questionsCount', v: room.questions.length });
          });
        } else {
          room.joinVoters(user);
          primus.room(roomName).write({ a: 'voter_join', v: user });
          spark.write({ a: 'user_answers', v: room.getUserAnswers(user) });
        }

        // restore state send current question or results info missing in room we sent (refactor?)
        let currentQuestion = room.getCurrentQuestion();
        if (currentQuestion) {
          spark.write({ a: 'state', v: room.state, question: currentQuestion.getFiltered() });
        }
        if (room.state === 'results') {
          spark.write({ a: 'state', v: 'results', results: room.results() });
        }
      });
    };

    if (action === 'leave') {
      if (!room) {
        return;
      }
      spark.leave(roomName, () => {
        if (user.isAdmin) {
          spark.leave(roomAdminName);
        }
      });
    }

    // USER commands

    if (action === 'vote' && !user.isAdmin) {
      let question = room.getCurrentQuestion();
      if (question && !question.stop) {
        question.answer(user, data.v);
        room.addParticipant(user);
        // refactor? if missing voter from disconnect
        if (!room.voters.hasOwnProperty(user.email)) {
          room.joinVoters(user);
          primus.room(roomName).write({ a: 'voter_join', v: user });
        }
        primus.room(roomName).write({ a: 'votesCount', q: data.q, v: question.votesCount() });
        primus.room(roomAdminName).write({ a: 'vote', u: user.email, v: data.v, q: room.questions.indexOf(question) });
      }
    }

    if (action === 'user_avatar') {
      room.voters[user.email].avatar = data.v;
      primus.room(roomName).write({ a: 'user_avatar', v: data.v, u: user.email });
    }

    // ADMIN commands
    if (!user.isAdmin) {
      return;
    }

    if (action === 'create_room') {
      if (rooms.hasOwnProperty(roomName)) {
        return;
      }
      room = new Room(roomName);
      room.owner = user;
      room.course = data.c;
      rooms[roomName] = room;
      room.save();
      /* DEBUG
            let names = [
              'Karyl Batterton',
              'Adaline Combes',
              'Shanel Weingarten',
              'Wade Trainer',
              'Pasquale Prochnow',
              'Latanya Spevak',
              'Elise Domingues',
              'Noreen Perras',
              'Randi Buell',
              'Wiley Seger',
              'Latricia Halderman',
              'Khadijah Garriott',
              'Yolando Kierstead',
              'Griselda Gilmer',
              'Lashonda Oropeza',
              'Marlen Budzinski',
              'Elliott Ismail',
              'Palma Peaden',
              'Velia Mix',
              'Debra Beaton'
            ];

            names.forEach((name) => {
              let u = new User();
              u.email = name;
              u.firstname = name.split(' ')[0];
              u.lastname = name.split(' ')[1];
              room.joinVoters(u);
            });
      */
      // NEXT optimize
      // send new room list to everybody
      primus.write({ a: 'rooms', v: Object.keys(rooms) });
    }

    if (!room) {
      return;
    }

    if (action === 'add_question') {
      if (!data.q) {
        return;
      }
      let question = new Question(data.q);
      question.index = room.questions.push(question) - 1;
      question.save(room);

      primus.room(roomAdminName).write({ a: 'questions', v: room.questions });
      primus.room(roomName).write({ a: 'questionsCount', v: room.questions.length });
    }

    if (action === 'set_state') {
      if (!data.v) {
        return;
      }
      let question = room.getCurrentQuestion();
      // stop active question if votes > 0 or setting same question again (= showing answers even without votes)
      if (question && !question.stop && (Object.keys(question.votes).length > 0 || data.v === room.state)) {
        question.stop = new Date();
        question.save(room);
      }
      if (data.v === 'lobby') {
        room.state = 'lobby';
        room.save();
        primus.room(roomName).write({ a: 'state', v: 'lobby' });
      }

      if (data.v.indexOf('q') === 0) {
        room.state = data.v;
        room.save();
        question = room.getCurrentQuestion();
        if (!question.stop || data.reset) {
          question.start = new Date();
          question.stop = undefined;
          question.votes = {};
          question.save(room);
          primus.room(roomAdminName).write({ a: 'questions', v: room.questions });
        }
        primus.room(roomName).write({ a: 'state', v: data.v, question: question.getFiltered(), reset: data.reset });
      }

      if (data.v === 'results') {
        room.state = 'results';
        room.save();
        primus.room(roomName).write({ a: 'state', v: 'results', results: room.results() });
      }
    }

    if (action === 'close_room') {
      room.state = 'closed';
      room.save();
      delete rooms[roomName];
      primus.room(roomName).write({ a: 'close' });
      primus.room(roomName).empty();

      // NEXT optimize
      // send new room list to everybody
      primus.write({ a: 'rooms', v: Object.keys(rooms) });
    }
  });
});

db.ready.then(() => {
  db.Session.findAll({
    where: {
      state: {
        $ne: 'closed'
      }
    },
    include: [
      { model: db.User, as: 'owner' },
      { model: db.Question, as: 'questions', include: [{ model: db.Answer, as: 'answers' }, { model: db.Vote, as: 'votes', include: [{ model: db.User, as: 'user' }] }] }
    ]
  }).then((roomsData) => {
    roomsData.forEach((roomData: any) => {
      let room = new Room(roomData.name);
      room.id = roomData.id;
      room.state = roomData.state;
      room.course = roomData.course;
      room.created = roomData.created;
      room.owner = roomData.owner;
      roomData.questions.forEach((questionData) => {
        let answers = [];
        questionData.answers.forEach((answer) => {
          answers[answer.index] = answer;
        });
        let question = new Question({ content: questionData.content, answers: answers });
        question.id = questionData.id;
        question.index = questionData.index;
        question.start = questionData.start;
        question.stop = questionData.stop;

        questionData.votes.forEach((vote) => {
          question.votes[vote.user.email] = vote.answer.split(',').map((e) => {
            return parseInt(e, 10);
          });
          room.participants[vote.user.email] = vote.user;
        });
        room.questions[question.index] = question;
      });

      rooms[room.name] = room;
    });
    server.listen(3033);
  });
});
