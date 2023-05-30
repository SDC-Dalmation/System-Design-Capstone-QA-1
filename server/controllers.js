require("dotenv").config();
const { Pool } = require("pg");
const { Sequelize, DataTypes } = require("sequelize");

async function databaseConnection() {
  const Host = process.env.Host;
  const Port = process.env.port;
  const Database = process.env.Database;
  const User = process.env.ExistUser;
  const Password = process.env.Password;

  // const sequelize = new Sequelize('postgres://user:pass@example.com:5432/dbname') // Example for postgres
  // return new Sequelize(
  //   `postgres://${User}:${Password}@${Host}:${Port}/${Database}`
  // );

  return new Sequelize(Database, User, Password, {
    host: Host,
    dialect: 'postgres',
    benchmark: true,
    logging(sql, timing) {
      console.log(`[Execution time: ${timing}ms]
       -  ${sql} \n`)
 },
})

  // /You can use the .authenticate() function to test if the connection is OK:
  // try {
  //   await sequelize.authenticate();
  //   console.log('Connection has been established successfully.');
  // } catch (error) {
  //   console.error('Unable to connect to the database:', error);
  // }
  // return new Sequelize(`postgres://${User}:${Password}@${Host}:${Port}/${Database}`);
}
//return connection to qeustions_list table
async function questionsListTableConn(sequelize) {
  return sequelize
    .authenticate()
    .then(async () => {
      console.log("Connection has been established successfully.");

      return sequelize.define(
        "questionsList",
        {
          question_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          product_id: {
            type: DataTypes.INTEGER,
          },
          question_body: {
            type: DataTypes.STRING(1000),
          },
          question_date: {
            type: DataTypes.STRING(25),
          },
          asker_name: {
            type: DataTypes.STRING(60),
          },
          asker_email: {
            type: DataTypes.STRING(320),
          },
          reported: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
          },
          question_helpfulness: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
        },
        {
          schema: process.env.Schema, // Replace with your schema name
          tableName: "questions_list", // Replace with your table name
          timestamps: false,
        }
      );
    })
    .catch((err) => {
      console.error("Error occured when connecting to PostgreSQL: ", err);
    });
}
//return connection to answers_list table
async function answersListTableConn(sequelize) {
  return sequelize
    .authenticate()
    .then(async () => {
      console.log("Connection has been established successfully.");

      return sequelize.define(
        "answersList",
        {
          answer_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          question_id: {
            type: DataTypes.INTEGER,
            references: {
              model: "questionsList",
              key: "question_id",
            },
          },
          answer_body: {
            type: DataTypes.STRING(1000),
          },
          answer_date: {
            type: DataTypes.STRING(25),
          },
          answerer_name: {
            type: DataTypes.STRING(60),
          },
          answerer_email: {
            type: DataTypes.STRING(320),
          },
          reported: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
          },
          helpfulness: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
        },
        {
          schema: process.env.Schema, // Replace with your schema name
          tableName: "answers_list", // Replace with your table name
          timestamps: false,
        }
      );
    })
    .catch((err) => {
      console.error("Error occured when connecting to PostgreSQL: ", err);
    });
}
//return connection to answers_photos table
async function answersPhotosTableConn(sequelize) {
  return sequelize
    .authenticate()
    .then(() => {
      return sequelize.define(
        "answersPhotos",
        {
          photo_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          answer_id: {
            type: DataTypes.INTEGER,
            references: {
              model: "answersList",
              key: "answer_id",
            },
          },
          url: {
            type: DataTypes.STRING(2048),
          },
        },
        {
          schema: process.env.Schema, // Replace with your schema name
          tableName: "answers_photos", // Replace with your table name
          timestamps: false,
        }
      );
    })
    .catch((err) => {
      console.error("Error occured when connecting to PostgreSQL: ", err);
    });
}

