let admins = ['boris'];

export class User {
    email: string;
    isAdmin(): Boolean {
        return admins.indexOf(this.email) > -1;
    }

    static fromHeaders(headers: any[]): User {
        let user = new User();
        // TODO get user from headers
        user.email = 'boris';
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

    answer(user: User, vote: number[]): void {
        // NEXT get vote timings?
        this.votes[user.email] = vote;
    }

    votesByAnswers(): number[] {
        let votesTotal = [].fill(0, 0, this.answers.length);
        Object.keys(this.votes).forEach((key) => {
            this.votes[key].forEach((index) => {
                votesTotal[index]++;
            });
        });
        return votesTotal;
    }

    correctIndexes(): number[] {
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
    questions: Question[];
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

    results(): any[] {
        let results: {[key: string]: number} = {};
        this.questions.forEach((question) => {
            let correctIndexes = question.correctIndexes();
            Object.keys(question.votes).forEach((userKey) => {
                let score = question.votes[userKey].reduce((score, index) => {
                    if (correctIndexes.indexOf(index) > -1) {
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
