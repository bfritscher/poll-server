import * as db from './db.js';
import * as jwt from 'jsonwebtoken';

let admins = ['boris.fritscher@he-arc.ch'];

export class User {
  id: number = -1;
  email: string = 'unknown';
  firstname: string = 'unknown';
  lastname: string = 'unknown';
  isAdmin: Boolean = false;
  avatar: string = '';

  static fromToken(token: string): Promise<User> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SHARED_SECRET, (err, decoded) => {
        if (err) {
          return reject(err);
        }
        let user = new User();
        user.email = decoded?.email || 'unknown';
        user.firstname = decoded?.firstname || 'unknown';
        user.lastname = decoded?.lastname || 'unknown';
        user.isAdmin = admins.indexOf(user.email) > -1;

        (<any>db.User.findOrCreate({
          where: {
            email: user.email,
          },
          defaults: {
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
          },
        })).spread(
          (dbUser: any) => {
            user.id = dbUser.id;
            if (
              user.firstname !== dbUser.firstname ||
              user.lastname !== dbUser.lastname
            ) {
              dbUser.firstname = user.firstname;
              dbUser.lastname = user.lastname;
              dbUser.save();
            }
            resolve(user);
          },
          (err: any) => {
            reject(err);
          }
        );
      });
    });
  }
}

interface IAnswer {
  content: string;
  correct: boolean | number;
}

export class Question {
  id: number = -1;
  index: number = 0;
  content: string;
  answers: IAnswer[] = [];
  votes: {[key: string]: number[]} = {};
  start?: Date;
  stop?: Date;

  //transient
  correctIndexes: number[];
  isMultiple: boolean;

  constructor(data: {content: string; answers: IAnswer[]}) {
    this.content = data.content;
    this.answers = data.answers || [];
    this.correctIndexes = this.computeCorrectIndexes();
    this.isMultiple = this.correctIndexes.length > 1;
  }

  answer(user: User, vote: number[]): void {
    this.votes[user.email] = vote;
    db.Vote.upsert({
      user_id: user.id,
      question_id: this.id,
      answer: vote.join(','),
    });
  }

  votesByAnswers(): number[] {
    let votesTotal = Array(this.answers.length).fill(0);
    Object.keys(this.votes).forEach((key) => {
      this.votes[key].forEach((index) => {
        votesTotal[index]++;
      });
    });
    return votesTotal;
  }

  computeCorrectIndexes(): number[] {
    return this.answers.reduce((indexes, answer, index) => {
      if (answer.correct) {
        indexes.push(index);
      }
      return indexes;
    }, [] as number[]);
  }

  votesCount(): number {
    return Object.keys(this.votes).length;
  }

  getFiltered(): any {
    let question: any = {
      content: this.content,
      answers: this.answers.map((a) => {
        return {content: a.content};
      }),
      start: this.start,
      stop: this.stop,
      isMultiple: this.isMultiple,
      votesCount: this.votesCount(),
    };
    if (this.stop) {
      // with results
      question.answers = this.answers;
      question.votesByAnswers = this.votesByAnswers();
    }
    return question;
  }

  save(room: Room): void {
    if (this.id) {
      db.Question.upsert({
        id: this.id,
        index: this.index,
        session_id: room.id,
        content: this.content,
        start: this.start,
        stop: this.stop,
      });
    } else {
      db.Question.create({
        index: this.index,
        session_id: room.id,
        content: this.content,
        start: this.start,
        stop: this.stop,
      }).then((dbQuestion: any) => {
        this.id = dbQuestion.get('id');
        db.Answer.bulkCreate(
          this.answers.map((answer, index) => {
            return {
              index: index,
              question_id: this.id,
              content: answer.content,
              correct: answer.correct,
            };
          })
        );
      });
    }
  }
}

export interface Score {
  user: User;
  score: number;
}

export class Room {
  id?: number;
  name: string;
  course?: string;
  created: Date;
  questions: Question[] = [];
  state: string = 'lobby';
  owner?: User;
  // anyone who has voted at least once
  participants: {[key: string]: User} = {};

  // transient currently online
  voters: {[key: string]: User} = {};

  constructor(name: string) {
    this.name = name;
    this.created = new Date();
  }

  addParticipant(user: User): void {
    if (!this.participants.hasOwnProperty(user.email)) {
      this.participants[user.email] = user;
    }
  }

  joinVoters(user: User): void {
    this.voters[user.email] = user;
  }

  leaveVoters(user: User): void {
    delete this.voters[user.email];
  }

  getFilteredRoom(): any {
    return {
      name: this.name,
      course: this.course,
      created: this.created,
      state: this.state,
      questionsCount: this.questions.length,
      voters: this.voters,
    };
  }

  getCurrentQuestion(): Question | null {
    if (this.state.indexOf('q') === 0) {
      return this.questions[parseInt(this.state.slice(1), 10)];
    }
    return null;
  }

  getUserAnswers(user: User): {[key: number]: number[]} {
    return this.questions.reduce((answers, question, index) => {
      if (question.votes.hasOwnProperty(user.email)) {
        answers[index] = question.votes[user.email];
      }
      return answers;
    }, {} as any);
  }

  results(): any[] {
    let results: {[key: string]: number} = {};
    this.questions.forEach((question) => {
      Object.keys(question.votes).forEach((userKey) => {
        let score = question.votes[userKey].reduce((score, index) => {
          if (question.correctIndexes.indexOf(index) > -1) {
            score++;
          }
          return score;
        }, 0);
        if (!results.hasOwnProperty(userKey)) {
          results[userKey] = 0;
        }
        results[userKey] += score;
      });
    });
    // transform to sorted array
    let scores = [] as Score[];
    Object.keys(results).forEach((userKey) => {
      scores.push({user: this.participants[userKey], score: results[userKey]});
    });
    return scores.sort((a, b) => {
      return b.score - a.score;
    });
  }

  save(): void {
    if (this.id) {
      db.Session.upsert({
        id: this.id,
        course: this.course,
        created: this.created,
        state: this.state,
        owner_id: this.owner?.id,
      });
    } else {
      db.Session.create({
        name: this.name,
        course: this.course,
        created: this.created,
        state: this.state,
        owner_id: this.owner?.id,
      }).then((dbSession: any) => {
        this.id = dbSession.get('id');
      });
    }
  }
}
