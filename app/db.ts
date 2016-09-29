import * as Sequelize from 'sequelize';

export let sequelize = new Sequelize('postgres://' +  process.env.POSTGRES_USER + ':' +  process.env.POSTGRES_PASSWORD + '@db:5432/' + process.env.POSTGRES_DB);

// Model definition
export let User = sequelize.define('User', {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true},
    email: { type: Sequelize.STRING, unique: true },
    firstname: Sequelize.STRING,
    lastname: Sequelize.STRING
}, {
    timestamps: true,
    underscored: true
});

export let Session = sequelize.define('Session', {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
    name: Sequelize.STRING,
    course: Sequelize.STRING,
    created: Sequelize.DATE,
    state: Sequelize.STRING,
    owner_id: { type: Sequelize.INTEGER,
        references: {
            model: User,
            key: 'id'
        }
    },
}, {
    timestamps: true,
    underscored: true
});

export let Question = sequelize.define('Question', {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
    index: {type: Sequelize.INTEGER},
    session_id: { type: Sequelize.INTEGER,
        references: {
            model: Session,
            key: 'id'
        }
    },
    content: Sequelize.STRING,
    start: Sequelize.DATE,
    stop: Sequelize.DATE
}, {
    timestamps: true,
    underscored: true
});

export let Answer = sequelize.define('Answer', {
    index: {type: Sequelize.INTEGER, primaryKey: true},
    question_id: { type: Sequelize.INTEGER, primaryKey: true,
        references: {
            model: Question,
            key: 'id'
        }
    },
    content: Sequelize.STRING,
    correct: Sequelize.BOOLEAN
}, {
    timestamps: true,
    underscored: true
});

export let Vote = sequelize.define('Vote', {
    user_id: { type: Sequelize.INTEGER, primaryKey: true,
        references: {
            model: User,
            key: 'id'
        }
    },
    question_id: { type: Sequelize.INTEGER, primaryKey: true,
        references: {
            model: Question,
            key: 'id'
        }
    },
    answer: Sequelize.STRING
}, {
    timestamps: true,
    underscored: true
});

Session.hasMany(Question, {as: 'questions', foreignKey: 'session_id'});
Session.belongsTo(User, {as: 'owner', foreignKey: 'owner_id'});
Vote.belongsTo(User, {as: 'user', foreignKey: 'user_id'});
Question.hasMany(Answer, {as: 'answers', foreignKey: 'question_id'});
Question.hasMany(Vote, {as: 'votes', foreignKey: 'question_id'});


export let ready = sequelize.sync();
