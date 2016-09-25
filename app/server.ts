/// <reference path="../typings/primus.d.ts" />
import * as http from 'http';
import * as fs from 'fs';
import * as Primus from 'primus';
import { User, Room, Question } from './models';
let PrimusRooms = require('primus-rooms');
let primus;

function handler (req, res) {
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
primus = new Primus(server, { transformer: 'engine.io' }); //sockjs

// add rooms extension to Primus
primus.plugin('rooms', PrimusRooms);

let rooms: {[key: string]: Room} = {};

primus.on('connection', function (spark: Primus.ISpark) {
  // give user his user for admin info
  let user = User.fromHeaders(spark.headers);

  spark.write({a: 'user', user: user});
  // give room list
  // NEXT: more room info to display
  spark.write({a: 'rooms', rooms: Object.keys(rooms)});

  spark.on('data', function (data) {
    data = data || {};
    let action: string = String(data.a);
    let user = User.fromHeaders(spark.headers);
    let roomName = data.r.replace(/ /g, '-');
    let roomAdminName = `${roomName}-admin`;
    let room;
    if (rooms.hasOwnProperty(roomName)) {
      room = rooms[roomName];
    }

    // SHARED commands

    if (action === 'join') {
      spark.join(roomName, () => {
        if (!room) {
          // make client exit not existing room
          return spark.write({a: 'close'});
        }
        if (user.isAdmin) {
          spark.join(roomAdminName, () => {
            spark.write({a: 'room', room: room});
            primus.room(roomName).write({ a: 'voters', voters: room.voters});
          });
        } else {
          room.joinVoters(user);
          spark.write({a: 'room', room: room.getFilteredRoom()});
          primus.room(roomName).write({ a: 'voters', voters: room.voters});
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
        // TODO only count? for users
        primus.room(roomName).write({ a: 'voters', voters: room.voters});

      });
    }

    // USER commands

    if (action === 'vote') {
      //questionid answerid?
      // send vote count to all?
      // send detail info to admins
    }
    // vote -- update answers

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
      primus.write({a: 'rooms', rooms: Object.keys(rooms)});
    }

    if (!room) {
      return;
    }

    if (action === 'add_question') {
      let question = new Question(data.q);
      // TODO: question.save()

      room.questions.push(question);
      primus.room(roomAdminName).write({a: 'room', room: room});
      // update total questions? room_info
    }

    if (action === 'set_state') {
      if (data.v === 'lobby') {
        room.state = 'lobby';
        primus.room(roomName).write({a: 'state', v: 'lobby'});
      }

      if (data.v === 'question') {
        let question = room.questions[room.currentQuestionIndex];
        if (room.state === 'question' && !question.stop) {
          question.stop = new Date();
          // TODO: save;
        }
        room.state = 'question';
        room.currentQuestionIndex = parseInt(data.q, 10);
        question = room.questions[room.currentQuestionIndex];
        if (question.stop && !data.reset) {
          // send question with answers
        } else {
          question.start = new Date();
          question.stop = undefined;
          question.votes = [];
          // TODO: save;
          // send question
        }
      }

      if (data.v === 'results') {
        room.state = 'results';
        primus.room(roomName).write({a: 'state', v: 'results', results: room.results()});
      }
    }

    if (action === 'close_room') {
      delete rooms[roomName];
      primus.room(roomName).write({a: 'close'});
      primus.room(roomName).empty();

      // NEXT optimize
      // send new room list to everybody
      primus.write({a: 'rooms', rooms: Object.keys(rooms)});
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
