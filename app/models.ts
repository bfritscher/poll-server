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

export class Room {
    voters: User[] = [];
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
}
