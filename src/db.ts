import pkg from 'sequelize';
const { Sequelize, DataTypes, QueryTypes } = pkg;

export const sequelize = new Sequelize('postgres://' + process.env.POSTGRES_USER + ':' + process.env.POSTGRES_PASSWORD + '@db:5432/' + process.env.POSTGRES_DB);

// Model definition
export let User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING, unique: true },
    firstname: DataTypes.STRING,
    lastname: DataTypes.STRING
}, {
        timestamps: true,
        underscored: true
    });

export let Session = sequelize.define('Session', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: DataTypes.STRING,
    course: DataTypes.STRING,
    created: DataTypes.DATE,
    state: DataTypes.STRING,
    owner_id: {
        type: DataTypes.INTEGER,
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
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    index: { type: DataTypes.INTEGER },
    session_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Session,
            key: 'id'
        }
    },
    content: DataTypes.STRING,
    start: DataTypes.DATE,
    stop: DataTypes.DATE
}, {
        timestamps: true,
        underscored: true
    });

export let Answer = sequelize.define('Answer', {
    index: { type: DataTypes.INTEGER, primaryKey: true },
    question_id: {
        type: DataTypes.INTEGER, primaryKey: true,
        references: {
            model: Question,
            key: 'id'
        }
    },
    content: DataTypes.STRING,
    correct: DataTypes.BOOLEAN
}, {
        timestamps: true,
        underscored: true
    });

export let Vote = sequelize.define('Vote', {
    user_id: {
        type: DataTypes.INTEGER, primaryKey: true,
        references: {
            model: User,
            key: 'id'
        }
    },
    question_id: {
        type: DataTypes.INTEGER, primaryKey: true,
        references: {
            model: Question,
            key: 'id'
        }
    },
    answer: DataTypes.STRING
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
FROM "sessions" s JOIN "questions" q ON s.id = q.session_id JOIN "answers" a ON q.id = a.question_id
LEFT JOIN "votes" r ON q.id = r.question_id
LEFT JOIN "users" u ON u.id = r.user_id
GROUP BY s.id, s.name, s.course, s.created, q.id, q.content, q.start, q.stop, r.user_id, r.answer, r.updated_at - q.start, u.lastname, u.firstname, u.email`;
    return sequelize.query(cubeQuery, { type: QueryTypes.SELECT });
}

export function getCourseDetail(courseName: string) {
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
FROM "sessions" s JOIN "questions" q ON s.id = q.session_id JOIN "answers" a ON q.id = a.question_id
LEFT JOIN "votes" r ON q.id = r.question_id
LEFT JOIN "users" u ON u.id = r.user_id
WHERE s.course = ? AND r.user_id IS NOT NULL
GROUP BY s.id, s.name, s.course, s.created, q.id, q.content, q.start, q.stop, r.user_id, r.answer, r.updated_at - q.start, u.lastname, u.firstname, u.email
) g
GROUP BY session_guid, session_name, session_date, answer_deviceid, lastname, firstname, email ORDER BY session_date`;
    return sequelize.query(query, { replacements: [courseName], type: QueryTypes.SELECT });
}

export function getCourseList() {
    var query = 'SELECT course FROM "sessions" GROUP BY course ORDER BY MAX(created) DESC';
    return sequelize.query(query, { type: QueryTypes.SELECT });
}
