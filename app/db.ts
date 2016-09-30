import * as Sequelize from 'sequelize';

export let sequelize = new Sequelize('postgres://' + process.env.POSTGRES_USER + ':' + process.env.POSTGRES_PASSWORD + '@db:5432/' + process.env.POSTGRES_DB);

// Model definition
export let User = sequelize.define('User', {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
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
    owner_id: {
        type: Sequelize.INTEGER,
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
    index: { type: Sequelize.INTEGER },
    session_id: {
        type: Sequelize.INTEGER,
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
    index: { type: Sequelize.INTEGER, primaryKey: true },
    question_id: {
        type: Sequelize.INTEGER, primaryKey: true,
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
    user_id: {
        type: Sequelize.INTEGER, primaryKey: true,
        references: {
            model: User,
            key: 'id'
        }
    },
    question_id: {
        type: Sequelize.INTEGER, primaryKey: true,
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

Session.hasMany(Question, { as: 'questions', foreignKey: 'session_id' });
Session.belongsTo(User, { as: 'owner', foreignKey: 'owner_id' });
Vote.belongsTo(User, { as: 'user', foreignKey: 'user_id' });
Question.hasMany(Answer, { as: 'answers', foreignKey: 'question_id' });
Question.hasMany(Vote, { as: 'votes', foreignKey: 'question_id' });


export let ready = sequelize.sync();

export function getCube() {
    let cubeQuery = `SELECT s.id session_guid, s.name session_name, s.course session_course, s.created session_date,
q.id question_guid,  q.content question_text, EXTRACT(EPOCH FROM q.stop - q.start) question_time,
r.user_id answer_deviceid,
SUM(CASE WHEN a.correct AND r.answer LIKE '%' || a.index || '%' THEN 1 ELSE 0 END) answer_points,
r.answer answer_given, EXTRACT(EPOCH FROM r.updated_at - q.start) answer_time_taken,
string_agg(CASE WHEN a.correct THEN CAST(a.index AS text) ELSE '' END, '' order by a.index) answer,
string_agg(CASE WHEN a.correct THEN a.content || '\n' ELSE '' END, '' order by a.index) answer_text,
string_agg(CASE WHEN r.answer LIKE '%' || a.index || '%' THEN a.content || '\n' ELSE '' END, '' order by a.index) answer_text_given,
u.lastname, u.firstname, u.email
FROM "Sessions" s JOIN "Questions" q ON s.id = q.session_id JOIN "Answers" a ON q.id = a.question_id
LEFT JOIN "Votes" r ON q.id = r.question_id
LEFT JOIN "Users" u ON u.id = r.user_id
GROUP BY s.id, s.name, s.course, s.created, q.id, q.content, q.start, q.stop, r.user_id, r.answer, r.updated_at - q.start, u.lastname, u.firstname, u.email`;
    return sequelize.query(cubeQuery, { type: sequelize.QueryTypes.SELECT });
}

export function getCourseDetail(courseName) {
    let query = `SELECT session_guid, session_name, session_date, answer_deviceid, lastname, firstname, email, SUM(answer_points) answer_points, AVG(answer_time_taken) answer_avg_time_taken
FROM (SELECT s.id session_guid, s.name session_name, s.course session_course, s.created session_date,
q.id question_guid,  q.content question_text, EXTRACT(EPOCH FROM q.stop - q.start) question_time,
r.user_id answer_deviceid,
SUM(CASE WHEN a.correct AND r.answer LIKE '%' || a.index || '%'
THEN 1 ELSE 0 END) answer_points,
r.answer answer_given, EXTRACT(EPOCH FROM r.updated_at - q.start) answer_time_taken,
string_agg(CASE WHEN a.correct THEN CAST(a.index AS text) ELSE '' END, '' order by a.index) answer,
string_agg(CASE WHEN a.correct THEN a.content || '\n' ELSE '' END, '' order by a.index) answer_text,
string_agg(CASE WHEN r.answer LIKE '%' || a.index || '%' THEN a.content || '\n' ELSE '' END, '' order by a.index) answer_text_given,
u.lastname, u.firstname, u.email
FROM "Sessions" s JOIN "Questions" q ON s.id = q.session_id JOIN "Answers" a ON q.id = a.question_id
LEFT JOIN "Votes" r ON q.id = r.question_id
LEFT JOIN "Users" u ON u.id = r.user_id
WHERE s.course = ? AND r.user_id IS NOT NULL
GROUP BY s.id, s.name, s.course, s.created, q.id, q.content, q.start, q.stop, r.user_id, r.answer, r.updated_at - q.start, u.lastname, u.firstname, u.email
) g
GROUP BY session_guid, session_name, session_date, answer_deviceid, lastname, firstname, email ORDER BY session_date`;
    return sequelize.query(query, { replacements: [courseName], type: sequelize.QueryTypes.SELECT });
}

export function getCourseList() {
    var query = 'SELECT course FROM "Sessions" GROUP BY course ORDER BY MAX(created) DESC';
    return sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
}
