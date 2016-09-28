let admins = ['boris'];

export class User {
    email: string;
    isAdmin: Boolean;

    static fromHeaders(headers: any): User {
        let user = new User();
        // TODO get user from headers
        console.log(headers.mail);
        user.email = 'boris';
        user.isAdmin = admins.indexOf(user.email) > -1;
        user.isAdmin = headers['user-agent'].indexOf('Chrome') > 0;
        return user;
    }
}

interface IAnswer {
    content: string;
    correct: boolean|number;
}

export class Question {
    content: string;
    answers: IAnswer[] = [];
    votes: {[key: string]: number[]} = {};
    start: Date;
    stop: Date;

    //transient
    correctIndexes: number[];
    isMultiple: boolean;

    constructor(data: {content: string, answers: IAnswer[]}) {
        this.content = data.content;
        this.answers = data.answers || [];
        this.correctIndexes = this.computeCorrectIndexes();
        this.isMultiple = this.correctIndexes.length > 1;
    }

    answer(user: User, vote: number[]): void {
        // NEXT get vote timings?
        this.votes[user.email] = vote;
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
        }, []);
    }

    votesCount(): number {
        return  Object.keys(this.votes).length;
    }

    getFiltered(): any {
        let question: any = {
            content: this.content,
            answers: this.answers.map((a) => { return {content: a.content}; }),
            start: this.start,
            stop: this.stop,
            isMultiple: this.isMultiple,
            votesCount: this.votesCount()
        };
        if (this.stop) {
            // with results
            question.answers = this.answers;
            question.votesByAnswers = this.votesByAnswers();
        }
        return question;
    }
}

export class Room {
    name: string;
    course: string;
    created: Date;
    questions: Question[] = [];
    state: string = 'lobby';
    admins: User[] = [];

    // transient
    // TODO dicts?
    voters: User[] = [];
    questionsCount = 0;

    constructor(name: string) {
        this.name = name;
        this.created = new Date();
    }

    joinVoters(user: User): void {
        if (this.voters.map((u) => { return u.email; }).indexOf(user.email) === -1) {
            this.voters.push(user);
        }
    }

    leaveVoters(user: User): void {
        let index = this.voters.map((u) => { return u.email; }).indexOf(user.email);
        if ( index > -1) {
            this.voters.splice(index, 1);
        }
    }

    getFilteredRoom(): any {
        return {
            name: this.name,
            course: this.course,
            created: this.created,
            state: this.state,
            questionsCount: this.questions.length
        };
    }

    getCurrentQuestion(): Question {
        if (this.state.indexOf('q') === 0) {
            return this.questions[parseInt(this.state.slice(1), 10)];
        }
        return null;
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
        let scores = [];
        Object.keys(results).forEach((userKey) => {
            // TODO: userlookup
            scores.push({user: userKey, score: results[userKey]});
        });
        return scores.sort((a, b) => {
            return b.score - a.score;
        });
    }
}
