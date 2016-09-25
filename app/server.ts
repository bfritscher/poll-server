/// <reference path="../typings/primus.d.ts" />
import * as http from 'http';
import * as fs from 'fs';
import * as Primus from 'primus';
import { User, Room, Question } from './models';
let PrimusRooms = require('primus-rooms');

function handler (req, res) {
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
let primus = new Primus(server, { transformer: 'engine.io' }); //sockjs
// add rooms extension to Primus
primus.plugin('rooms', PrimusRooms);

let rooms: {[key: string]: Room} = {};

primus.on('connection', function (spark: Primus.ISpark) {

  // NEXT: more room info to display
  // give room list
  spark.write({a: 'rooms', rooms: Object.keys(rooms)});

  spark.on('data', function (data) {
    data = data || {};
    let action: string = String(data.a);
    let user = User.fromHeaders(spark.headers);
    let roomName = data.roomName.replace(/ /g, '-');
    let roomAdminName = `${roomName}-admin`;
    let room;
    if (rooms.hasOwnProperty(roomName)) {
      room = rooms[roomName];
    }

    // SHARED commands

    if (action === 'join') {
      spark.join(roomName, () => {
        if (user.isAdmin()) {
          spark.join(roomAdminName, () => {
            // TODO: send session info
          });
        } else {
          room.joinVoters(user);
        }
        primus.room(roomName).write({ a: 'voters', voters: room.voters});

        // NEXT: send player history
      });

    };

    if (action === 'leave') {
      spark.leave(roomName, () => {
        if (user.isAdmin()) {
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
    if (!user.isAdmin()) {
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
    }

    if (action === 'add_question') {
      let question = new Question();
      question.content = data.content;
      question.answer = data.answers;
      // TODO: question.save()

      room.questions.push(question);
      // send new questions to admins (optional multiadmin)
      // update total questions? room_info
    }

    // setQuestion -- lookup question (start/stop times)
    /*
      // stop current question stop if question started and not stopped
      // setCurrentIndex
      // start questionTime if null and send question else send question with answer
    */
    /*
      // reset question
      // remove votes
      // set dates stop and start to null
      // setQuestion
    */

    if (action === 'show_results') {
      primus.room(roomName).write({a: 'results', results: room.results()});
    }

    if (action === 'close_room') {
      delete rooms[roomName];
      primus.room(roomName).write({a: 'close'});
      primus.room(roomName).empty();
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

server.listen(9000);