module.exports = {
  getQuestions: (req, res) => {
    if (!req.body.product_id || req.body.product_id > 2147483647) {
      return res.status(400).send("invalid product id");
    }

    var page = req.body.page || 1;
    var count = req.body.count || 5;
    var offset = Math.abs((page - 1) * count);
    var product_id = req.body.product_id;

    databaseConnection()
      .then((sequelize) => {
        questionsListTableConn(sequelize)
          .then((questionsList) => {
            answersListTableConn(sequelize)
              .then((answersList) => {
                answersPhotosTableConn(sequelize)
                  .then((answersPhotos) => {
                    var response = {};
                    questionsList.hasMany(answersList, {foreignKey: "question_id"});
                    answersList.belongsTo(questionsList, {foreignKey: "question_id"});

                    answersList.hasMany(answersPhotos, {foreignKey: "answer_id",});
                    answersPhotos.belongsTo(answersList, {foreignKey: "answer_id",});

                    questionsList
                      .findAll({
                        include: [
                          { model: answersList, include: [answersPhotos] },
                        ],
                        offset: offset,
                        limit: count,
                        where: {
                          product_id,
                          reported: false,
                        },
                      })
                      .then((result) => {
                        var response = {};
                        response.product_id = product_id;
                        response.results = [];

                        result.map((e) => {

                          let data = {};
                          data.question_id = e.dataValues.question_id;
                          data.question_body = e.dataValues.question_body;
                          data.question_date = e.dataValues.question_date;
                          data.asker_name = e.dataValues.asker_name;
                          data.question_helpfulness =
                            e.dataValues.question_helpfulness;
                          data.reported = e.dataValues.reported;

                          data.answers = {};

                          e.answersLists.map((x) => {
                            data.answers[x.dataValues.answer_id] = {};

                            data.answers[x.dataValues.answer_id].id =
                              x.dataValues.answer_id;
                            data.answers[x.dataValues.answer_id].body =
                              x.dataValues.answer_body;
                            data.answers[x.dataValues.answer_id].date =
                              x.dataValues.answer_date;
                            data.answers[x.dataValues.answer_id].answerer_name =
                              x.dataValues.answerer_name;
                            data.answers[x.dataValues.answer_id].helpfulness =
                              x.dataValues.helpfulness;
                            data.answers[x.dataValues.answer_id].photos = [];

                            x.dataValues.answersPhotos.map((p) => {
                              data.answers[x.dataValues.answer_id].photos.push(
                                p.dataValues.url
                              );
                            });
                          });

                          response.results.push(data);
                        });
                        res.send(response);
                      });
                  })
                  .catch((err) => console.log(err));
              })
              .catch((err) => console.log(err));
          })
          .catch((err) => console.log(err));
      })
      .catch((err) => console.log(err));
  },
  getAnswers: (req, res) => {
    if (
      parseInt(req.params.question_id) === NaN ||
      req.params.question_id > 2147483647
    ) {
      return res.status(400).send("invalid question id");
    }

    var page = req.body.page || 1;
    var count = req.body.count || 5;
    var offset = Math.abs((page - 1) * count);
    var question_id = req.params.question_id;

    databaseConnection()
      .then((sequelize) => {
        answersListTableConn(sequelize)
          .then((answersList) => {
            answersPhotosTableConn(sequelize)
              .then((answersPhotos) => {
                answersList.hasMany(answersPhotos, { foreignKey: "answer_id" });
                answersPhotos.belongsTo(answersList, {
                  foreignKey: "answer_id",
                });

                answersList
                  .findAll({
                    include: { model: answersPhotos },
                    offset: offset,
                    limit: count,
                    where: {
                      question_id,
                      reported: false,
                    },
                  })
                  .then((result) => {
                    var response = {};
                    response.question = question_id;
                    response.page = page;
                    response.count = count;
                    response.results = [];

                    result.map((e) => {
                      var answer = {};
                      answer.answer_id = e.dataValues.answer_id;
                      answer.body = e.dataValues.answer_body;
                      answer.date = e.dataValues.answer_date;
                      answer.answerer_name = e.dataValues.answerer_name;
                      answer.helpfulness = e.dataValues.helpfulness;
                      answer.photos = [];

                      e.dataValues.answersPhotos.map((x) => {
                        var photo = {};
                        photo.id = x.photo_id;
                        photo.url = x.url;
                        answer.photos.push(photo);
                      });
                      response.results.push(answer);
                    });
                    res.send(response);
                  }).catch((err) => console.log(err));
              })
              .catch((err) => console.log(err));
          })
          .catch((err) => console.log(err));
      })
      .catch((err) => console.log(err));
  },
  postQuestions: (req, res) => {
    if (!req.body.product_id || req.body.product_id > 2147483647) {
      return res.status(400).send("invalid product id");
    }

    var product_id = req.body.product_id;
    var body = req.body.body || "";
    var name = req.body.name || "";
    var email = req.body.email || "";

    databaseConnection().then((sequelize) => {
      questionsListTableConn(sequelize).then((questionsList) => {
        questionsList.count().then((rows) => {
          questionsList
            .create({
              question_id: rows + 1,
              product_id: product_id,
              question_body: body,
              asker_name: name,
              asker_email: email,
              question_date: new Date().toISOString(),
            })
            .then((result) => {
              res.status(201).send("Status: 201 CREATED");
            }).catch((err) => console.log(err));
        }).catch((err) => console.log(err));
      }).catch((err) => console.log(err));
    }).catch((err) => console.log(err));
  },
  postAnswers: (req, res) => {
    if (
      parseInt(req.params.question_id) === NaN ||
      req.params.question_id > 2147483647
    ) {
      return res.status(400).send("invalid question id");
    }

    var question_id = req.params.question_id;
    var body = req.body.body || "";
    var name = req.body.name || "";
    var email = req.body.email || "";
    var photos = req.body.photos || [];

    databaseConnection().then((sequelize) => {
      answersListTableConn(sequelize).then((answersList) => {
        answersPhotosTableConn(sequelize).then((answersPhotos) => {
          answersList.count().then((rows) => {
            answersList
              .create({
                answer_id: rows + 1,
                question_id: question_id,
                answer_body: body,
                answer_date: new Date().toISOString(),
                answerer_name: name,
                answerer_email: email,
              })
              .then(() => {
                answersPhotos.count()
                .then((pRows) => {
                  photos.map((e) => {
                    answersPhotos.create({
                      photo_id: (pRows += 1),
                      answer_id: rows + 1,
                      url: e,
                    });
                  })
                  res.status(201).send("Status: 201 CREATED");
                });
              });
          });
        });
      });
    });
  },
  putQuestionHelpful: (req, res) => {
    if (
      parseInt(req.params.question_id) === NaN ||
      req.params.question_id > 2147483647
    ) {
      return res.status(400).send("invalid question id");
    }
    const question_id = req.params.question_id;
    databaseConnection().then((sequelize) => {
      questionsListTableConn(sequelize).then((questionsList) => {
        questionsList
          .increment("question_helpfulness", {
            where: { question_id: question_id },
          })
          .then((result) => {
            res.status(204).send("Status: 204 NO CONTENT");
          });
      });
    });
  },
  putAnswerHelpful: (req, res) => {
    if (
      parseInt(req.params.answer_id) === NaN ||
      req.params.answer_id > 2147483647
    ) {
      return res.status(400).send("invalid answer id");
    }
    const answer_id = req.params.answer_id;
    databaseConnection().then((sequelize) => {
      answersListTableConn(sequelize).then((answersList) => {
        answersList
          .increment("helpfulness", { where: { answer_id: answer_id } })
          .then(() => {
            res.status(204).send("Status: 204 NO CONTENT");
          });
      });
    });
  },
  putQuestionReport: (req, res) => {
    if (
      parseInt(req.params.question_id) === NaN ||
      req.params.question_id > 2147483647
    ) {
      return res.status(400).send("invalid question id");
    }
    const question_id = req.params.question_id;
    databaseConnection().then((sequelize) => {
      questionsListTableConn(sequelize).then((questionsList) => {
        questionsList
          .update({ reported: true }, { where: { question_id: question_id } })
          .then(() => {
            res.status(204).send("Status: 204 NO CONTENT");
          });
      });
    });
  },

  putAnswerReport: (req, res) => {
    if (
      parseInt(req.params.answer_id) === NaN ||
      req.params.answer_id > 2147483647
    ) {
      return res.status(400).send("invalid question id");
    }
    const answer_id = req.params.answer_id;
    databaseConnection().then((sequelize) => {
      answersListTableConn(sequelize).then((answersList) => {
        answersList
          .update({ reported: true }, { where: { answer_id: answer_id } })
          .then(() => {
            res.status(204).send("Status: 204 NO CONTENT");
          });
      });
    });
  },
};
