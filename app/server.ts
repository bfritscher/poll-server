/// <reference path="../typings/primus.d.ts" />
import * as http from 'http';
import * as fs from 'fs';
import * as Primus from 'primus';
import { User, Room, Question } from './models';
let PrimusRooms = require('primus-rooms');
let primus;

function handler(req, res) {
  if (req.url === '/primus/primus.js') {
    return res.send(primus.library());

  }

  fs.readFile(__dirname + '/index.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }

      res.writeHead(200);
      res.end(data);
    });
}

let server = http.createServer(handler);
primus = new Primus(server, { transformer: 'engine.io' });

// add rooms extension to Primus
primus.plugin('rooms', PrimusRooms);

let rooms: { [key: string]: Room } = {};

primus.on('connection', function (spark: Primus.ISpark) {
  // give user his user for admin info
  let user = User.fromHeaders(spark.headers);

  spark.write({ a: 'user', v: user });
  // give room list
  // NEXT: more room info to display
  spark.write({ a: 'rooms', v: Object.keys(rooms) });

  spark.on('data', function (data) {
    data = data || {};
    let action: string = String(data.a);
    let user = User.fromHeaders(spark.headers);
    if (!data.r) {
      return;
    }
    let roomName = data.r.replace(/ /g, '-');
    let roomAdminName = `${roomName}-admin`;
    let room;
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
        if (user.isAdmin) {
          spark.join(roomAdminName, () => {
            // send full room with list of question to admin
            spark.write({ a: 'room', v: room });
          });
        } else {
          room.joinVoters(user);
        }
        spark.write({ a: 'room', v: room.getFilteredRoom() });
        // NEXT: only send new player
        primus.room(roomName).write({ a: 'voters', v: room.voters });
        // send current question
        let currentQuestion = room.getCurrentQuestion();
        if (currentQuestion) {
          spark.write({ a: 'state', v: room.state, question: currentQuestion.getFiltered()});
        }

        // NEXT: send player history
      });

    };

    if (action === 'leave') {
      if (!room) {
        return;
      }
      spark.leave(roomName, () => {
        if (user.isAdmin) {
          spark.leave(roomAdminName);
        } else {
          room.leaveVoters(user);
        }
        // NEXT only count? for users ony user not full list
        primus.room(roomName).write({ a: 'voters', v: room.voters });

      });
    }

    // USER commands

    if (action === 'vote') {
      let question = room.getCurrentQuestion();
      if (question) {
        question.votes[user.email] = data.v;
        primus.room(roomName).write({ a: 'votesCount', q: data.q, v: question.votesCount() });
        primus.room(roomAdminName).write({ a: 'vote', u: user.email, v: data.v, q: room.questions.indexOf(question) });
      }
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
      room.admins.push(user);
      room.course = data.course;
      rooms[roomName] = room;

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
      // TODO: question.save()

      room.questions.push(question);
      primus.room(roomAdminName).write({ a: 'questions', v: room.questions });
      primus.room(roomName).write({ a: 'questionsCount', v: room.questions.length });
    }

    if (action === 'set_state') {
      let question = room.getCurrentQuestion();
      if (question && !question.stop) {
        question.stop = new Date();
        // TODO: save;
      }
      if (data.v === 'lobby') {
        room.state = 'lobby';
        // TODO: save;
        primus.room(roomName).write({ a: 'state', v: 'lobby' });
      }

      if (data.v.indexOf('q') === 0) {
        room.state = data.v;
        question = room.getCurrentQuestion();
        if (!question.stop || data.reset) {
          question.start = new Date();
          question.stop = undefined;
          question.votes = {};
          // TODO: save;
          primus.room(roomAdminName).write({ a: 'questions', v: room.questions });
        }
        primus.room(roomName).write({ a: 'state', v: data.v, question: question.getFiltered() });
      }

      if (data.v === 'results') {
        room.state = 'results';
        // TODO :save
        primus.room(roomName).write({ a: 'state', v: 'results', results: room.results() });
      }
    }

    if (action === 'close_room') {
      delete rooms[roomName];
      primus.room(roomName).write({ a: 'close' });
      primus.room(roomName).empty();

      // NEXT optimize
      // send new room list to everybody
      primus.write({ a: 'rooms', v: Object.keys(rooms) });
    }

    // SEND

    // question (with answers and filtered)
    // vote (to admin)
    // vote_count

    // results
    // voters
    // rooms
    // close

    // PERSISTENCE ? ids? check turning point
    // save votes and modify votes
    // save new questions
    // save rooms/sessions

    // NEXT

    // question with no answers to display only content?

    // userpics from api?
    // multi auth? not only shib
    // annoymous auth?
    // admin by rooms?
    // add admins
    // load sessions?
    // store questions sets to be instantiated as room/sessions

  });
});

server.listen(3033);
