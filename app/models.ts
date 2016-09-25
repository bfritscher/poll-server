let admins = ['boris'];

export class User {
    email: string;
    isAdmin: Boolean;

    static fromHeaders(headers: any[]): User {
        let user = new User();
        // TODO get user from headers
        console.log(headers['mail']);
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
}

export class Room {
    // TODO dicts?
    voters: User[] = [];
    admins: User[] = [];
    name: string;
    course: string;
    created: Date;
    questions: Question[] = [];
    state: string = 'lobby';
    currentQuestionIndex: number;

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
            questions: this.questions.map((question) => {
                return {
                    content: question.content,
                    start: question.start,
                    stop: question.stop,
                    isMultiple: question.isMultiple,
                    answers: question.answers.map((answer) => {
                        return {
                            content: answer.content
                        };
                    })
                };
            }),
            currentQuestionIndex: this.currentQuestionIndex
        };
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
