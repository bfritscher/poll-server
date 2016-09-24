/// <reference path="../typings/primus.d.ts" />
import * as http from 'http';
import * as fs from 'fs';
import * as Primus from 'primus';
import { User, Room } from './models';
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

  // give room list
  spark.write(primus.rooms());

  spark.on('data', function (data) {
    data = data || {};
    let action: string = String(data.a);
    let user = User.fromHeaders(spark.headers);

    // SHARED commands

    if (action === 'join') {
      spark.join(data.roomName, () => {
        let room = rooms[data.roomName];
        if (user.isAdmin()) {
          spark.join(`${data.roomName}-admin`, () => {
            // TODO: send session info
          });
        } else {
          room.joinVoters(user);
        }
        primus.room(data.roomName).write({ a: 'voters', voters: room.voters});

        // NEXT: send player history
      });

    };

    if (action === 'leave') {
      spark.leave(data.roomName, () => {
        let room = rooms[data.roomName];
        if (user.isAdmin()) {
          spark.leave(`${data.roomName}-admin`);
        } else {
          room.leaveVoters(user);
        }
        primus.room(data.roomName).write({ a: 'voters', voters: room.voters});

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
    // addQuestion
    // setQuestion -- lookup question (start/stop times)
    // showAnswers --> send filtered answers
    // showResults --> send results ranking and answers for all questions?
    // createSession --> rooms (nb questions)

    // SEND
    // player_list
    // question (with answers and filtered)
    // rooms
    // vote (to admin)
    // answers
    // results

  });
});

server.listen(9000);
